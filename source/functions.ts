import { rename, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import {
  CONFIG_FILENAME,
  LOGGER,
  REGEXP_ENTRY_NAME,
  REGEXP_FORMAT_EXTENSION,
  REGEXP_SAFE_RELATIVE_PATH,
  ROOT_DIR,
} from "@app/constants";
import {
  BundlerError,
  type TBuildTask,
  type TBundlerConfig,
  type TBundlerEntry,
  type TPackageJson,
  type TPackageJsonExport,
} from "@app/types";
import { $, build, file } from "bun";

// * --- path confinement

/**
 * Asserts that `child` is physically located inside `parent` after resolution,
 * preventing path transversal attacks where validate relative path still
 * escapes the expected directory after `resolve()`.
 *
 * @param parent Absolute path of the expected containing directory.
 * @param child Absolute path of the file or directory to verify.
 * @param label Human-readable label used in the error message.
 *
 * @throws {BundlerError} When `child` resolves outside of `parent`.
 */
function assertPathWithin(parent: string, child: string, label: string): void {
  const rel: string = relative(parent, child);
  const escapes: boolean =
    rel.startsWith("..") ||
    rel.includes("\0") ||
    resolve(parent, rel) !== child;

  if (escapes) {
    throw new BundlerError(
      `Path transversal detected: "${label}" resolves outside of "${parent}"`,
    );
  }
}

// * --- config loading & validation

/**
 * Asserts that `value` is a non-empty string representing a safe relative path,
 * pushing a descripte message into `errors` when the assertation fails.
 *
 * @param value Raw value from the config object to validate.
 * @param field Dot-notation field name shown in the error message.
 * @param errors Mutable array that collects all valdation errors.
 *
 * @returns `true` when the value is valid; `false` otherwise.
 */
function assertSafeRelativePath(
  value: unknown,
  field: string,
  errors: string[],
): boolean {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`"${field}" must be a non-empty string`);
    return false;
  }

  if (!REGEXP_SAFE_RELATIVE_PATH.test(value)) {
    errors.push(
      `"${field}" must be a safe realtive path (without "/", "../", or a drive letter)`,
    );
    return false;
  }
  return true;
}

/**
 * Performs a full structural and semantic validation pass over a raw config
 * object, collecting every problem before returning so callers receive all
 * errors att once rather than one at a time.
 *
 * @param raw Untyped object parsed from `bunpack.json`.
 * @returns Array of human-readable error messages; empty when the config is valid.
 */
function collectConfigErrors(raw: Record<string, unknown>): string[] {
  const errors: string[] = [];

  const outdirValid = assertSafeRelativePath(raw.outdir, "outdir", errors);
  const rootdirValid = assertSafeRelativePath(raw.rootdir, "rootdir", errors);

  // # outdir !== rootdir ('rm -rf' source guard)
  if (outdirValid && rootdirValid && raw.outdir === raw.rootdir) {
    errors.push('"outdir" and "rootdir" must be different directories');
  }

  // # targets
  const VALID_TARGETS = ["node", "bun"] as const;
  if (!VALID_TARGETS.includes(raw.target as (typeof VALID_TARGETS)[number])) {
    errors.push(`"target" should be: ${VALID_TARGETS.join(" | ")}`);
  }

  // # sourcemap
  const VALID_SOURCEMAPS = ["none", "inline", "external", "linked"] as const;
  if (
    raw.sourcemap !== undefined &&
    !VALID_SOURCEMAPS.includes(
      raw.sourcemap as (typeof VALID_SOURCEMAPS)[number],
    )
  ) {
    errors.push(`"sourcemap" must be: ${VALID_SOURCEMAPS.join(" | ")}`);
  }

  // # packages
  const VALID_PACKAGES = ["bundle", "external"] as const;
  if (
    raw.packages !== undefined &&
    !VALID_PACKAGES.includes(raw.packages as (typeof VALID_PACKAGES)[number])
  ) {
    errors.push(`"packages" must be: ${VALID_PACKAGES.join(" | ")}`);
  }

  // # booleans
  for (const field of ["minify", "splitting", "clean"] as const) {
    if (typeof raw[field] !== "boolean") {
      errors.push(`"${field}" must be a boolean`);
    }
  }

  // # formats
  if (typeof raw.formats !== "object" || raw.formats === null) {
    errors.push('"formats" must be a object');
  } else {
    const formats = raw.formats as Record<string, unknown>;
    let anyEnabled: boolean = false;

    for (const fmt of ["esm", "cjs"] as const) {
      const f = formats[fmt];
      if (typeof f !== "object" || f === null) {
        errors.push(`"formats.${fmt}" must be a object`);
        continue;
      }

      const fmtObj = f as Record<string, unknown>;
      if (typeof fmtObj.enabled !== "boolean") {
        errors.push(`"formats.${fmt}.emabled" must be a boolean`);
      } else if (fmtObj.enabled) {
        anyEnabled = true;
      }

      assertSafeRelativePath(
        fmtObj.directory,
        `formats.${fmt}.directory`,
        errors,
      );

      if (
        typeof fmtObj.extension !== "string" ||
        !REGEXP_FORMAT_EXTENSION.test(fmtObj.extension)
      ) {
        errors.push(
          `"formats.${fmt}.extension" must be a valid extension (e.g., ".js", ".ts")`,
        );
      }
    }

    if (!anyEnabled) {
      errors.push('At least one format ("esm" or "cjs") must be enabled.');
    }
  }

  // # entries
  if (!Array.isArray(raw.entries) || raw.entries.length === 0) {
    errors.push(`"entries" must be a non-empty array`);
  } else {
    const names = new Set<string>();
    let defaultCount: number = 0;

    for (const [i, entry] of (raw.entries as unknown[]).entries()) {
      const e = entry as Record<string, unknown>;
      const pfx = `entries[${i}]`;

      if (typeof e.name !== "string" || !REGEXP_ENTRY_NAME.test(e.name)) {
        errors.push(
          `"${pfx}.name" must start with a letter and contain only [a-zA-Z0-9_-]`,
        );
      } else if (names.has(e.name)) {
        errors.push(`"${pfx}.name" is duplicated`);
      } else {
        names.add(e.name);
      }

      // # safe relative path
      assertSafeRelativePath(e.entrypoint, `${pfx}.entrypoint`, errors);

      if (typeof e.default !== "boolean") {
        errors.push(`"${pfx}.default" must be a boolean`);
      } else if (e.default) {
        defaultCount++;
      }
    }

    if (defaultCount === 0) {
      errors.push('Exactly one entry must have "default: true"');
    }
    if (defaultCount > 1) {
      errors.push(
        `Only one entry can have: "default: true" (found: ${defaultCount})`,
      );
    }
  }

  // # declartions
  if (typeof raw.declarations !== "object" || raw.declarations === null) {
    errors.push('"declarations" must be a object');
  } else {
    const d = raw.declarations as Record<string, unknown>;

    if (typeof d.enabled !== "boolean") {
      errors.push('"declarations.enabled" must be a boolean');
    }

    if (d.directory !== undefined) {
      assertSafeRelativePath(d.directory, "declarations.directory", errors);
    }

    if (d.enabled === true && d.directory === undefined) {
      errors.push(
        '"declarations.directory" must be defined when "declarations.enabled" is true',
      );
    }
  }

  return errors;
}

/**
 * Reads, parses, and validates `bunpack.json` from the project root.
 * @returns The fully validated bundler configuration.
 *
 * @throws {BundlerError} When the file is missing, contains invalid JSON, is
 * not a plain object, or fails structural validation.
 */
export async function loadConfig(): Promise<TBundlerConfig> {
  const configPath: string = resolve(ROOT_DIR, CONFIG_FILENAME);
  const configFile = file(configPath);

  if (!(await configFile.exists())) {
    throw new BundlerError(`Configuration not found: "${configPath}"`);
  }

  let raw: unknown;
  try {
    raw = await configFile.json();
  } catch (cause) {
    throw new BundlerError(`Invalid JSON in "${CONFIG_FILENAME}"`, cause);
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new BundlerError(`"${CONFIG_FILENAME}" must be a JSON object`);
  }

  const errors = collectConfigErrors(raw as unknown as Record<string, unknown>);
  if (errors.length > 0) {
    throw new BundlerError(
      `Invalid configuration ("${CONFIG_FILENAME}"):\n${errors
        .map((e) => ` - ${e}`)
        .join("\n")}`,
    );
  }

  return raw as unknown as TBundlerConfig;
}

// * --- validate entrypoints

/**
 * Verifies that every declarated entrypoint exists on disk before the build
 * starts, collecting all missing paths and reporting them together.
 *
 * @param entries Entrypoint declarations from the bundler config.
 * @param sourceDir Absolute path to the resolved `rootdir`.
 *
 * @throws {BundlerError} When one or more entrypoint files cannot be found.
 */
export async function validateEntrypoints(
  entries: TBundlerEntry[],
  sourceDir: string,
): Promise<void> {
  const results = await Promise.all(
    entries.map(async (entry) => {
      const fullPath: string = resolve(sourceDir, entry.entrypoint);

      // # path confinement
      try {
        assertPathWithin(
          sourceDir,
          fullPath,
          `entrypoint "${entry.entrypoint}"`,
        );
      } catch {
        return ` - "${entry.entrypoint}" resolves outside of rootdir`;
      }

      const exists: boolean = await file(fullPath).exists();
      return exists ? null : ` - ${entry.entrypoint}\n → ${fullPath}`;
    }),
  );

  const missing = results.filter(Boolean) as string[];
  if (missing.length > 0) {
    throw new BundlerError(`Entrypoint(s) not found:\n${missing.join("\n")}`);
  }
}

// * --- helpers

/**
 * Joins path segments into a POSIX-style relative path prefixed with `"./"`,
 * suitable for used as a value in the `"exports"` field of `package.json`.
 *
 * @param segments Path fragments to join (e.g., `"build"`, `"esm"`, `"index.js"`).
 * @returns A normalized relative path such as `"./build/esm/index.js"`.
 */
function toExportPath(...segments: string[]): string {
  const joined: string = segments
    .join("/")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/");
  return `./${joined.replace(/^\.\//, "")}`;
}

// * --- build

/**
 * Creates a {@link TBuildTask} for every enabled format x entry combination
 * and starts all builds concurrently without awaiting them.
 *
 * @param config Validated bundler configuration.
 * @param sourceDir Absolute path to the resolved `rootdir`.
 * @param minify Whether to minify output for this run.
 *
 * @returns Array of in-flight build tasks ready to be settled.
 */
export function scheduleBuildTasks(
  config: TBundlerConfig,
  sourceDir: string,
  minify: boolean,
): TBuildTask[] {
  const tasks: TBuildTask[] = [];

  for (const entry of config.entries) {
    for (const format of ["esm", "cjs"] as const) {
      const fmt = config.formats[format];
      if (!fmt.enabled) continue;

      // # path confinemennt
      const outdir: string = resolve(ROOT_DIR, config.outdir, fmt.directory);
      assertPathWithin(ROOT_DIR, outdir, `formats.${format}.directory`);

      tasks.push({
        format,
        entry,
        label: `${entry.name} [${format.toUpperCase()}]`,
        promise: build({
          entrypoints: [resolve(sourceDir, entry.entrypoint)],
          outdir,
          naming: `${entry.name}${fmt.extension}`,
          format,
          target: config.target,
          minify,
          sourcemap: config.sourcemap,
          splitting: config.splitting,
          packages: config.packages,
        }),
      });
    }
  }

  if (tasks.length === 0) {
    throw new BundlerError(
      "No build task generated - check the enabled formats in the config",
    );
  }
  return tasks;
}

/**
 * Awaits all scheduled build tasks via `Promise.allSettled`, collects every
 * failure, and throws a single aggregated error when any task did not succeed.
 *
 * @param tasks In-flight build tasks return by `scheduleBuildTasks`.
 * @throws {BundlerError} When one or more builds fail, with all error
 * output included.
 */
export async function runBuildTasks(tasks: TBuildTask[]): Promise<void> {
  const settled = await Promise.allSettled(tasks.map((t) => t.promise));
  const failures: string[] = [];

  for (const [i, result] of settled.entries()) {
    if (!tasks[i]) continue;
    const { label } = tasks[i];

    if (result.status === "rejected") {
      failures.push(`${label}: ${String(result.reason)}`);
      continue;
    }

    if (!result.value.success) {
      const errorMsgs = result.value.logs
        .filter((l) => l.level === "error")
        .map((l) => ` ${l.message}`)
        .join("\n");

      failures.push(`${label}:\n${errorMsgs || " (unknown error)"}`);
      continue;
    }

    LOGGER.success(label);
  }

  if (failures.length > 0) {
    throw new BundlerError(
      `${failures.length} build(s) failed:\n${failures.join("\n")}`,
    );
  }
}

// * --- generators

/**
 * Invokes `tsc` via `bunx` to emit `.d.ts` declaration files using the
 * project-specific build tsconfig.
 *
 * @param config Validated bundler configuration.
 * @throws {BundlerError} When the tsconfig file is missing or `tsc` exists
 * with a non-zero code.
 */
export async function generateDeclarations(
  config: TBundlerConfig,
): Promise<void> {
  LOGGER.info("Generating type declarations (tsc)...");

  const declarationDir: string = resolve(
    ROOT_DIR,
    config.outdir,
    config.declarations.directory,
  );
  const rootDir: string = resolve(ROOT_DIR, config.rootdir);

  // # path confinement
  assertPathWithin(ROOT_DIR, declarationDir, "declarations.directory");
  const entrypoints = config.entries.map((e) =>
    resolve(ROOT_DIR, config.rootdir, e.entrypoint),
  );

  const flags = [
    "--ignoreConfig",
    "--declaration",
    "--emitDeclarationOnly",
    "--noEmit",
    "false",
    "--declarationDir",
    declarationDir,
    "--rootDir",
    rootDir,
  ];

  const result = await $`bunx --bun tsc ${entrypoints} ${flags}`
    .quiet()
    .nothrow();

  if (result.exitCode !== 0) {
    const stdout = result.stdout.toString().trim();
    const stderr = result.stderr.toString().trim();
    const output = [stdout, stderr].filter(Boolean).join("\n");
    throw new BundlerError(
      `"tsc" exited with code ${result.exitCode}:\n${output || "(no output)"}`,
    );
  }
}

/**
 * Reads `package.json`, regenerates the `"exports"` field from the current
 * build config, and writes the result back to disk.
 *
 * @param config Validated bundler configuration.
 * @throws {BundlerError} When `package.json` cannot be found at the project root.
 */
export async function generateExports(config: TBundlerConfig): Promise<void> {
  // # path confinement
  const packageJsonPath: string = resolve(ROOT_DIR, "package.json");
  assertPathWithin(ROOT_DIR, packageJsonPath, "package.json");

  const packageJsonFile = file(packageJsonPath);
  if (!(await packageJsonFile.exists())) {
    throw new BundlerError(`"package.json" not found at "${packageJsonPath}"`);
  }

  const packageJson = (await packageJsonFile.json()) as TPackageJson;
  const exports: Record<string, TPackageJsonExport> = {};

  for (const entry of config.entries) {
    const exportKey = entry.default ? "." : `./${entry.name}`;

    // # safe typescript extension remove
    const baseName: string = entry.entrypoint.replace(/\.tsx?$/, "");
    const exportEntry: TPackageJsonExport = {};

    if (config.declarations.enabled) {
      exportEntry.types = toExportPath(
        config.outdir,
        config.declarations.directory,
        `${baseName}.d.ts`,
      );
    }

    if (config.formats.esm.enabled) {
      exportEntry.import = toExportPath(
        config.outdir,
        config.formats.esm.directory,
        `${entry.name}${config.formats.esm.extension}`,
      );
    }

    if (config.formats.cjs.enabled) {
      exportEntry.require = toExportPath(
        config.outdir,
        config.formats.cjs.directory,
        `${entry.name}${config.formats.cjs.extension}`,
      );
    }

    exports[exportKey] = exportEntry;
  }

  packageJson.exports = exports;
  const content = `${JSON.stringify(packageJson, null, 2)}\n`;

  // # atomic write (prevents partial writes on crash)
  const tmpPath: string = `${packageJsonPath}.tmp`;
  try {
    await writeFile(tmpPath, content, { encoding: "utf-8" });
    await rename(tmpPath, packageJsonPath);
  } catch (cause) {
    // # cleanup orphaned temp file
    await rm(tmpPath, { force: true });
    throw new BundlerError(`Failed to write "package.json"`, cause);
  }
}
