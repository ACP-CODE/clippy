// ============================================================
// CLIPPY - Demo / Showcase
// Run with: npx tsx examples/demo.ts [command] [args] [options]
// ============================================================

import { Command, prompt } from '../src';

// ─── Parsers (reusable) ──────────────────────────────────────

const parseIntStrict = (value: string): number => {
  const n = parseInt(value, 10);
  if (isNaN(n)) throw new Error(`'${value}' is not an integer`);
  return n;
};

const parseFloat_ = (value: string): number => {
  const n = parseFloat(value);
  if (isNaN(n)) throw new Error(`'${value}' is not a number`);
  return n;
};

const collect = (value: string, prev: string[]): string[] => [...prev, value];

// ─── Root Program ────────────────────────────────────────────

const program = new Command('demo')
  .description('CLIPPY demo app - showcasing modern TypeScript CLI')
  .version('1.0.0')
  .configureHelp({ sortOptions: true });

// ─── `serve` command ─────────────────────────────────────────
// Demonstrates: typed options with parsers, defaults, env vars

const serve = new Command('serve')
  .description('Start a development server', 'Start dev server')
  .option('-p, --port <number>', 'Port to listen on', {
    default: 3000,
    parser: parseIntStrict,
    env: 'PORT',
  })
  .option('-H, --host <string>', 'Hostname to bind', { default: 'localhost' })
  .option('--https', 'Enable HTTPS', {})
  .option('--no-open', 'Do not open browser after start', {})
  .option('-l, --log-level <level>', 'Log level', {
    default: 'info' as 'debug' | 'info' | 'warn' | 'error',
    choices: ['debug', 'info', 'warn', 'error'],
  })
  .action((opts) => {
    // ✅ Full type inference:
    // opts.port       → number        (from parser)
    // opts.host       → string        (has default)
    // opts.https      → boolean       (boolean flag)
    // opts.open       → boolean       (negatable)
    // opts.logLevel   → string        (has default)

    console.log('\n🚀 Starting server...\n');
    console.log('  Port:      ', opts.port);        // number
    console.log('  Host:      ', opts.host);        // string
    console.log('  HTTPS:     ', opts.https);       // boolean
    console.log('  Open:      ', opts.open);        // boolean
    console.log('  Log level: ', opts.logLevel);    // string
    console.log();
  });

// ─── `deploy` command ────────────────────────────────────────
// Demonstrates: required options, variadic options, arguments

const deploy = new Command('deploy')
  .description('Deploy the application to a target environment', 'Deploy to cloud')
  .argument('<env>', 'Target environment', {
    choices: ['staging', 'production', 'dev'],
  })
  .argument('[tag]', 'Docker image tag to deploy', { default: 'latest' })
  .requiredOption('-r, --region <region>', 'AWS region')
  .option('-e, --env-var <vars...>', 'Extra environment variables', {})
  .option('--dry-run', 'Simulate deployment without making changes', {})
  .action((env, tag, opts) => {
    // ✅ Types:
    // env     → string         (required arg, choices-constrained at runtime)
    // tag     → string|undefined  (optional arg)
    // opts.region   → string   (required option, never undefined after parse)
    // opts.envVar   → string[] | undefined  (variadic)
    // opts.dryRun   → boolean

    console.log('\n📦 Deploying...\n');
    console.log('  Environment:', env);
    console.log('  Image tag:  ', tag ?? '(latest)');
    console.log('  Region:     ', opts.region);
    console.log('  Env vars:   ', opts.envVar);
    console.log('  Dry run:    ', opts.dryRun);
    if (opts.dryRun) console.log('\n  [DRY RUN] No changes made.');
    console.log();
  });

// ─── `init` command (interactive) ────────────────────────────
// Demonstrates: interactive prompts, async action

const init = new Command('init')
  .description('Interactively initialize a new project', 'Init project wizard')
  .option('--no-install', 'Skip package installation', {})
  .action(async (opts) => {
    console.log('\n✨ Project Initialization Wizard\n');

    const name = await prompt.text({
      message: 'Project name',
      defaultValue: 'my-app',
      validate: (v) => v.length > 0 || 'Name cannot be empty',
    });

    const description = await prompt.text({
      message: 'Description',
      defaultValue: 'A new project',
    });

    const template = await prompt.select({
      message: 'Choose a template',
      choices: [
        { label: 'TypeScript App', value: 'ts-app' },
        { label: 'REST API (Hono)', value: 'rest-api' },
        { label: 'CLI Tool', value: 'cli-tool' },
        { label: 'Library', value: 'library' },
      ],
      defaultValue: 'ts-app',
    });

    const features = await prompt.multiSelect({
      message: 'Select features',
      choices: [
        { label: 'ESLint', value: 'eslint' },
        { label: 'Prettier', value: 'prettier' },
        { label: 'Vitest', value: 'vitest' },
        { label: 'GitHub Actions', value: 'github-actions' },
        { label: 'Docker', value: 'docker' },
      ],
      defaultValues: ['eslint', 'prettier'],
    });

    const packageManager = await prompt.select({
      message: 'Package manager',
      choices: [
        { label: 'npm', value: 'npm' },
        { label: 'pnpm', value: 'pnpm' },
        { label: 'bun', value: 'bun' },
      ],
    });

    const confirm = await prompt.confirm({
      message: `Create project "${name}"?`,
      defaultValue: true,
    });

    if (!confirm) {
      console.log('\nAborted.');
      return;
    }

    console.log('\n✅ Creating project with:\n');
    console.log('  Name:     ', name);
    console.log('  Desc:     ', description);
    console.log('  Template: ', template);
    console.log('  Features: ', features.join(', '));
    console.log('  Package:  ', packageManager);
    if (!opts.install) console.log('\n  [Skipping package installation]');
    console.log();
  });

// ─── `transform` command ─────────────────────────────────────
// Demonstrates: custom parsers on arguments, number prompt

const transform = new Command('transform')
  .description('Transform a numeric value', 'Number transform')
  .argument('<input>', 'Number to transform', { parser: parseFloat_ })
  .option('-m, --multiply <factor>', 'Multiply by factor', {
    default: 1,
    parser: parseFloat_,
  })
  .option('-a, --add <amount>', 'Add amount', {
    default: 0,
    parser: parseIntStrict,
  })
  .option('-r, --round', 'Round result to integer', {})
  .action((input, opts) => {
    // ✅ Types:
    // input        → number  (from parseFloat_ parser)
    // opts.multiply → number  (from parseFloat_ parser, has default)
    // opts.add      → number  (from parseIntStrict parser, has default)
    // opts.round    → boolean

    let result = (input * opts.multiply) + opts.add;
    if (opts.round) result = Math.round(result);

    console.log(`\n  ${input} × ${opts.multiply} + ${opts.add} = ${result}\n`);
  });

// ─── `ask` command ───────────────────────────────────────────
// Demonstrates: all prompt types interactively

const ask = new Command('ask')
  .description('Demo all interactive prompt types', 'Prompt types demo')
  .action(async (_opts) => {
    console.log('\n🎮 Interactive Prompts Demo\n');

    await prompt.text({ message: 'What is your name?', defaultValue: 'World' });

    await prompt.number({
      message: 'How old are you?',
      min: 1, max: 150,
      validate: (n) => Number.isInteger(n) || 'Please enter a whole number',
    });

    await prompt.password({ message: 'Enter a password', validate: (v) => v.length >= 8 || 'Min 8 characters' });

    await prompt.confirm({ message: 'Do you like TypeScript?', defaultValue: true });

    await prompt.select({
      message: 'Favorite editor',
      choices: [
        { label: 'VS Code', value: 'vscode', },
        { label: 'Neovim', value: 'neovim' },
        { label: 'Zed', value: 'zed' },
        { label: 'Emacs', value: 'emacs' },
      ],
    });

    await prompt.multiSelect({
      message: 'Which languages do you use?',
      choices: [
        { label: 'TypeScript', value: 'ts' },
        { label: 'Rust', value: 'rust' },
        { label: 'Go', value: 'go' },
        { label: 'Python', value: 'python' },
        { label: 'Zig', value: 'zig' },
      ],
    });

    console.log('\n✅ All done!\n');
  });

// ─── Wire up and parse ───────────────────────────────────────

program
  .addCommand(serve)
  .addCommand(deploy)
  .addCommand(init)
  .addCommand(transform)
  .addCommand(ask);

await program.parseAsync(process.argv.slice(2));
