import { cwd } from "node:process";

// * --- constants

/** Bunpack version. */
export const VERSION: string = "0.2.0";

/** Name of the bundler configuration file read from the project root. */
export const CONFIG_FILENAME: string = "bunpack.json";

/** Absolute path of the directory from which the bundler is invovked. */
export const ROOT_DIR: string = cwd();

// * --- regular expressions

/**
 * Validates that an entry `name` starts with a letter and contains
 * only `[a-zA-Z0-9_-]`.
 */
export const REGEXP_ENTRY_NAME: RegExp = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/** Validates a single-segment file extension such as `".js"` or `".cjs"`. */
export const REGEXP_FORMAT_EXTENSION: RegExp = /^\.[a-zA-Z0-9]+$/;

/**
 * Validates that a path is relative and safe.\
 * Paths starting with `".."`, and paths containing null bytes.
 */
export const REGEXP_SAFE_RELATIVE_PATH: RegExp =
  /^(?!(?:\/|[A-Za-z]:[\\/]|\.\.))[^\0]+$/;

// * --- logger

/**
 * Structured console logger with prefixed, levelled output.\
 * All messages are tagged with `[bunpack]` for easy filtering.
 */
export const LOGGER = {
  info: (msg: string) => console.log(`[bunpack] i ${msg}`),
  log: (msg: string | string[]) =>
    console.log(typeof msg === "string" ? msg : msg.join("\n")),
  success: (msg: string) => console.log(`[bunpack] ✓ ${msg}`),
  warn: (msg: string) => console.warn(`[bunpack] ⚠ ${msg}`),
  error: (msg: string, cause?: unknown) => {
    console.error(`[bunpack] ✗ ${msg}`);
    if (cause instanceof Error && cause.message) {
      console.error(`└─ ${cause.message}`);
    }
  },
};
