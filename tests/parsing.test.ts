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

describe('Command - help system', () => {
  it('shows brief help on -h (no Arguments, no option hints)', async () => {
    const subCmd = new Command('sub')
      .description('A subcommand')
      .argument('<env>', 'environment', { choices: ['dev', 'prod'] })
      .option('-v, --verbose', 'verbose output');

    const cmd = new Command('test')
      .description('A test command')
      .argument('<env>', 'environment', { choices: ['dev', 'prod'] })
      .option('-p, --port <port>', 'port number', { default: 3000 })
      .addCommand(subCmd);

    const briefHelp = cmd.helpText({ detailed: false });
    // Brief mode should NOT include Arguments section
    expect(briefHelp).not.toContain('Arguments:');
    // Brief mode should NOT include option hints (default, choices, etc)
    expect(briefHelp).not.toContain('default:');
    expect(briefHelp).not.toContain('choices:');
    // Brief mode should still include Options
    expect(briefHelp).toContain('Options:');
    // Brief mode should include command name (without usage in brief mode)
    expect(briefHelp).toContain('sub');
    // Brief mode: sub command should NOT have [options] or args
    expect(briefHelp).toContain('sub          A subcommand');
    // Brief hint should use -h
    expect(briefHelp).toContain('[command] -h');
  });

  it('shows detailed help on --help (with Arguments and option hints)', async () => {
    const subCmd = new Command('sub')
      .description('A subcommand')
      .argument('<env>', 'environment', { choices: ['dev', 'prod'] })
      .option('-v, --verbose', 'verbose output');

    const cmd = new Command('test')
      .description('A test command')
      .argument('<env>', 'environment', { choices: ['dev', 'prod'] })
      .option('-p, --port <port>', 'port number', { default: 3000 })
      .addCommand(subCmd);

    const detailedHelp = cmd.helpText({ detailed: true });
    // Detailed mode should include Arguments section
    expect(detailedHelp).toContain('Arguments:');
    // Detailed mode should include option hints
    expect(detailedHelp).toContain('default:');
    expect(detailedHelp).toContain('choices:');
    // Detailed mode should include Options
    expect(detailedHelp).toContain('Options:');
    // Detailed mode should show command with usage snippet (using subcommand's own options/args)
    expect(detailedHelp).toContain('sub [options] <env>');
    // Detailed hint should use --help
    expect(detailedHelp).toContain('[command] --help');
  });

  it('groups options by group property', async () => {
    const cmd = new Command('test')
      .option('-p, --port <port>', 'port', { group: 'Server' })
      .option('--host <host>', 'host', { group: 'Server' })
      .option('-v, --verbose', 'verbose', { group: 'Output' })
      .configureHelp({ groupOrder: ['Server', 'Output'] });

    const help = cmd.helpText({ detailed: true });
    expect(help).toContain('Server');
    expect(help).toContain('Output');
  });

  it('adds group to arguments', async () => {
    const cmd = new Command('test')
      .argument('<file>', 'input file', { group: 'Input' })
      .argument('[out]', 'output file', { group: 'Output' })
      .configureHelp({ groupOrder: ['Input', 'Output'] });

    const help = cmd.helpText({ detailed: true });
    expect(help).toContain('Input');
    expect(help).toContain('Output');
  });
});
