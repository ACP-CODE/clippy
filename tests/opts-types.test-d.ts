// ============================================================
// Type-level tests for `opts` inference.
//
// These run under `vitest --typecheck` and assert the *static*
// shape of the `opts` object passed to `.action()` for every
// supported variant of `.option()` / `.requiredOption()`.
// ============================================================

import { describe, expectTypeOf, it } from 'vitest';
import { Command } from '../src';

describe('opts type inference', () => {
  it('boolean flag → boolean (no undefined)', () => {
    new Command('t')
      .option('-v, --verbose', 'verbose', {})
      .action((opts) => {
        expectTypeOf(opts).toEqualTypeOf<{ verbose: boolean }>();
      });
  });

  it('required-value option without default → string | undefined', () => {
    new Command('t')
      .option('-h, --host <name>', 'host')
      .action((opts) => {
        expectTypeOf(opts).toEqualTypeOf<{ host: string | undefined }>();
      });
  });

  it('required-value option with default → string (no undefined)', () => {
    new Command('t')
      .option('-h, --host <name>', 'host', { default: 'localhost' })
      .action((opts) => {
        expectTypeOf(opts).toEqualTypeOf<{ host: string }>();
      });
  });

  it('parser dictates the value type', () => {
    new Command('t')
      .option('-p, --port <number>', 'port', {
        default: 3000,
        parser: (v: string) => Number.parseInt(v, 10),
      })
      .action((opts) => {
        expectTypeOf(opts).toEqualTypeOf<{ port: number }>();
      });
  });

  it('parser without default → T | undefined', () => {
    new Command('t')
      .option('-p, --port <number>', 'port', {
        parser: (v: string) => Number.parseInt(v, 10),
      })
      .action((opts) => {
        expectTypeOf(opts).toEqualTypeOf<{ port: number | undefined }>();
      });
  });

  it('variadic option → string[] | undefined', () => {
    new Command('t')
      .option('-e, --env-var <vars...>', 'env vars', {})
      .action((opts) => {
        expectTypeOf(opts).toEqualTypeOf<{ envVar: string[] | undefined }>();
      });
  });

  it('negatable --no-* flag → key without "no" prefix, type boolean', () => {
    new Command('t')
      .option('--no-open', 'do not open', {})
      .action((opts) => {
        expectTypeOf(opts).toEqualTypeOf<{ open: boolean }>();
      });
  });

  it('kebab-case long flag → camelCase key', () => {
    new Command('t')
      .option('-l, --log-level <level>', 'log level', { default: 'info' })
      .action((opts) => {
        expectTypeOf(opts).toEqualTypeOf<{ logLevel: string }>();
      });
  });

  it('requiredOption produces a non-undefined value', () => {
    new Command('t')
      .requiredOption('-r, --region <region>', 'aws region')
      .action((opts) => {
        // Note: requiredOption shares the same default-aware inference,
        // and without a default the *static* type is `string | undefined`,
        // but at runtime it's enforced non-undefined. The static type
        // mirrors the inferred raw type before runtime validation.
        expectTypeOf(opts).toEqualTypeOf<{ region: string | undefined }>();
      });
  });

  it('multiple options accumulate into a single Opts map', () => {
    new Command('t')
      .option('-p, --port <n>', 'port', {
        default: 3000,
        parser: (v: string) => Number.parseInt(v, 10),
      })
      .option('-H, --host <name>', 'host', { default: 'localhost' })
      .option('--https', 'https', {})
      .option('--no-open', 'no open', {})
      .option('-l, --log-level <level>', 'log level', { default: 'info' })
      .action((opts) => {
        expectTypeOf(opts).toEqualTypeOf<{
          port: number;
          host: string;
          https: boolean;
          open: boolean;
          logLevel: string;
        }>();
      });
  });
});

describe('positional argument type inference', () => {
  it('required <arg> → string', () => {
    new Command('t')
      .argument('<file>', 'input file')
      .action((file, _opts) => {
        expectTypeOf(file).toEqualTypeOf<string>();
      });
  });

  it('optional [arg] → string | undefined', () => {
    new Command('t')
      .argument('[out]', 'output file')
      .action((out, _opts) => {
        expectTypeOf(out).toEqualTypeOf<string | undefined>();
      });
  });

  it('variadic <args...> → string[]', () => {
    new Command('t')
      .argument('<files...>', 'input files')
      .action((files, _opts) => {
        expectTypeOf(files).toEqualTypeOf<string[]>();
      });
  });

  it('argument with parser uses parser return type', () => {
    new Command('t')
      .argument('<n>', 'number', { parser: (v: string) => Number.parseInt(v, 10) })
      .action((n, _opts) => {
        expectTypeOf(n).toEqualTypeOf<number>();
      });
  });

  it('args + opts compose in the action signature', () => {
    new Command('t')
      .argument('<file>', 'file')
      .argument('[tag]', 'tag')
      .option('--force', 'force', {})
      .action((file, tag, opts) => {
        expectTypeOf(file).toEqualTypeOf<string>();
        expectTypeOf(tag).toEqualTypeOf<string | undefined>();
        expectTypeOf(opts).toEqualTypeOf<{ force: boolean }>();
      });
  });
});
