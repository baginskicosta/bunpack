<!-- * social links * -->

[me_patreon]: https://patreon.com/baginskicostadev
[me_youtube]: https://www.youtube.com/@baginskicosta
[me_insta]: https://www.instagram.com/baginskicosta/
[me_twitch]: https://www.twitch.tv/baginskicosta

<!-- * shields * -->

[badge_youtube]: https://shields.io/badge/YOUTUBE-303030?logo=youtube&style=for-the-badge&labelColor=2c488c&logoColor=white
[badge_insta]: https://shields.io/badge/INSTAGRAM-303030?logo=instagram&style=for-the-badge&labelColor=2c488c&logoColor=white
[badge_twitch]: https://shields.io/twitch/status/baginskicosta?logo=twitch&style=for-the-badge&labelColor=2c488c&logoColor=white&label=&color=303030
[badge_patreon]: https://shields.io/badge/SPONSOR_ME_ON_PATREON-303030?logo=patreon&style=for-the-badge&labelColor=FF355E

<!-- * external links * -->

[ex_bun]: https://bun.com/
[ex_node]: https://nodejs.org/en
[ex_rust]: https://rust-lang.org/

<!-- * banner * -->

<h1 align="center">
  <code>@baginskicosta/bunpack</code>
</h1>
<p align="center">
  Modern bundling for TypeScript and JavaScript libraries,
  powered by Bun.
</p>
<p align="center">
  <a href="https://patreon.com/baginskicostadev">
    <img src="https://shields.io/badge/PATREON-303030?logo=patreon&style=for-the-badge&labelColor=FF355E" alt="Sponsor on Patreon">
  </a>
  <span aria-hidden="true">&emsp;</span>
  <a href="https://www.youtube.com/@baginskicosta">
    <img src="https://shields.io/badge/YOUTUBE-303030?logo=youtube&style=for-the-badge&labelColor=2c488c&logoColor=white" alt="YouTube">
  </a>
  <a href="https://www.instagram.com/baginskicosta/">
    <img src="https://shields.io/badge/INSTAGRAM-303030?logo=instagram&style=for-the-badge&labelColor=2c488c&logoColor=white" alt="Instagram">
  </a>
  <a href="https://www.twitch.tv/baginskicosta">
    <img src="https://shields.io/twitch/status/baginskicosta?logo=twitch&style=for-the-badge&labelColor=2c488c&logoColor=white&label=&color=303030" alt="Twitch">
  </a>
</p>

<!-- * introduction * -->

## Introduction

`@baginskicosta/bunpack` is a bundler designed for libraries written
in **TypeScript** and **JavaScript**, build on top of the native
capabilities provided by the [Bun][ex_bun] runtime.

It uses the `Bun.build` API to transpilate, bundle, and minify complete
projects for production environment while supporting both **ESM**
and **CJS** module formats. The bundler also allows the target runtime
to be explicitly defined, supporting environments such as
[Node][ex_node] as well as [Bun][ex_bun].

The project is designed to provide a predictable build process for
libraries, with support for multiple entry points, independent module
formats, declaration generation, and automatic package export
configuration.

<!-- * features * -->

## Features

- Native bundling powered by `Bun.build`.
- Support for TypeScript and JavaScript libraries.
- Support for both `ESM` and `CJS` module formats.
- Configurable target runtime for [Node][ex_node] and [Bun][ex_bun].
- Multiple library entry points.
- Automatic generation of package `exports`.
- TypeScript declaration generation.
- Optional code splitting.
- Configurable external package handling.
- Automatic output directory cleanup.
- Production-oriented minification.
- JSON-based project configuration.
- Designed for libraries and monorepositories.
- Minimal configuration required to get started.

<!-- * performance * -->

## Performance

`@baginskicosta/bunpack` is designed around the native build
capabilities of [Bun][ex_bun].

Because the building process relies on [Bun's][ex_bun] native
implementation, the library benefits from the performance
characteristics of its underlying toolchain, which is primarily
implemented in [Rust][ex_rust].

This makes the bundler suitable for both small standalone libraries
and larger projects containing multiple packages or entry points.

<!-- * installation * -->

## Installation

```bash
bun add @baginskicosta/bunpack # bun package manager
```

<!-- * usage * -->

## Basic Usage

Before using `@baginskicosta/bunpack`, you need a TypeScript or
JavaScript library porject. If you are starting a new project
with [Bun][ex_bun], you can create a minimal TypeScript library with:

```bash
bun init --minimal . # creates minimal typescript library
```

If you already have a existing TypeScript library, you can simply
continue with the configuration process.

### Defining the Configuration

`@baginskicosta/bunpack` uses a `bunpack.json` file located at the
root of the project.\
The configuration file follows the [Bunpack Schema](./schema.json),
which provides editor support and validation for the available
configuration properties.

A minimal configuration can be created as follow:

```json
{
  "$schema": "https://raw.githubusercontent.com/baginskicosta/bunpack/main/schema.json"
}
```

The following properties are available:

- `$schema`: Defines the path or URL to the
  [Bunpack Schema](./schema.json).
- `outdir`: Defines the directory where generated files are written.
  Defaults to `"dist"`.
- `rootdir`: Defines the directory containing the source code.
  Defaults to `"source"`.
- `target`: Defines the runtime targeted by the generated bundle.
  Defaults to `"bun"`.
- `minify`: Defines whether generated files should be minified.
  Defaults to `true`. This value is always treated as `true` when
  `NODE_ENV` is set to `"production"`.
- `sourcemap`: Defines the source map generation strategy.
  Defaults to `"none"`.
- `splitting`: Defines whether code splitting should be enabled.
  Defaults to `false`.
- `packages`: Defines how external dependencies should be handled.
  Defaults to `"bundle"`.
- `clean`: Defines whether the output directory should be cleaned
  before each build. Defaults to `true`.
- `formats`: Defines configuration for each supported module format,
  including `esm` and `cjs`.
- `entries`: Defines the library entry points. Each entry can generate
  a corresponding `exports` condition in the package's `package.json`.
- `declarations`: Defines how TypeScript declaration files should be
  generated.

## Basic Configuration

The following configuration provides a recommended setup for libraries
that need to support both `ESM` and `CJS` across multiple runtimes:

```json
{
  "$schema": "https://raw.githubusercontent.com/baginskicosta/bunpack/main/schema.json",
  "outdir": "dist",
  "rootdir": "source",
  "target": "node",
  "minify": true,
  "sourcemap": "none",
  "splitting": false,
  "packages": "bundle",
  "clean": true,
  "formats": {
    "esm": {
      "enabled": true,
      "directory": "esm",
      "extension": ".js"
    },
    "cjs": {
      "enabled": true,
      "directory": "cjs",
      "extension": ".cjs"
    }
  },
  "entries": [
    {
      "name": "core",
      "entrypoint": "index.ts",
      "default": true
    }
  ],
  "declarations": {
    "enabled": true,
    "directory": "types"
  }
}
```

In this configuration, the library source code is located inside the
`source` directory and all generated files are written to `dist`.

Both supported module formats are enabled. The resulting build will
contain an `ESM` version using the `.js` extension and a `CJS` version
using the `.cjs` extension.

TypeScript declaration generation is also enabled. Declaration files
are written to the `types` directory inside `dist` and use the
`.d.ts` extension.

The `target` is configured as `"node"`, which is recommended for most
libraries intended to be consumed by different JavaScript runtimes.

### Defining Entry Points

The `entries` property defines the modules exposed by the library.\
Each entry contains:

- `name`: Identifies the entry point.
- `entrypoint`: Defines the source file used as the entry point.
- `default`: Determines whether the entry represents the package's
  default export.

For a library containing only one entry point, that entry must be
marked as the default:

```json
{
  "entries": [
    {
      "name": "core",
      "entrypoint": "index.ts",
      "default": true
    }
  ]
}
```

When a library contains multiple entry points, exactly one entry must
be marked as the default:

```json
{
  "entries": [
    {
      "name": "core",
      "entrypoint": "index.ts",
      "default": true
    },
    {
      "name": "extras",
      "entrypoint": "extras/index.ts",
      "default": false
    }
  ]
}
```

In this example, the library exposes two independent modules:
`core` and `extras`.

The default entry represents the package root and is therefore
available through `"."`.\
Additional entries are exposed through their respective subpaths.

The resulting `exports` configuration in `package.json` is equivalent
to:

```json
{
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.cjs"
    },
    "./extras": {
      "types": "./dist/types/extras/index.d.ts",
      "import": "./dist/esm/extras/index.js",
      "require": "./dist/cjs/extras/index.cjs"
    }
  }
}
```

The `name` property of the default entry is ignored when generating
the package root export.\
As a convention, we recommend naming the default entry `"core"` to
make its purpose explicit.

### Entry Point Rules

The `entries` configuration follows a small set of rules:

- A library with a single entry must define that entry as `default`.
- A library with multiple entries must define exactly one default
  entry.
- Defining multiple default entries results in an error.
- Omitting the default entry when multiple entries are defined results
  in an error.
- The default entry is mapped to the package root (`"."`).
- Non-default entries are exposed as package subpaths.

These rules ensure that the generated `exports` configuration remains
unambiguous and predictable.

<!-- * runtime target * -->

## Runtime Target

The `target` property determines which JavaScript runtime the generated
bundle is intended to run on.\
`@baginskicosta/bunpack` currently supports:

```json
{
  "target": "node"
}
```

and:

```json
{
  "target": "bun"
}
```

For most libraries, we recommend using:

```json
{
  "target": "node"
}
```

This provides a more general-purpose output suitable for libraries
that may be consumed by different JavaScript environments.
If the library or tool is specifically designed for [Bun][ex_bun],
the target can instead be configured as:

```json
{
  "target": "bun"
}
```

The `bun` target should generally be preferred when the package is
intended exclusively, or primarily, for Bun-based environments.

<!-- * module formats * -->

## Module Formats

The `formats` property controls which module formats are generated.\
The bundler currently supports:

- `esm`: Generates ECMAScript modules.
- `cjs`: Generates CommonJS modules.

Each format can be independently configured:

```json
{
  "formats": {
    "esm": {
      "enabled": true,
      "directory": "esm",
      "extension": ".js"
    },
    "cjs": {
      "enabled": true,
      "directory": "cjs",
      "extension": ".cjs"
    }
  }
}
```

This allows libraries to expose the same API through both modern
`import` syntax and CommonJS `require` syntax.

<!-- * declarations * -->

## TypeScript Declarations

The `declarations` property controls the generation of TypeScript
declaration files.\
A typical configuration is:

```json
{
  "declarations": {
    "enabled": true,
    "directory": "types"
  }
}
```

The `enabled` property determines whether TypeScript declaration files
should be generated.

The `directory` property defines the directory where generated
declaration files are written. The directory is resolved relative to
the configured `outdir`.

For example, with the following configuration:

```json
{
  "outdir": "dist",
  "declarations": {
    "enabled": true,
    "directory": "types"
  }
}
```

The generated declaration files will be written to the `types`
directory inside `dist`. When declaration generation is enabled,
the generated files preserve the structure of the project's source
entry points.

Declaration generation is handled directly by
`@baginskicosta/bunpack`, so no additional TypeScript build
configuration is required.

<!-- * build * -->

## Building the Library

After installing the package and configuring `bunpack.json`, the
library can be compiled by invoking the CLI from the root directory
of the project.

Using [Bun][ex_bun]:

```bash
bun bunpack
```

Alternatively, you can execute the CLI through `bunx`:

```bash
bunx bunpack
```

If the build completes successfully, all generated files will be
written to the directory configured through `outdir`.\
For example, with:

```json
{
  "outdir": "dist"
}
```

the generated library will be available inside:

```text
dist/
```

The final structure depends on the configured module formats, entry
points, and declaration settings.

<!-- * support my work * -->

## Support My Work

If this this project, or any of my other projects, has been useful to
you, your team, or your company, consider supporting my work.
Maintaining open-source projects take time. Support helps me keep
working on improvements, fixes, documentation, and new features while
continuing to make projects available to everyone.

If you would like to directly support the development of my projects,
tou can become a supported on Patreon:

[![Sponsor on Patreon][badge_patreon]][me_patreon]

Even a small contribution helps. It gives me more time to work on
open-source projects and keep them maintained instead of having to
treat them as something I can only work on in my spare time.

### Follow My Work

You can also follow me on social media. This is another simple way to
support my work, keep up with new projects and content, and help more
developers discover what I am building.

[![Follow on YouTube][badge_youtube]][me_youtube]
[![Follow on Instagram][badge_insta]][me_insta]
[![Follow on Twitch][badge_twitch]][me_twitch]

<!-- * supporters * -->

## Supporters

> Want to support the development of open-source projects?\
> Become a [supporter on Patreon][me_patreon] and have your name or
> company featured in this and future repositories and projects.

I want to sincerely thank everyone who supports my work through
[Patreon][me_patreon]. Your support gives me the time and motivation
to keep building, maintaining, and improving these projects.

Thank you for supporting my work and helping me keep open-source
development moving forward.
