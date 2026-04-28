// ============================================================
// CLIPPY - Core Type System
// ============================================================

// ─── Option Flag Parsing ────────────────────────────────────

type ExtractLongName<F extends string> =
  F extends `${string}--${infer Long} ${string}` ? Long :
  F extends `${string}--${infer Long}` ? Long :
  never;

type KebabToCamel<S extends string> =
  S extends `${infer Head}-${infer Tail}`
    ? `${Head}${Capitalize<KebabToCamel<Tail>>}`
    : S;

// Negatable flags like `--no-open` produce key `open` at runtime, so strip
// the leading `no-` segment before camel-casing.
type StripNoPrefix<S extends string> = S extends `no-${infer Rest}` ? Rest : S;

type OptionKey<F extends string> = KebabToCamel<StripNoPrefix<ExtractLongName<F>>>;

// ─── Option Value Type Inference ────────────────────────────

type HasRequired<F extends string> = F extends `${string}<${string}>${string}` ? true : false;
type HasOptional<F extends string> = F extends `${string}[${string}]${string}` ? true : false;
type IsVariadic<F extends string> =
  F extends `${string}...>${string}` ? true :
  F extends `${string}...>` ? true : false;
type IsNegatable<F extends string> = F extends `${string}--no-${string}` ? true : false;

type OptionRawType<F extends string> =
  IsVariadic<F> extends true ? string[] :
  HasRequired<F> extends true ? string :
  HasOptional<F> extends true ? string | boolean :
  IsNegatable<F> extends true ? boolean :
  boolean;

type OptionTypeWithParser<F extends string, Parser> =
  Parser extends (value: string, prev: any) => infer R ? R :
  OptionRawType<F>;

type OptionMaybeUndefined<F extends string, Default, Parser> =
  OptionTypeWithParser<F, Parser> extends boolean ? false :
  [Default] extends [undefined] ? true : false;

type ResolveOptionType<F extends string, Default, Parser> =
  OptionMaybeUndefined<F, Default, Parser> extends true
    ? OptionTypeWithParser<F, Parser> | undefined
    : OptionTypeWithParser<F, Parser>;

// ─── Runtime Option/Arg Defs (no generics needed at runtime) ─

export interface OptionDef {
  flags: string;
  description: string;
  defaultValue: unknown;
  parser: ((v: string, prev: unknown) => unknown) | undefined;
  required: boolean;
  hidden: boolean;
  envVar?: string;
  choices?: string[];
}

export interface ArgDef {
  name: string;
  description: string;
  parser: ((v: string, prev: unknown) => unknown) | undefined;
  defaultValue?: unknown;
  choices?: string[];
}

// ─── Type-level Opts Map ─────────────────────────────────────

export type OptsMap = Record<string, unknown>;

/**
 * Flattens intersection types into a single object literal so that hover
 * tooltips and `expectTypeOf` comparisons see a clean `{ a: A; b: B }`
 * instead of `{ a: A } & { b: B } & Record<never, never>`.
 */
export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type AddOption<
  Map extends OptsMap,
  F extends string,
  Default = undefined,
  Parser = undefined
> = Prettify<Map & {
  [K in OptionKey<F>]: ResolveOptionType<F, Default, Parser>;
}>;

// ─── Action Handler ─────────────────────────────────────────

export type ActionHandler<
  Args extends unknown[],
  Opts extends OptsMap
> = (...args: [...Args, Opts]) => void | Promise<void>;

// ─── Prompt Types ────────────────────────────────────────────

export interface PromptTextOptions {
  message: string;
  defaultValue?: string;
  validate?: (value: string) => boolean | string;
  transform?: (value: string) => string;
}

export interface PromptConfirmOptions {
  message: string;
  defaultValue?: boolean;
}

export interface PromptSelectOptions<T extends string> {
  message: string;
  choices: { label: string; value: T }[];
  defaultValue?: T;
}

export interface PromptMultiSelectOptions<T extends string> {
  message: string;
  choices: { label: string; value: T }[];
  defaultValues?: T[];
}

export interface PromptPasswordOptions {
  message: string;
  validate?: (value: string) => boolean | string;
}

export interface PromptNumberOptions {
  message: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  validate?: (value: number) => boolean | string;
}
