import { describe, expect, it } from 'vitest';
import { Command } from '../src';

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

  it('shows Commands: section header', async () => {
    const cmd = new Command('test')
      .addCommand(new Command('sub').description('A subcommand'));

    const help = cmd.helpText({ detailed: true });
    expect(help).toContain('Commands:');
  });
});