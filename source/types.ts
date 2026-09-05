import type { BuildConfig, BuildOutput, Target } from "bun";

// * --- bundler error

/**
 * Type error raised for all expected bundler failures.\
 * Caught at the top-level `main` handler and printed without a stack trace,
 * keeping the CLI output clean for user-facing validation and build errors.
 */
export class BundlerError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "BundlerError";
  }
}

// * --- bundler config

/** Output format configuration for a single module format (ESM e CJS). */
type TBundlerFormat = {
  /** Whether this format should be emitted during the build. */
  enabled: boolean;

  /** Subdirectory inside `outdir` where the format artifacts are written. */
  directory: string;

  /** File extension applied to the output files. */
  extension: string;
};

/** Declaration of a single library enttrypoint to be compiled. */
export type TBundlerEntry = {
  /** Path to the source file relative to `rootdir`. */
  entrypoint: string;

  /** When `true`, this entry is mapped to the root `"."` export key. */
  default: boolean;

  /** Identifier used as the output filename stem and the named export key. */
  name: string;
};

/** Full schema of the `bunpack.json` configuration file. */
export type TBundlerConfig = {
  /** Directory where all build artifacts are written. */
  outdir: string;

  /** Directory containing the library source files. */
  rootdir: string;

  /** Bun build target runtime. */
  target: Target;

  /**
   * Whether to minify output.\
   * Always `true` when `NODE_ENV=production`.
   */
  minify: boolean;

  /** Sourcemap strategy passed directly to the Bun bundler. */
  sourcemap: BuildConfig["sourcemap"];

  /** Whether to enable code splitting across entrypoints. */
  splitting: boolean;

  /** How external packages are handled. */
  packages: BuildConfig["packages"];

  /** When `true`, the `outdir is deleted before each child. */
  clean: boolean;

  /** Output format configurations. */
  formats: {
    /** ESM format (`import`/`export`). */
    esm: TBundlerFormat;

    /** CJS format (`requires` / `module.exports`). */
    cjs: TBundlerFormat;
  };

  /**
   * List of entrypoints to compile.\
   * Exactly one must have `default: true`.
   */
  entries: TBundlerEntry[];

  /** TypeScript declaration file generation settings. */
  declarations: {
    /** Whether to invoke `tsc` for `.d.ts` emission after the Bun build. */
    enabled: boolean;

    /** Subdirectory inside `outdir` where `.d.ts` files are written. */
    directory: string;

    /** Path to `tsconfig` file relative to the project root. */
    tsconfig: string;
  };
};

// * --- package json

/** Conditional export entry written to `package.json` for a single entrypoint. */
export type TPackageJsonExport = {
  /** Path to the declaration file (`.d.ts`), resolved by type-ware tooling. */
  types?: string;

  /** Path to the ESM artifact, resolved for `import` statements. */
  import?: string;

  /** Path to the CJS artifact, resolved for `require` calls. */
  require?: string;
};

/** Minimal `package.json` shape used when reading and updating export maps. */
export type TPackageJson = {
  /** Conditional exports map written after each successful build. */
  exports?: Record<string, TPackageJsonExport>;
  [key: string]: unknown;
};

// * --- build

/**
 * Represents a single scheduled Bun build invocation, pairing its metadata
 * with the in-flight build promise.
 */
export type TBuildTask = {
  /** Output module format for this task. */
  format: "esm" | "cjs";

  /** Source entrypoint this task compiles. */
  entry: TBundlerEntry;

  /** Human-readable label used in log output (e.g., `"core [ESM]"`). */
  label: string;

  /** In-flight Bun build promise. */
  promise: Promise<BuildOutput>;
};
