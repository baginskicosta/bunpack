#!/usr/bin/env bun
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { LOGGER, ROOT_DIR, VERSION } from "@app/constants";
import {
  generateDeclarations,
  generateExports,
  loadConfig,
  runBuildTasks,
  scheduleBuildTasks,
  validateEntrypoints,
} from "@app/functions";
import { BundlerError } from "@app/types";

// * --- cli

const KNOWN_ARGS = new Set(["--help", "--version"]);
const ARGS = new Set(process.argv.slice(2));

const unknownArg = [...ARGS].find((arg) => !KNOWN_ARGS.has(arg));

function showHelp(): void {
  LOGGER.log([
    "",
    "bunpack: Modern library bundling, powered by Bun",
    `version: ${VERSION}`,
    "funding: https://patreon.com/baginskicostadev",
    "",
    "Usage:",
    "  bunpack              Run the bundler",
    "  bunpack [options]    Run with options",
    "",
    "Options:",
    "  --help               Show this help message",
    "  --version            Show the current version",
    "",
  ]);
}

if (ARGS.has("--version")) {
  LOGGER.log(VERSION);
  process.exit(0);
}

if (ARGS.has("--help")) {
  showHelp();
  process.exit(0);
}

if (unknownArg !== undefined) {
  LOGGER.log("");
  LOGGER.error(`Unknown option: "${unknownArg}"`);
  showHelp();
  process.exit(1);
}

// * --- lead orchestrator

async function main(): Promise<void> {
  const startAt: number = performance.now();

  // # configuration
  const config = await loadConfig();
  const sourceDir: string = resolve(ROOT_DIR, config.rootdir);
  const isProduction: boolean = Bun.env.NODE_ENV === "production";
  const minify: boolean = isProduction || config.minify;

  const entryCount: number = config.entries.length;
  LOGGER.info(
    `Starting build${isProduction ? " (production)" : ""} - ` +
      `${entryCount} entr${entryCount === 1 ? "y" : "ies"}, ` +
      `target: ${config.target}`,
  );

  // # clean
  await validateEntrypoints(config.entries, sourceDir);
  if (config.clean) {
    const outDir: string = resolve(ROOT_DIR, config.outdir);
    LOGGER.info(`Cleaning "${config.outdir}/"`);
    await rm(outDir, { recursive: true, force: true });
  }

  // # tasks
  const tasks = scheduleBuildTasks(config, sourceDir, minify);
  await runBuildTasks(tasks);

  // # typescript declarations
  if (config.declarations.enabled) {
    await generateDeclarations(config);
    LOGGER.success("Generated type declarations");
  }

  // # exports
  await generateExports(config);
  LOGGER.success('Updated "package.json" exports');

  const elapsed: string = ((performance.now() - startAt) / 1000).toFixed(2);
  LOGGER.success(
    `Completed in ${elapsed}s${isProduction ? " (production)" : ""}`,
  );
}

// * --- entrypoint

main().catch((err) => {
  if (err instanceof BundlerError) {
    LOGGER.error(err.message);
  } else {
    LOGGER.error("Unexpected error", err);
  }
  process.exit(1);
});
