// ============================================================
// CLIPPY - Public API
// ============================================================

export { Command, ClippyError } from './command';
export { prompt, ansi } from './prompts';
export type {
  OptsMap,
  AddOption,
  OptionDef,
  ArgDef,
  ActionHandler,
  PromptTextOptions,
  PromptConfirmOptions,
  PromptSelectOptions,
  PromptMultiSelectOptions,
  PromptPasswordOptions,
  PromptNumberOptions,
} from './types';
export type { HelpConfig } from './help';

import { Command } from './command';

/** Convenience: create a new root command */
export function createCommand(name: string): Command {
  return new Command(name);
}

/** Convenience: a default program instance (set name/description before parse) */
export const program = new Command('program');
