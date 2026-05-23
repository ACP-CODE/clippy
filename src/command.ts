// ============================================================
// CLIPPY - Command Class
// Type inference from first principles, no bolt-on typings
// ============================================================

import { formatHelp, type HelpConfig, type SubcommandInfo } from './help';
import { ansi } from './prompts';
import type {
  OptionDef, ArgDef, OptsMap, AddOption,
  ActionHandler,
} from './types';

// ─── Errors ──────────────────────────────────────────────────

export class ClippyError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'clippy.error',
    public readonly exitCode: number = 1,
  ) {
    super(message);
    this.name = 'ClippyError';
  }
}

// ─── Parse Result ────────────────────────────────────────────

interface ParsedArgs {
  args: string[];
  rawArgs: string[];
}

// ─── Command ─────────────────────────────────────────────────

/**
 * Command<Opts, Args>
 *
 * Opts - accumulated options map, grows with each .option() call
 * Args - tuple of argument types, grows with each .argument() call
 *
 * The class itself is the "builder": calling .option() returns a new
 * Command with a richer Opts type. This is the same strategy as
 * extra-typings, but baked in from the start.
 */
export class Command<
  Opts extends OptsMap = Record<never, never>,
  Args extends unknown[] = [],
> {
  private _name: string;
  private _description: string = '';
  private _summary: string = '';
  private _version?: string;
  private _aliases: string[] = [];
  private _options: OptionDef[] = [];
  private _args: ArgDef[] = [];
  private _subcommands: Map<string, Command<any, any>> = new Map();
  private _action?: ActionHandler<Args, Opts>;
  private _parent?: Command<any, any>;
  private _helpConfig: HelpConfig = {};
  private _allowUnknownOptions = false;
  private _allowExcessArgs = false;
  private _passthroughOptions = false;
  private _hidden = false;
  private _hooks: {
    preAction?: Array<(cmd: Command<any, any>) => void | Promise<void>>;
    postAction?: Array<(cmd: Command<any, any>) => void | Promise<void>>;
    preSubcommand?: Array<(parent: Command<any, any>, sub: Command<any, any>) => void | Promise<void>>;
  } = {};

  // Stored option/arg values after parse
  private _optionValues: Record<string, unknown> = {};
  private _argValues: unknown[] = [];

  constructor(name: string) {
    this._name = name;
  }

  // ── Meta ────────────────────────────────────────────────────

  name(): string;
  name(n: string): this;
  name(n?: string): this | string {
    if (n !== undefined) { this._name = n; return this as any; }
    return this._name as any;
  }

  description(d: string, summary?: string): this {
    this._description = d;
    if (summary) this._summary = summary;
    return this;
  }

  summary(s: string): this {
    this._summary = s;
    return this;
  }

  version(v: string, flags = '-V, --version', desc = 'Print version'): this {
    this._version = v;
    // Add as a special option
    this._options.push({
      flags,
      description: desc,
      defaultValue: undefined,
      parser: undefined,
      required: false,
      hidden: false,
    });
    return this;
  }

  alias(...aliases: string[]): this {
    this._aliases.push(...aliases);
    return this;
  }

  hidden(h = true): this {
    this._hidden = h;
    return this;
  }

  configureHelp(config: HelpConfig): this {
    this._helpConfig = { ...this._helpConfig, ...config };
    return this;
  }

  // ── Options ─────────────────────────────────────────────────

  /**
   * Add an option. Returns Command with enriched Opts type.
   *
   * @example
   * cmd.option('-p, --port <number>', 'port', { default: 3000 })
   * // opts.port: number (inferred from default type via ParseInt parser)
   */
  option<
    F extends string,
    Default = undefined,
    Parser = undefined,
  >(
    flags: F,
    description: string,
    config?: {
      default?: Default;
      parser?: Parser extends ((v: string, p: any) => any) ? Parser : never;
      env?: string;
      choices?: string[];
      hidden?: boolean;
      group?: string;
    }
  ): Command<AddOption<Opts, F, Default, Parser>, Args> {
    this._options.push({
      flags,
      description,
      defaultValue: config?.default,
      parser: config?.parser,
      required: false,
      hidden: config?.hidden ?? false,
      envVar: config?.env,
      choices: config?.choices,
      group: config?.group,
    });
    return this as any;
  }

  /**
   * Add a required option. If absent, parse() will throw.
   */
  requiredOption<
    F extends string,
    Default = undefined,
    Parser = undefined,
  >(
    flags: F,
    description: string,
    config?: {
      default?: Default;
      parser?: Parser extends ((v: string, p: any) => any) ? Parser : never;
      env?: string;
      choices?: string[];
      group?: string;
    }
  ): Command<AddOption<Opts, F, Default, Parser>, Args> {
    this._options.push({
      flags,
      description,
      defaultValue: config?.default,
      parser: config?.parser,
      required: true,
      hidden: false,
      envVar: config?.env,
      choices: config?.choices,
      group: config?.group,
    });
    return this as any;
  }

  // ── Arguments ───────────────────────────────────────────────

  /**
   * Add a positional argument. Infers type into the Args tuple.
   *
   * @example
   * cmd.argument('<file>', 'input file')
   *    .argument('[output]', 'output file')
   *    .action((file, output, opts) => {
   *      // file: string, output: string | undefined
   *    })
   */
  argument<
    N extends string,
    Parser = undefined,
  >(
    name: N,
    description: string,
    config?: {
      default?: unknown;
      parser?: Parser extends ((v: string, p: any) => any) ? Parser : never;
      choices?: string[];
      group?: string;
    }
  ): Command<Opts, [...Args, ...(Parser extends (v: string, p: any) => infer R ? [R] : N extends `<${string}...>` | `[${string}...]` ? [string[]] : N extends `<${string}>` ? [string] : [string | undefined])]> {
    this._args.push({
      name,
      description,
      parser: config?.parser,
      defaultValue: config?.default,
      choices: config?.choices,
      group: config?.group,
    });
    return this as any;
  }

  // ── Subcommands ──────────────────────────────────────────────

  addCommand(cmd: Command<any, any>): this {
    cmd._parent = this;
    const names = [cmd._name, ...cmd._aliases];
    for (const n of names) this._subcommands.set(n, cmd);
    return this;
  }

  command(name: string, description?: string): Command<Record<never, never>, []> {
    const cmd = new Command(name);
    if (description) cmd.description(description);
    this.addCommand(cmd);
    return cmd;
  }

  // ── Action ──────────────────────────────────────────────────

  action(fn: ActionHandler<Args, Opts>): this {
    this._action = fn;
    return this;
  }

  // ── Hooks ───────────────────────────────────────────────────

  hook(
    event: 'preAction' | 'postAction' | 'preSubcommand',
    fn: (cmd: Command<any, any>, sub?: Command<any, any>) => void | Promise<void>
  ): this {
    if (!this._hooks[event]) this._hooks[event] = [] as any;
    (this._hooks[event] as any[]).push(fn);
    return this;
  }

  // ── Parsing Config ───────────────────────────────────────────

  allowUnknownOption(allow = true): this {
    this._allowUnknownOptions = allow;
    return this;
  }

  allowExcessArguments(allow = true): this {
    this._allowExcessArgs = allow;
    return this;
  }

  passThroughOptions(pass = true): this {
    this._passthroughOptions = pass;
    return this;
  }

  // ── Parse ───────────────────────────────────────────────────

  async parseAsync(argv?: string[]): Promise<this> {
    const args = argv ?? process.argv.slice(2);
    await this._parse(args);
    return this;
  }

  parse(argv?: string[]): this {
    const args = argv ?? process.argv.slice(2);
    // Sync parse - run async and handle
    const result = this._parse(args);
    if (result instanceof Promise) {
      // If action is async, user should use parseAsync
      // But we'll handle it gracefully
    }
    return this;
  }

  private async _parse(rawArgs: string[]): Promise<void> {
    // Check for --version
    if (this._version) {
      if (rawArgs.includes('--version') || rawArgs.includes('-V')) {
        process.stdout.write(`${this._version}\n`);
        process.exit(0);
      }
    }

    // Route to subcommand FIRST so subcommands get their own --help
    const [firstArg, ...rest] = rawArgs;
    if (firstArg && !firstArg.startsWith('-')) {
      // Check for built-in help command
      if (firstArg === 'help') {
        this._handleHelpCommand(rest);
        return;
      }

      const sub = this._subcommands.get(firstArg);
      if (sub) {
        if (this._hooks.preSubcommand) {
          for (const fn of this._hooks.preSubcommand) await fn(this, sub);
        }
        await sub._parse(rest);
        return;
      }
    }

    // Check for help flags (after subcommand routing)
    if (rawArgs.includes('--help')) {
      process.stdout.write(this.helpText({ detailed: true }));
      process.exit(0);
    }
    if (rawArgs.includes('-h')) {
      process.stdout.write(this.helpText({ detailed: false }));
      process.exit(0);
    }

    // Parse options and args
    this._parseOptionsAndArgs(rawArgs);

    // Apply env vars
    this._applyEnv();

    // Apply defaults
    this._applyDefaults();

    // Validate required options
    this._validateRequired();

    // Run action
    if (this._action) {
      // Run preAction hooks
      if (this._hooks.preAction) {
        for (const fn of this._hooks.preAction) await fn(this);
      }

      // Build action params: spread args then opts
      const opts = this.opts() as Opts;
      const actionArgs = [...this._argValues, opts] as [...Args, Opts];
      await (this._action as (...args: unknown[]) => Promise<void> | void)(...actionArgs);

      // Run postAction hooks
      if (this._hooks.postAction) {
        for (const fn of this._hooks.postAction) await fn(this);
      }
    } else if (rawArgs.length > 0 && this._subcommands.size > 0) {
      this._error(`Unknown command: '${rawArgs[0]}'`, 'clippy.unknownCommand');
    } else if (this._subcommands.size > 0) {
      // No action and no subcommand specified: show help
      process.stdout.write(this.helpText({ detailed: true }));
    }
  }

  /** Handle the built-in help command: help [command] */
  private _handleHelpCommand(args: string[]): void {
    if (args.length === 0) {
      // help - show full help for this command
      process.stdout.write(this.helpText({ detailed: true }));
      process.exit(0);
      return;
    }

    const [targetName, ...remaining] = args;
    if (!targetName) {
      process.stdout.write(this.helpText({ detailed: true }));
      process.exit(0);
      return;
    }

    const targetCmd = this._subcommands.get(targetName);

    if (targetCmd) {
      // Check for help subcommand on the target
      if (remaining[0] === 'help') {
        process.stdout.write(targetCmd.helpText({ detailed: true }));
        process.exit(0);
        return;
      }

      // Check for -h or --help on target
      if (remaining.includes('--help')) {
        process.stdout.write(targetCmd.helpText({ detailed: true }));
        process.exit(0);
        return;
      }
      if (remaining.includes('-h')) {
        process.stdout.write(targetCmd.helpText({ detailed: false }));
        process.exit(0);
        return;
      }

      // Show detailed help for target command
      process.stdout.write(targetCmd.helpText({ detailed: true }));
      process.exit(0);
      return;
    }

    // Unknown command
    process.stderr.write(`${ansi.c(ansi.red, 'error')}: unknown command '${targetName}'\n`);
    process.stderr.write(this.helpText({ detailed: false }));
    process.exit(1);
  }

  private _parseOptionsAndArgs(rawArgs: string[]): void {
    const optionsByFlag = this._buildFlagMap();
    const positionals: string[] = [];
    let i = 0;
    const remaining: string[] = [];

    while (i < rawArgs.length) {
      const arg = rawArgs[i]!;

      if (arg === '--') {
        // Everything after -- is positional
        remaining.push(...rawArgs.slice(i + 1));
        break;
      }

      if (arg.startsWith('--')) {
        const eqIdx = arg.indexOf('=');
        const flag = eqIdx !== -1 ? arg.slice(0, eqIdx) : arg;
        const inlineValue = eqIdx !== -1 ? arg.slice(eqIdx + 1) : undefined;

        const optMeta = optionsByFlag.get(flag);
        if (!optMeta) {
          if (!this._allowUnknownOptions) {
            this._error(`Unknown option: '${flag}'`, 'clippy.unknownOption');
          }
          positionals.push(arg);
          i++;
          continue;
        }

        if (optMeta.isVariadic) {
          const values: string[] = inlineValue ? [inlineValue] : [];
          while (i + 1 < rawArgs.length && !rawArgs[i + 1]!.startsWith('-')) {
            values.push(rawArgs[++i]!);
          }
          this._setOption(optMeta.key, values, optMeta.def);
        } else if (optMeta.takesValue) {
          const value = inlineValue ?? rawArgs[++i];
          if (value === undefined || value.startsWith('-')) {
            this._error(`Option '${flag}' requires a value`, 'clippy.missingValue');
          }
          this._setOption(optMeta.key, value, optMeta.def);
        } else if (optMeta.isNegatable) {
          this._optionValues[optMeta.key] = false;
        } else {
          // Boolean flag
          this._setOption(optMeta.key, true, optMeta.def);
        }
      } else if (arg.startsWith('-') && arg.length > 1) {
        // Short flags, possibly combined: -dsp cheese
        const chars = arg.slice(1);

        for (let ci = 0; ci < chars.length; ci++) {
          const short = `-${chars[ci]}`;
          const optMeta = optionsByFlag.get(short);

          if (!optMeta) {
            if (!this._allowUnknownOptions) {
              this._error(`Unknown option: '${short}'`, 'clippy.unknownOption');
            }
            break;
          }

          if (optMeta.isVariadic) {
            const rest = chars.slice(ci + 1);
            const values: string[] = rest.length > 0 ? [rest] : [];
            while (i + 1 < rawArgs.length && !rawArgs[i + 1]!.startsWith('-')) {
              values.push(rawArgs[++i]!);
            }
            this._setOption(optMeta.key, values, optMeta.def);
            break;
          } else if (optMeta.takesValue) {
            // Remaining chars after this one are the value, or next arg
            const rest = chars.slice(ci + 1);
            const value = rest.length > 0 ? rest : rawArgs[++i];
            if (!value) {
              this._error(`Option '${short}' requires a value`, 'clippy.missingValue');
            }
            this._setOption(optMeta.key, value, optMeta.def);
            break;
          } else {
            this._setOption(optMeta.key, true, optMeta.def);
          }
        }
      } else {
        positionals.push(arg);
      }

      i++;
    }

    // Process positional arguments
    const argDefs = this._args;
    let ai = 0;
    for (let pi = 0; pi < positionals.length || ai < argDefs.length; ) {
      const def = argDefs[ai];
      if (!def) {
        if (!this._allowExcessArgs) {
          this._error(`Too many arguments. Expected ${argDefs.length}, got ${positionals.length}`, 'clippy.excessArgs');
        }
        break;
      }

      const isVariadic = def.name.includes('...');
      if (isVariadic) {
        const values = positionals.slice(pi);
        if (def.parser) {
          this._argValues[ai] = values.map(v => (def.parser as (v: string, p: unknown) => unknown)(v, undefined));
        } else {
          this._argValues[ai] = values;
        }
        break;
      }

      const val = positionals[pi];
      if (val === undefined) {
        if (def.name.startsWith('<')) {
          this._error(`Missing required argument: ${def.name}`, 'clippy.missingArg');
        }
        this._argValues[ai] = def.defaultValue;
      } else {
        if (def.choices && !def.choices.includes(val)) {
          this._error(
            `Invalid value for argument '${def.name}': '${val}'. Expected one of: ${def.choices.join(', ')}`,
            'clippy.invalidChoice'
          );
        }
        this._argValues[ai] = def.parser ? (def.parser as (v: string, p: unknown) => unknown)(val, undefined) : val;
        pi++;
      }
      ai++;
    }
  }

  private _buildFlagMap(): Map<string, {
    key: string;
    def: OptionDef;
    takesValue: boolean;
    isNegatable: boolean;
    isVariadic: boolean;
  }> {
    const map = new Map();

    for (const opt of this._options) {
      const flags = opt.flags.split(/,\s*|\||\s+/).map(f => f.trim()).filter(f => f.startsWith('-'));
      const longFlag = flags.find(f => f.startsWith('--')) ?? flags[0]!;

      // Extract key from long flag
      const longName = longFlag.replace(/^--/, '').split(' ')[0]!;
      const isNeg = longName.startsWith('no-');
      const rawName = isNeg ? longName.slice(3) : longName;
      const key = rawName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

      const takesValue = opt.flags.includes('<') || (opt.flags.includes('[') && !opt.flags.includes('...'));
      const isVariadic = opt.flags.includes('...');

      const meta = { key, def: opt, takesValue, isNegatable: isNeg, isVariadic };

      for (const f of flags) {
        const flagKey = f.split(' ')[0]!.split('=')[0]!;
        map.set(flagKey, meta);
      }
    }

    return map;
  }

  private _setOption(key: string, rawValue: unknown, def: OptionDef): void {
    if (def.parser && typeof rawValue === 'string') {
      const prev = this._optionValues[key];
      this._optionValues[key] = (def.parser as (v: string, p: unknown) => unknown)(rawValue as string, prev);
    } else if (def.choices && typeof rawValue === 'string' && !def.choices.includes(rawValue)) {
      this._error(
        `Invalid value for option '${def.flags}': '${rawValue}'. Expected: ${def.choices.join(', ')}`,
        'clippy.invalidChoice'
      );
    } else {
      this._optionValues[key] = rawValue;
    }
  }

  private _applyEnv(): void {
    for (const opt of this._options) {
      if (!opt.envVar) continue;
      const key = this._flagToKey(opt.flags);
      if (this._optionValues[key] !== undefined) continue;
      const envVal = process.env[opt.envVar];
      if (envVal !== undefined) {
        this._setOption(key, envVal, opt);
      }
    }
  }

  private _applyDefaults(): void {
    for (const opt of this._options) {
      const key = this._flagToKey(opt.flags);
      if (this._optionValues[key] !== undefined) continue;

      // Boolean flags default to false
      if (!opt.flags.includes('<') && !opt.flags.includes('[')) {
        this._optionValues[key] = opt.defaultValue ?? false;
      } else if (opt.defaultValue !== undefined) {
        this._optionValues[key] = opt.defaultValue;
      }
    }
  }

  private _validateRequired(): void {
    for (const opt of this._options) {
      if (!opt.required) continue;
      const key = this._flagToKey(opt.flags);
      if (this._optionValues[key] === undefined || this._optionValues[key] === false) {
        this._error(`Required option '${opt.flags}' was not provided`, 'clippy.requiredOption');
      }
    }
  }

  private _flagToKey(flags: string): string {
    const parts = flags.split(/,\s*|\||\s+/).map(f => f.trim());
    const longFlag = parts.find(f => f.startsWith('--')) ?? parts[0]!;
    const longName = longFlag.replace(/^--/, '').split(/[\s<[]/)[0]!;
    const isNeg = longName.startsWith('no-');
    const rawName = isNeg ? longName.slice(3) : longName;
    return rawName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  }

  // ── Accessors ───────────────────────────────────────────────

  opts(): Opts {
    return { ...this._optionValues } as Opts;
  }

  getOptionValue<K extends keyof Opts>(key: K): Opts[K] {
    return this._optionValues[key as string] as Opts[K];
  }

  setOptionValue<K extends keyof Opts>(key: K, value: Opts[K]): this {
    this._optionValues[key as string] = value;
    return this;
  }

  processedArgs(): Args {
    return this._argValues as Args;
  }

  // ── Error Handling ───────────────────────────────────────────

  private _error(message: string, code: string, exitCode = 1): never {
    process.stderr.write(`${ansi.c(ansi.red, 'error')}: ${message}\n`);
    process.stderr.write(ansi.c(ansi.gray, `Run '${this._getFullName()} -h' for usage.\n`));
    process.exit(exitCode);
  }

  error(message: string, options?: { exitCode?: number; code?: string }): never {
    this._error(message, options?.code ?? 'clippy.error', options?.exitCode ?? 1);
  }

  private _getFullName(): string {
    const names: string[] = [this._name];
    let p = this._parent;
    while (p) { names.unshift(p._name); p = p._parent; }
    return names.join(' ');
  }

  // ── Help ─────────────────────────────────────────────────────

  helpText(options?: { detailed?: boolean }): string {
    const subcommandInfos: SubcommandInfo[] = [];
    const seen = new Set<Command<any, any>>();
    for (const [, cmd] of this._subcommands) {
      if (seen.has(cmd)) continue;
      seen.add(cmd);
      subcommandInfos.push({
        name: cmd._name,
        description: cmd._summary || cmd._description,
        aliases: cmd._aliases,
        hidden: cmd._hidden,
        group: cmd._helpConfig.groupOrder ? undefined : undefined,
        options: cmd._options,
        args: cmd._args,
      });
    }

    const parentNames: string[] = [];
    let p = this._parent;
    while (p) { parentNames.unshift(p._name); p = p._parent; }

    return formatHelp({
      name: this._name,
      version: this._version,
      description: this._description,
      options: this._options,
      args: this._args,
      subcommands: subcommandInfos,
      helpConfig: this._helpConfig,
      parentNames,
      detailed: options?.detailed ?? true,
    });
  }

  outputHelp(options?: { detailed?: boolean }): void {
    process.stdout.write(this.helpText(options));
  }
}
