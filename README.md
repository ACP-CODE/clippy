# clippy

> Modern TypeScript-first CLI builder with first-principles `opts` type inference.

A tiny, dependency-free CLI framework with the same builder ergonomics as
`commander`, but with **typed `opts` baked into the core** — no `extra-typings`
bolt-on, no `as const`, no manual generic plumbing. Just write `.option()` and
your `action((opts) => …)` callback receives a fully-typed `opts` object.

```ts
import { Command } from '@acp-code/clippy';

new Command('serve')
  .option('-p, --port <number>', 'port', {
    default: 3000,
    parser: (v) => Number.parseInt(v, 10),
  })
  .option('--no-open', 'do not open browser')
  .option('-l, --log-level <level>', 'log level', { default: 'info' })
  .action((opts) => {
    //        ^? { port: number; open: boolean; logLevel: string }
  })
  .parseAsync();
```

## Features

- Zero runtime dependencies
- Dual ESM + CJS output with proper `exports` map and `.d.ts` / `.d.cts`
- Full type inference for `.option()` / `.requiredOption()` / `.argument()`
  - Required `<value>` vs optional `[value]` vs variadic `<values...>`
  - Negatable `--no-flag` → key without the `no-` prefix
  - kebab-case → camelCase key
  - Parser return type wins
  - `default` removes `undefined` from the value type
- Built-in interactive prompts (`prompt.text`, `prompt.select`, …)

## Installation

```sh
pnpm add @acp-code/clippy
```

## Project layout

```
src/
  index.ts       # public entrypoint
  command.ts     # Command builder
  types.ts       # type-level inference machinery
  prompts.ts     # readline-based prompts
  help.ts        # help formatter
tests/
  command.test.ts        # runtime parsing tests (vitest)
  opts-types.test-d.ts   # type-level tests for `opts` inference
examples/
  demo.ts        # runnable demo (pnpm demo)
```

## Scripts

| Command           | What it does                                    |
| ----------------- | ----------------------------------------------- |
| `pnpm build`      | bundle ESM + CJS + types via `tsup`             |
| `pnpm dev`        | `tsup --watch`                                  |
| `pnpm demo`       | run `examples/demo.ts` via `tsx`                |
| `pnpm typecheck`  | `tsc --noEmit`                                  |
| `pnpm test`       | runtime + type-level tests via `vitest`         |
| `pnpm test:types` | only type-level tests (`vitest --typecheck.only`) |
| `pnpm test:watch` | `vitest` watch mode                             |
| `pnpm clean`      | remove `dist/` and `coverage/`                  |

## Module formats

`exports` is configured for Node + bundlers:

```jsonc
{
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  }
}
```

This means consumers get correct types under both `import` and `require`,
including with `"moduleResolution": "Node16" | "NodeNext" | "Bundler"`.

## License

MIT
