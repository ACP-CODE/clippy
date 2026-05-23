// ============================================================
// CLIPPY - Help Formatter
// ============================================================

import type { ArgDef, OptionDef } from './types';

import { ansi } from './prompts';

export interface HelpConfig {
  width?: number;
  sortOptions?: boolean;
  sortCommands?: boolean;
  showGlobalOptions?: boolean;
  /** Group order for options/args/commands display, ungrouped items appear last */
  groupOrder?: string[];
  /** Show all options/args in -h mode (false = brief mode only) */
  showAllOnBrief?: boolean;
  styles?: {
    title?: (s: string) => string;
    usage?: (s: string) => string;
    description?: (s: string) => string;
    optionFlag?: (s: string) => string;
    optionDesc?: (s: string) => string;
    commandName?: (s: string) => string;
    commandDesc?: (s: string) => string;
    argName?: (s: string) => string;
    hint?: (s: string) => string;
    error?: (s: string) => string;
    groupTitle?: (s: string) => string;
  };
}

// const DEFAULT_STYLES: Required<NonNullable<HelpConfig['styles']>> = {
//   title: (s) => `${ansi.bold}${ansi.yellow}${s}${ansi.reset}`,
//   usage: (s) => `${ansi.cyan}${s}${ansi.reset}`,
//   description: (s) => s,
//   optionFlag: (s) => `${ansi.green}${s}${ansi.reset}`,
//   optionDesc: (s) => `${ansi.gray}${s}${ansi.reset}`,
//   commandName: (s) => `${ansi.cyan}${s}${ansi.reset}`,
//   commandDesc: (s) => `${ansi.gray}${s}${ansi.reset}`,
//   argName: (s) => `${ansi.magenta}${s}${ansi.reset}`,
//   hint: (s) => `${ansi.gray}${s}${ansi.reset}`,
//   error: (s) => `${ansi.red}${s}${ansi.reset}`,
// };

const DEFAULT_STYLES: Required<NonNullable<HelpConfig['styles']>> = {
  title: (s) => s,
  usage: (s) => s,
  description: (s) => s,
  optionFlag: (s) => s,
  optionDesc: (s) => s,
  commandName: (s) => s,
  commandDesc: (s) => s,
  argName: (s) => s,
  hint: (s) => `${ansi.gray}${s}${ansi.reset}`,
  error: (s) => `${ansi.red}${s}${ansi.reset}`,
  groupTitle: (s) => `${ansi.bold}${s}${ansi.reset}`,
};


function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function padEnd(s: string, len: number): string {
  const visible = stripAnsi(s).length;
  return s + ' '.repeat(Math.max(0, len - visible));
}

function wrapText(text: string, indent: number, width: number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  const maxWidth = width - indent;

  for (const word of words) {
    if (current.length + word.length + 1 > maxWidth && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = current.length === 0 ? word : `${current} ${word}`;
    }
  }
  if (current) lines.push(current);

  return lines.join('\n' + ' '.repeat(indent));
}

export interface SubcommandInfo {
  name: string;
  description: string;
  aliases: string[];
  hidden: boolean;
  group?: string;
}

/** Group items by their group property, returning ordered sections */
function groupItems<T extends { group?: string }>(
  items: T[],
  groupOrder: string[]
): Map<string | undefined, T[]> {
  const groups = new Map<string | undefined, T[]>();

  for (const item of items) {
    const group = item.group;
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(item);
  }

  return groups;
}

/** Sort groups according to groupOrder, ungrouped items last */
function sortGroups<T extends { group?: string }>(
  groupedItems: Map<string | undefined, T[]>,
  groupOrder: string[]
): Array<{ group: string | undefined; items: T[] }> {
  const result: Array<{ group: string | undefined; items: T[] }> = [];

  // First add ordered groups
  for (const groupName of groupOrder) {
    if (groupedItems.has(groupName)) {
      result.push({ group: groupName, items: groupedItems.get(groupName)! });
    }
  }

  // Then add ungrouped items (group = undefined)
  if (groupedItems.has(undefined)) {
    result.push({ group: undefined, items: groupedItems.get(undefined)! });
  }

  return result;
}

export function formatHelp(config: {
  name: string;
  version?: string;
  description?: string;
  usage?: string;
  options: OptionDef[];
  args: ArgDef[];
  subcommands: SubcommandInfo[];
  globalOptions?: OptionDef[];
  helpConfig?: HelpConfig;
  parentNames?: string[];
  /** When false (-h), omit Options section; true (--help) shows all */
  detailed?: boolean;
}): string {
  const {
    name, version, description, options, args, subcommands,
    globalOptions = [], helpConfig = {}, parentNames = [],
    detailed = true,
  } = config;

  const styles = { ...DEFAULT_STYLES, ...(helpConfig.styles ?? {}) };
  const width = helpConfig.width ?? (process.stdout.columns ?? 80);
  const lines: string[] = [];
  const groupOrder = helpConfig.groupOrder ?? [];
  const showAllOnBrief = helpConfig.showAllOnBrief ?? false;

  const fullName = [...parentNames, name].join(' ');

  // ── Description ──
  if (description) {
    lines.push(styles.description(description));
    lines.push('');
  }

  // ── Usage ──
  const usageParts = [fullName];
  if (options.length > 0) usageParts.push('[options]');
  if (subcommands.length > 0) usageParts.push('[command]');
  args.forEach(a => usageParts.push(a.name));

  const usageStr = config.usage ?? usageParts.join(' ');
  lines.push(styles.title('Usage:'));
  lines.push(`  ${styles.usage(usageStr)}`);
  lines.push('');

  // ── Arguments (always show) ──
  const visibleArgs = args.filter(a => a.description);
  if (visibleArgs.length > 0) {
    const groupedArgs = groupItems(visibleArgs, groupOrder);
    const sortedArgGroups = sortGroups(groupedArgs, groupOrder);

    for (const { group, items } of sortedArgGroups) {
      if (group) {
        lines.push(styles.groupTitle(group));
        lines.push('');
      }
      const nameWidth = Math.max(...items.map(a => stripAnsi(a.name).length)) + 4;
      for (const arg of items) {
        const namePart = padEnd(styles.argName(arg.name), nameWidth + 6);
        const descPart = styles.optionDesc(arg.description);
        const choiceHint = arg.choices ? styles.hint(` (choices: ${arg.choices.join(', ')})`) : '';
        lines.push(`  ${namePart}${descPart}${choiceHint}`);
      }
      lines.push('');
    }
  }

  // ── Options (only in detailed mode or showAllOnBrief) ──
  const showOptions = detailed || showAllOnBrief;
  const visibleOptions = options.filter(o => !o.hidden);
  if (showOptions && visibleOptions.length > 0) {
    const sorted = helpConfig.sortOptions
      ? [...visibleOptions].sort((a, b) => a.flags.localeCompare(b.flags))
      : visibleOptions;

    lines.push(styles.title('Options:'));

    const groupedOptions = groupItems(sorted, groupOrder);
    const sortedOptionGroups = sortGroups(groupedOptions, groupOrder);

    for (const { group, items } of sortedOptionGroups) {
      if (group) {
        lines.push(styles.groupTitle(group));
      }
      const flagWidth = Math.max(...items.map(o => stripAnsi(o.flags).length)) + 2;

      for (const opt of items) {
        const flagPart = padEnd(styles.optionFlag(opt.flags), flagWidth + 4);
        const descPart = styles.optionDesc(opt.description);

        const hints: string[] = [];
        if (opt.envVar) hints.push(`env: ${opt.envVar}`);
        if (opt.choices) hints.push(`choices: ${opt.choices.join(', ')}`);
        if (opt.defaultValue !== undefined) {
          const dv = JSON.stringify(opt.defaultValue);
          hints.push(`default: ${dv}`);
        }
        if (opt.required) hints.push('required');

        const hintStr = hints.length > 0 ? styles.hint(` (${hints.join(', ')})`) : '';
        lines.push(`  ${flagPart}${descPart}${hintStr}`);
      }
      lines.push('');
    }
  }

  // ── Global Options ──
  if (showOptions && helpConfig.showGlobalOptions && globalOptions.length > 0) {
    const sorted = [...globalOptions].filter(o => !o.hidden);
    if (sorted.length > 0) {
      lines.push(styles.title('Global Options:'));
      const flagWidth = Math.max(...sorted.map(o => stripAnsi(o.flags).length)) + 2;
      for (const opt of sorted) {
        const flagPart = padEnd(styles.optionFlag(opt.flags), flagWidth + 4);
        lines.push(`  ${flagPart}${styles.optionDesc(opt.description)}`);
      }
      lines.push('');
    }
  }

  // ── Subcommands (always show) ──
  const visibleCommands = subcommands.filter(c => !c.hidden);
  if (visibleCommands.length > 0) {
    const sorted = helpConfig.sortCommands
      ? [...visibleCommands].sort((a, b) => a.name.localeCompare(b.name))
      : visibleCommands;

    const groupedCommands = groupItems(sorted, groupOrder);
    const sortedCommandGroups = sortGroups(groupedCommands, groupOrder);

    for (const { group, items } of sortedCommandGroups) {
      if (group) {
        lines.push(styles.groupTitle(group));
        lines.push('');
      }
      const nameWidth = Math.max(...items.map(c => stripAnsi(c.name).length)) + 2;

      for (const cmd of items) {
        const aliasPart = cmd.aliases.length > 0
          ? `|${cmd.aliases.join('|')}`
          : '';
        const namePart = padEnd(styles.commandName(cmd.name + aliasPart), nameWidth + 8);
        lines.push(`  ${namePart}${styles.commandDesc(cmd.description)}`);
      }
      lines.push('');
    }
    if (detailed) {
      lines.push(styles.hint(`Run '${fullName} [command] --help' for more information on a command.`));
      lines.push('');
    }
  }

  return lines.join('\n');
}
