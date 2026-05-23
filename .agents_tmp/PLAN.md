# 1. OBJECTIVE

为 clippy CLI 框架添加增强的帮助系统：

1. **区分 `-h` 和 `--help` 的输出**：
   - `-h`（精简）：显示 Usage + Options 列表（仅 flags + description）+ Commands 列表（带简要描述）
   - `--help`（详细）：显示 Usage + Arguments + Options 完整信息（choices, default, envVar 等）+ Commands + 帮助提示

2. **实现内置的 `help [command]` 子命令**：
   - `help` → 显示当前命令的完整帮助信息（等同于 `--help`）
   - `help <subcommand>` → 显示指定子命令的完整帮助信息

3. **支持用户对 Commands、Options、Arguments 进行分组**：
   - 选项/参数/子命令可指定 `group` 属性进行分组
   - 支持自定义分组显示顺序
   - Commands 组中的子命令需展示大概用法（summary/description）

# 2. CONTEXT SUMMARY

这是一个 TypeScript CLI 框架 (clippy)，核心文件包括：

| 文件 | 用途 |
|------|------|
| `src/types.ts` | 类型定义，包含 `OptionDef`、`ArgDef` |
| `src/help.ts` | 帮助信息格式化器 |
| `src/command.ts` | 命令构建器和解析器 |
| `src/index.ts` | 公开 API |

当前帮助系统：
- 单一帮助信息格式（无 `-h`/`--help` 区分）
- 无内置 `help` 子命令
- 选项/参数无分组功能
- Commands 组末尾有 "Run '... --help' for more information" 提示

# 3. APPROACH OVERVIEW

## 3.1 精简/详细帮助区分

| 模式 | 显示内容 |
|------|----------|
| `-h`（精简） | Usage + Options（仅 flags + description）+ Commands（带 summary）+ 帮助提示行 |
| `--help`（详细） | Usage + Arguments + Options（完整）+ Global Options + Commands（带 description）+ 帮助提示行 |

**关键区别**：
- Arguments 在 `-h` 中不显示
- Options 在 `-h` 中只显示 flags 和 description，不显示 choices/default/envVar 等详情

## 3.2 内置 help 子命令

- 当解析到 `help` 作为第一个参数时，进入 help 模式
- `help` → 显示当前命令的完整帮助
- `help <subcommand>` → 查找子命令并显示其完整帮助
- `help unknown` → 显示错误并列出可用子命令

## 3.3 分组支持

- `OptionDef`、`ArgDef` 添加可选 `group?: string` 字段
- `SubcommandInfo` 添加可选 `group?: string` 字段（用于子命令分组显示）
- `HelpConfig` 添加 `groupOrder?: string[]` 控制分组顺序
- `formatHelp()` 按 group 分组输出，每组显示标题

## 3.4 Commands 用法自动生成

详细模式下遍历 subcommands 时，自动生成 usage 片段：
```ts
const optionPart = cmd.options?.length ? ' [options]' : '';
const argPart = cmd.args?.length ? ' ' + cmd.args.map(a => a.name).join(' ') : '';
```

## 3.5 Commands 帮助提示

- `--help` 模式末尾：`Run '${fullName} [command] --help' for more information on a command.`
- `-h` 模式末尾：`Run '${fullName} [command] -h' for more information on a command.`

# 4. IMPLEMENTATION STEPS

## Step 1: 修改 `src/types.ts` - 添加分组字段

**目标**：为 OptionDef、ArgDef 添加分组支持

**方法**：
- `OptionDef` 添加 `group?: string`
- `ArgDef` 添加 `group?: string`

---

## Step 2: 修改 `src/help.ts` - 增强 HelpConfig 和 formatHelp

**目标**：添加分组支持、详细/精简模式区分

**方法**：

### 2.1 更新 HelpConfig 接口
```ts
export interface HelpConfig {
  width?: number;
  sortOptions?: boolean;
  sortCommands?: boolean;
  showGlobalOptions?: boolean;
  groupOrder?: string[];          // 分组显示顺序，未列出的组按出现顺序
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
    groupTitle?: (s: string) => string;  // 分组标题样式
  };
}
```

### 2.2 修改 formatHelp 函数签名
```ts
export function formatHelp(config: {
  // ... existing fields
  detailed: boolean;  // true = 完整信息, false = 精简信息
}): string
```

### 2.3 精简模式 (`detailed: false`) 行为
- **显示**：Usage + Arguments（不显示）+ Options 列表（仅 flags + description）+ Commands（带 summary）+ 帮助提示
- **不显示**：Arguments 详情、Options 的 choices/default/envVar 等详情

### 2.4 详细模式 (`detailed: true`) 行为
- **显示**：Usage + Arguments + Options（完整）+ Global Options + Commands（带 description）+ 帮助提示

### 2.5 添加分组格式化逻辑
```ts
function formatGroupedSection<T extends { group?: string }>(
  items: T[],
  formatter: (item: T) => string,
  groupOrder: string[]
): { title: string; lines: string[] }[]
```

---

## Step 3: 修改 `src/command.ts` - 集成帮助功能

**目标**：添加 `-h`/`--help` 选项和内置 help 命令处理

**方法**：

### 3.1 修改 `parseAsync` / `parse` 入口逻辑
在参数解析开始前检查：
- `-h` 在原始参数列表中 → 显示精简帮助，exit(0)
- `--help` 在原始参数列表中 → 显示详细帮助，exit(0)
- 第一个参数是 `help` → 进入 help 模式处理

### 3.2 添加 help 命令处理
```ts
private _handleHelpCommand(args: string[]): never {
  if (args.length === 0) {
    // help → 显示当前命令详细帮助
    this.outputHelp({ detailed: true });
  } else {
    const targetName = args[0]!;
    const target = this._subcommands.get(targetName);
    if (!target) {
      console.error(`error: unknown command '${targetName}'`);
      console.error(`Run '${this._getFullName()} help' for more information.`);
      process.exit(1);
    }
    // help <subcommand> → 显示子命令详细帮助
    target.outputHelp({ detailed: true });
  }
}
```

### 3.3 更新 helpText / outputHelp 方法
```ts
helpText(options?: { detailed?: boolean }): string {
  return formatHelp({
    // ... config
    detailed: options?.detailed ?? true,
  });
}

outputHelp(options?: { detailed?: boolean }): void {
  process.stdout.write(this.helpText(options));
}
```

### 3.4 更新 option/argument 方法
允许传入 `group` 配置：
```ts
.option('-p, --port <port>', 'Port', { group: 'Server Options' })
.argument('<file>', 'Input file', { group: 'Input' })
```

### 3.5 修改 `_error` 方法
更新帮助提示：
```ts
// 精简模式用 -h
process.stderr.write(ansi.c(ansi.gray, `Run '${this._getFullName()} -h' for usage.\n`));
```

---

## Step 4: 更新 `src/index.ts` - 导出新类型

**目标**：确保新类型可被外部访问

**方法**：
- `OptionDef`、`ArgDef` 类型已通过 `import type` 导出，无需修改

---

## Step 5: 更新测试和示例

### 5.1 更新 `tests/command.test.ts`
添加测试用例：
- `-h` 显示精简帮助（不包含 Arguments 和 Options 详情）
- `--help` 显示详细帮助
- `help` 子命令工作正常
- `help <subcommand>` 显示指定子命令帮助
- 分组功能正常工作

### 5.2 更新 `examples/demo.ts`
添加分组示例：
```ts
// 分组选项示例
.option('-p, --port <port>', 'Port to listen on', {
  group: 'Server Options',
  default: 3000,
})
.option('--host <host>', 'Hostname to bind', {
  group: 'Server Options',
  default: 'localhost',
})
.option('-v, --verbose', 'Verbose output', {
  group: 'Output Options',
})

// 带分组的子命令
const configCmd = new Command('config')
  .description('Configuration commands', 'Config')
  .group('Management');  // 假设支持 command group

// 确保子命令有 summary 用于 -h 输出
program
  .addCommand(serve)
  .addCommand(deploy)
  .addCommand(init);
```

---

## Step 6: 类型检查

**目标**：确保类型安全

**方法**：
- 运行 `pnpm typecheck`
- 修复任何类型错误

# 5. TESTING AND VALIDATION

## 5.1 功能测试矩阵

| 测试场景 | 预期结果 |
|----------|----------|
| `demo -h` | 显示精简帮助：Usage + Options(仅flags+desc) + Commands(summary) + 提示(-h) |
| `demo --help` | 显示详细帮助：Usage + Arguments + Options(完整) + Commands(desc) + 提示(--help) |
| `demo help` | 显示详细帮助（等同于 `--help`） |
| `demo help serve` | 显示 serve 子命令的完整帮助 |
| `demo help unknown` | 错误：`unknown command 'unknown'` + 提示 |
| 分组选项 | 按组显示，组标题可自定义样式 |
| 带分组的子命令 | Commands 按组分类显示 |

## 5.2 帮助信息对比示例

**`demo -h`（精简）**：
```
Usage: demo [options] [command]

Options:
  -p, --port <port>   Port to listen on
  --host <host>       Hostname to bind
  -v, --verbose       Verbose output

Commands:
  serve    Start dev server
  deploy   Deploy to cloud
  init     Init project wizard

Run 'demo [command] -h' for more information on a command.
```

**`demo --help`（详细）**：
```
Usage: demo [options] [command]

Arguments:
  <env>             Target environment (choices: staging, production, dev)
  [tag]             Docker image tag (default: "latest")

Options:
  -p, --port <port>   Port to listen on (default: 3000, env: PORT)
  --host <host>       Hostname to bind (default: "localhost")
  -v, --verbose       Verbose output

Commands:
  serve [options]                               Start dev server
  deploy [options] <env> [tag]                   Deploy to cloud
  init [options]                                 Init project wizard

Run 'demo [command] --help' for more information on a command.
```

**关键点**：
- Commands 在详细模式下自动生成 `子命令名 [usage片段]` + description
- `usage片段` 自动从子命令的 options 和 args 计算：`[options] <arg1> [arg2]`
- 精简模式只显示子命令名称

---

## 5.3 Commands 用法自动生成

在 `formatHelp` 中，遍历 subcommands 时自动生成 usage 片段：

```ts
const displayParts = sorted.map(cmd => {
  const aliasPart = cmd.aliases.length ? `|${cmd.aliases.join('|')}` : '';
  const optionPart = cmd.options?.length ? ' [options]' : '';
  const argPart = cmd.args?.length ? ' ' + cmd.args.map(a => a.name).join(' ') : '';
  const raw = cmd.name + aliasPart + optionPart + argPart;
  return { cmd, raw };
});
```

这样无需手动维护 `usage` 字段，自动跟随命令定义变化。

---

## 5.4 测试命令

```bash
# 运行测试
pnpm test

# 类型检查
pnpm typecheck

# 手动验证
pnpm demo -h
pnpm demo --help
pnpm demo help
pnpm demo help serve
pnpm demo serve -h
pnpm demo serve --help
```

## 5.5 成功标准

- [ ] `-h` 显示精简帮助（Options 仅 flags+desc，无 Arguments，无 Options 详情）
- [ ] `--help` 显示完整帮助（包括 Arguments 和 Options 详情）
- [ ] `help` 子命令等同于 `--help`
- [ ] `help <command>` 显示指定命令完整帮助
- [ ] `help unknown` 显示错误和可用命令列表
- [ ] 分组功能正常工作（Options/Arguments/Commands 支持分组）
- [ ] 所有现有测试通过
- [ ] 类型检查通过
