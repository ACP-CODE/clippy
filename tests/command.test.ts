import { describe, expect, it } from 'vitest';
import { Command, createCommand } from '../src';

describe('Command - runtime parsing', () => {
  it('parses simple boolean flag', async () => {
    let captured: { verbose: boolean } | undefined;
    const cmd = new Command('test')
      .option('-v, --verbose', 'verbose')
      .action((opts) => {
        captured = opts;
      });

    await cmd.parseAsync(['--verbose']);
    expect(captured).toEqual({ verbose: true });
  });

  it('parses required-value option with parser and default', async () => {
    const parseInt10 = (v: string) => Number.parseInt(v, 10);

    let captured: { port: number } | undefined;
    const cmd = new Command('test')
      .option('-p, --port <number>', 'port', {
        default: 3000,
        parser: parseInt10,
      })
      .action((opts) => {
        captured = opts;
      });

    await cmd.parseAsync(['--port', '8080']);
    expect(captured?.port).toBe(8080);

    let captured2: { port: number } | undefined;
    const cmd2 = new Command('test')
      .option('-p, --port <number>', 'port', {
        default: 3000,
        parser: parseInt10,
      })
      .action((opts) => {
        captured2 = opts;
      });

    await cmd2.parseAsync([]);
    expect(captured2?.port).toBe(3000);
  });

  it('handles negatable --no-* flags producing camelCased positive key', async () => {
    let captured: { open: boolean } | undefined;
    const cmd = new Command('test')
      .option('--no-open', 'do not open', {})
      .action((opts) => {
        captured = opts;
      });

    await cmd.parseAsync(['--no-open']);
    expect(captured?.open).toBe(false);
  });

  it('handles variadic options', async () => {
    let captured: { envVar: string[] | undefined } | undefined;
    const cmd = new Command('test')
      .option('-e, --env-var <vars...>', 'env vars', {})
      .action((opts) => {
        captured = opts;
      });

    await cmd.parseAsync(['-e', 'A=1', 'B=2', 'C=3']);
    expect(captured?.envVar).toEqual(['A=1', 'B=2', 'C=3']);
  });

  it('converts kebab-case long flags to camelCase keys', async () => {
    let captured: { logLevel: string } | undefined;
    const cmd = new Command('test')
      .option('-l, --log-level <level>', 'log level', { default: 'info' })
      .action((opts) => {
        captured = opts;
      });

    await cmd.parseAsync(['--log-level', 'debug']);
    expect(captured?.logLevel).toBe('debug');
  });

  it('parses positional arguments alongside options', async () => {
    let captured: { file: string; out: string | undefined; opts: { force: boolean } } | undefined;
    const cmd = new Command('test')
      .argument('<file>', 'input')
      .argument('[out]', 'output')
      .option('--force', 'force', {})
      .action((file, out, opts) => {
        captured = { file, out, opts };
      });

    await cmd.parseAsync(['in.txt', 'out.txt', '--force']);
    expect(captured?.file).toBe('in.txt');
    expect(captured?.out).toBe('out.txt');
    expect(captured?.opts.force).toBe(true);
  });

  it('createCommand returns a Command instance', () => {
    const cmd = createCommand('foo');
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('foo');
  });
});
