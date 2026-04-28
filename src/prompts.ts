// ============================================================
// CLIPPY - Interactive Prompts
// Pure readline-based, zero dependencies
// ============================================================

import * as readline from 'node:readline';
import { createInterface } from 'node:readline';
import type {
  PromptTextOptions,
  PromptConfirmOptions,
  PromptSelectOptions,
  PromptMultiSelectOptions,
  PromptPasswordOptions,
  PromptNumberOptions,
} from './types.js';

// ─── ANSI Helpers ────────────────────────────────────────────

const ESC = '\x1b';
const CSI = `${ESC}[`;

export const ansi = {
  reset: `${CSI}0m`,
  bold: `${CSI}1m`,
  dim: `${CSI}2m`,
  // Colors
  cyan: `${CSI}36m`,
  green: `${CSI}32m`,
  yellow: `${CSI}33m`,
  red: `${CSI}31m`,
  blue: `${CSI}34m`,
  magenta: `${CSI}35m`,
  white: `${CSI}37m`,
  gray: `${CSI}90m`,
  // Cursor
  up: (n = 1) => `${CSI}${n}A`,
  down: (n = 1) => `${CSI}${n}B`,
  col: (n = 1) => `${CSI}${n}G`,
  clearLine: `${CSI}2K`,
  hideCursor: `${CSI}?25l`,
  showCursor: `${CSI}?25h`,
  // Wrap
  c: (color: string, text: string) => `${color}${text}${CSI}0m`,
};

function isTTY(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

function write(text: string): void {
  process.stdout.write(text);
}

// ─── Symbol Rendering ────────────────────────────────────────

const symbols = {
  pointer: ansi.c(ansi.cyan, '❯'),
  check: ansi.c(ansi.green, '✔'),
  cross: ansi.c(ansi.red, '✘'),
  dot: ansi.c(ansi.cyan, '●'),
  circle: ansi.c(ansi.gray, '○'),
  question: ansi.c(ansi.cyan, '?'),
};

function prefix(type: 'question' | 'success' | 'error'): string {
  if (type === 'success') return symbols.check;
  if (type === 'error') return symbols.cross;
  return symbols.question;
}

// ─── Text Prompt ─────────────────────────────────────────────

export async function promptText(opts: PromptTextOptions): Promise<string> {
  const { message, defaultValue, validate, transform } = opts;

  const hint = defaultValue !== undefined
    ? ansi.c(ansi.gray, ` (${defaultValue})`)
    : '';

  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    const ask = () => {
      write(`${prefix('question')} ${ansi.c(ansi.bold, message)}${hint} ${ansi.c(ansi.cyan, '›')} `);
    };

    ask();

    rl.on('line', (input) => {
      const value = input.trim() || defaultValue || '';
      const transformed = transform ? transform(value) : value;

      if (validate) {
        const result = validate(transformed);
        if (result !== true) {
          const errMsg = typeof result === 'string' ? result : 'Invalid input';
          write(`${ansi.up()}${ansi.clearLine}`);
          write(`${prefix('error')} ${ansi.c(ansi.red, errMsg)}\n`);
          ask();
          return;
        }
      }

      // Rewrite the line with success styling
      write(`${ansi.up()}${ansi.clearLine}`);
      write(`${prefix('success')} ${ansi.c(ansi.bold, message)} ${ansi.c(ansi.gray, '›')} ${ansi.c(ansi.cyan, transformed)}\n`);

      rl.close();
      resolve(transformed);
    });

    rl.on('SIGINT', () => {
      rl.close();
      write('\n');
      process.exit(130);
    });
  });
}

// ─── Password Prompt ─────────────────────────────────────────

export async function promptPassword(opts: PromptPasswordOptions): Promise<string> {
  const { message, validate } = opts;

  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Mute output
    (rl as any).output = {
      write: (_str: string) => {},
      end: () => {},
    };

    const ask = () => {
      write(`${prefix('question')} ${ansi.c(ansi.bold, message)} ${ansi.c(ansi.cyan, '›')} `);
    };

    ask();

    process.stdin.setRawMode?.(true);
    let password = '';

    process.stdin.on('data', function handler(char: Buffer) {
      const ch = char.toString();

      if (ch === '\r' || ch === '\n') {
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener('data', handler);
        write('\n');

        if (validate) {
          const result = validate(password);
          if (result !== true) {
            const errMsg = typeof result === 'string' ? result : 'Invalid input';
            write(`${ansi.up()}${ansi.clearLine}`);
            write(`${prefix('error')} ${ansi.c(ansi.red, errMsg)}\n`);
            password = '';
            process.stdin.setRawMode?.(true);
            ask();
            process.stdin.on('data', handler);
            return;
          }
        }

        write(`${ansi.up()}${ansi.clearLine}`);
        write(`${prefix('success')} ${ansi.c(ansi.bold, message)} ${ansi.c(ansi.gray, '›')} ${ansi.c(ansi.gray, '••••••••')}\n`);
        rl.close();
        resolve(password);
      } else if (ch === '\x03') {
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener('data', handler);
        write('\n');
        process.exit(130);
      } else if (ch === '\x7f') {
        password = password.slice(0, -1);
      } else {
        password += ch;
      }
    });
  });
}

// ─── Confirm Prompt ──────────────────────────────────────────

export async function promptConfirm(opts: PromptConfirmOptions): Promise<boolean> {
  const { message, defaultValue } = opts;
  const hint = defaultValue === true ? 'Y/n' : defaultValue === false ? 'y/N' : 'y/n';

  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    const ask = () => {
      write(`${prefix('question')} ${ansi.c(ansi.bold, message)} ${ansi.c(ansi.gray, `(${hint})`)} ${ansi.c(ansi.cyan, '›')} `);
    };

    ask();

    rl.on('line', (input) => {
      const val = input.trim().toLowerCase();
      let answer: boolean;

      if (val === 'y' || val === 'yes') answer = true;
      else if (val === 'n' || val === 'no') answer = false;
      else if (val === '' && defaultValue !== undefined) answer = defaultValue;
      else {
        write(`${ansi.up()}${ansi.clearLine}`);
        write(`${prefix('error')} ${ansi.c(ansi.red, 'Please enter y or n')}\n`);
        ask();
        return;
      }

      const display = answer ? 'Yes' : 'No';
      write(`${ansi.up()}${ansi.clearLine}`);
      write(`${prefix('success')} ${ansi.c(ansi.bold, message)} ${ansi.c(ansi.gray, '›')} ${ansi.c(ansi.cyan, display)}\n`);
      rl.close();
      resolve(answer);
    });

    rl.on('SIGINT', () => { rl.close(); write('\n'); process.exit(130); });
  });
}

// ─── Select Prompt ───────────────────────────────────────────

export async function promptSelect<T extends string>(
  opts: PromptSelectOptions<T>
): Promise<T> {
  const { message, choices, defaultValue } = opts;

  let selectedIndex = Math.max(0, choices.findIndex(c => c.value === defaultValue));

  if (!isTTY()) {
    // Fallback: show numbered list
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      const list = choices.map((c, i) => `  ${i + 1}. ${c.label}`).join('\n');
      write(`${prefix('question')} ${ansi.c(ansi.bold, message)}\n${list}\n${ansi.c(ansi.cyan, '›')} `);
      rl.on('line', (input) => {
        const n = parseInt(input.trim()) - 1;
        if (n >= 0 && n < choices.length) {
          rl.close();
          resolve(choices[n]!.value);
        } else {
          write(`${ansi.c(ansi.red, 'Invalid selection. Try again: ')}`);
        }
      });
    });
  }

  return new Promise((resolve) => {
    const renderList = (redraw = false) => {
      if (redraw) {
        write(ansi.up(choices.length));
      }
      for (let i = 0; i < choices.length; i++) {
        const isSelected = i === selectedIndex;
        const pointer = isSelected ? symbols.pointer : '  ';
        const label = isSelected
          ? ansi.c(ansi.cyan, choices[i]!.label)
          : ansi.c(ansi.gray, choices[i]!.label);
        write(`${ansi.clearLine}${pointer} ${label}\n`);
      }
    };

    write(`${prefix('question')} ${ansi.c(ansi.bold, message)}\n`);
    write(ansi.hideCursor);
    renderList(false);

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode?.(true);
    process.stdin.resume();

    const onKey = (_str: string, key: readline.Key) => {
      if (key.name === 'up' || key.name === 'k') {
        selectedIndex = (selectedIndex - 1 + choices.length) % choices.length;
        renderList(true);
      } else if (key.name === 'down' || key.name === 'j') {
        selectedIndex = (selectedIndex + 1) % choices.length;
        renderList(true);
      } else if (key.name === 'return' || key.name === 'enter') {
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener('keypress', onKey);
        write(ansi.showCursor);

        const chosen = choices[selectedIndex]!;
        // Clear the list and header, rewrite with result
        write(ansi.up(choices.length + 1));
        for (let i = 0; i <= choices.length; i++) write(`${ansi.clearLine}\n`);
        write(ansi.up(choices.length + 1));
        write(`${prefix('success')} ${ansi.c(ansi.bold, message)} ${ansi.c(ansi.gray, '›')} ${ansi.c(ansi.cyan, chosen.label)}\n`);

        resolve(chosen.value);
      } else if (key.ctrl && key.name === 'c') {
        process.stdin.setRawMode?.(false);
        write(ansi.showCursor + '\n');
        process.exit(130);
      }
    };

    process.stdin.on('keypress', onKey);
  });
}

// ─── Multi-Select Prompt ─────────────────────────────────────

export async function promptMultiSelect<T extends string>(
  opts: PromptMultiSelectOptions<T>
): Promise<T[]> {
  const { message, choices, defaultValues = [] } = opts;
  let cursor = 0;
  const selected = new Set<number>(
    defaultValues.map(v => choices.findIndex(c => c.value === v)).filter(i => i >= 0)
  );

  if (!isTTY()) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      const list = choices.map((c, i) => `  ${i + 1}. ${c.label}`).join('\n');
      write(`${prefix('question')} ${ansi.c(ansi.bold, message)} ${ansi.c(ansi.gray, '(space to toggle, enter to confirm)')}\n${list}\n${ansi.c(ansi.cyan, '›')} `);
      rl.on('line', (input) => {
        const nums = input.split(',').map(s => parseInt(s.trim()) - 1);
        if (nums.every(n => n >= 0 && n < choices.length)) {
          rl.close();
          resolve(nums.map(n => choices[n]!.value));
        } else {
          write(`${ansi.c(ansi.red, 'Invalid selection. Enter comma-separated numbers: ')}`);
        }
      });
    });
  }

  return new Promise((resolve) => {
    const renderList = (redraw = false) => {
      if (redraw) write(ansi.up(choices.length));
      for (let i = 0; i < choices.length; i++) {
        const isActive = i === cursor;
        const isChecked = selected.has(i);
        const pointer = isActive ? symbols.pointer : '  ';
        const box = isChecked ? symbols.dot : symbols.circle;
        const label = isActive
          ? ansi.c(ansi.cyan, choices[i]!.label)
          : isChecked
          ? ansi.c(ansi.white, choices[i]!.label)
          : ansi.c(ansi.gray, choices[i]!.label);
        write(`${ansi.clearLine}${pointer} ${box} ${label}\n`);
      }
    };

    const hint = ansi.c(ansi.gray, '↑↓ navigate · space toggle · enter confirm');
    write(`${prefix('question')} ${ansi.c(ansi.bold, message)} ${hint}\n`);
    write(ansi.hideCursor);
    renderList(false);

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode?.(true);
    process.stdin.resume();

    const onKey = (_str: string, key: readline.Key) => {
      if (key.name === 'up' || key.name === 'k') {
        cursor = (cursor - 1 + choices.length) % choices.length;
        renderList(true);
      } else if (key.name === 'down' || key.name === 'j') {
        cursor = (cursor + 1) % choices.length;
        renderList(true);
      } else if (key.name === 'space') {
        if (selected.has(cursor)) selected.delete(cursor);
        else selected.add(cursor);
        renderList(true);
      } else if (key.name === 'a') {
        if (selected.size === choices.length) selected.clear();
        else choices.forEach((_, i) => selected.add(i));
        renderList(true);
      } else if (key.name === 'return' || key.name === 'enter') {
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener('keypress', onKey);
        write(ansi.showCursor);

        const picked = [...selected].sort().map(i => choices[i]!);
        const display = picked.length > 0
          ? picked.map(c => ansi.c(ansi.cyan, c.label)).join(ansi.c(ansi.gray, ', '))
          : ansi.c(ansi.gray, '(none)');

        write(ansi.up(choices.length + 1));
        for (let i = 0; i <= choices.length; i++) write(`${ansi.clearLine}\n`);
        write(ansi.up(choices.length + 1));
        write(`${prefix('success')} ${ansi.c(ansi.bold, message)} ${ansi.c(ansi.gray, '›')} ${display}\n`);

        resolve(picked.map(c => c.value));
      } else if (key.ctrl && key.name === 'c') {
        process.stdin.setRawMode?.(false);
        write(ansi.showCursor + '\n');
        process.exit(130);
      }
    };

    process.stdin.on('keypress', onKey);
  });
}

// ─── Number Prompt ───────────────────────────────────────────

export async function promptNumber(opts: PromptNumberOptions): Promise<number> {
  const { message, defaultValue, min, max, validate } = opts;

  let hint = defaultValue !== undefined ? `${defaultValue}` : '';
  if (min !== undefined && max !== undefined) hint = `${hint} [${min}-${max}]`;
  else if (min !== undefined) hint = `${hint} [min: ${min}]`;
  else if (max !== undefined) hint = `${hint} [max: ${max}]`;

  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const hintStr = hint ? ansi.c(ansi.gray, ` (${hint})`) : '';

    const ask = () => {
      write(`${prefix('question')} ${ansi.c(ansi.bold, message)}${hintStr} ${ansi.c(ansi.cyan, '›')} `);
    };

    ask();

    rl.on('line', (input) => {
      const raw = input.trim();
      const parsed = raw === '' && defaultValue !== undefined ? defaultValue : parseFloat(raw);

      if (isNaN(parsed)) {
        write(`${ansi.up()}${ansi.clearLine}`);
        write(`${prefix('error')} ${ansi.c(ansi.red, 'Please enter a valid number')}\n`);
        ask();
        return;
      }

      if (min !== undefined && parsed < min) {
        write(`${ansi.up()}${ansi.clearLine}`);
        write(`${prefix('error')} ${ansi.c(ansi.red, `Value must be at least ${min}`)}\n`);
        ask();
        return;
      }

      if (max !== undefined && parsed > max) {
        write(`${ansi.up()}${ansi.clearLine}`);
        write(`${prefix('error')} ${ansi.c(ansi.red, `Value must be at most ${max}`)}\n`);
        ask();
        return;
      }

      if (validate) {
        const result = validate(parsed);
        if (result !== true) {
          const errMsg = typeof result === 'string' ? result : 'Invalid value';
          write(`${ansi.up()}${ansi.clearLine}`);
          write(`${prefix('error')} ${ansi.c(ansi.red, errMsg)}\n`);
          ask();
          return;
        }
      }

      write(`${ansi.up()}${ansi.clearLine}`);
      write(`${prefix('success')} ${ansi.c(ansi.bold, message)} ${ansi.c(ansi.gray, '›')} ${ansi.c(ansi.cyan, String(parsed))}\n`);
      rl.close();
      resolve(parsed);
    });

    rl.on('SIGINT', () => { rl.close(); write('\n'); process.exit(130); });
  });
}

// ─── Namespace Export ────────────────────────────────────────

export const prompt = {
  text: promptText,
  password: promptPassword,
  confirm: promptConfirm,
  select: promptSelect,
  multiSelect: promptMultiSelect,
  number: promptNumber,
};
