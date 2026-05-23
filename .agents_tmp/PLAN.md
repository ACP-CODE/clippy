# 1. OBJECTIVE

为 clippy CLI 框架添加增强的帮助系统：

1. **区分 `-h` 和 `--help` 的输出**：
   - `-h` 显示概览（简短），只包含 Usage 和 Commands
   - `--help` 显示详细信息，包含所有 Options、Arguments、Commands 等完整信息

2. **实现内置的 `help [command]` 子命令**：
   - `help` → 显示当前命令的完整帮助信息
   - `help <subcommand>` → 显示指定子命令的帮助信息

3. **支持用户对 Commands、Options、Arguments 进行分组**：
   - 选项/参数可指定 `group` 属性进行分组
   - 支持自定义分组显示顺序

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

# 3. APPROACH OVERVIEW

## 3.1 概览/详细帮助区分

- 在 `HelpConfig` 中添加 `detailedHelp` 选项控制默认行为
- `formatHelp()` 函数增加 `detailed` 参数
- `-h` 触发概览模式，`--help` 触发详细模式
- 概览模式只显示：Usage + Arguments + Commands
- 详细模式显示：Usage + Arguments + Options + Global Options + Commands + 帮助提示

## 3.2 内置 help 子命令

- 添加 `addHelpCommand()` 方法注册内置 help 命令
- 当解析到 `help [command]` 时，显示对应命令的帮助
- 递归处理嵌套子命令的 help

## 3.3 分组支持

- 在 `OptionDef`、`ArgDef` 添加可选 `group?: string` 字段
- 在 `SubcommandInfo` 添加可选 `group?: string` 字段
- `HelpConfig` 添加 `groupOrder?: string[]` 控制分组顺序
- `formatHelp()` 按 group 分组输出，每组显示标题

# 4. IMPLEMENTATION STEPS

## Step 1: 修改 `src/types.ts` - 添加分组字段

**目标**：为 OptionDef、ArgDef 添加分组支持

**方法**：
- `OptionDef` 添加 `group?: string`
- `ArgDef` 添加 `group?: string`

**参考**：`src/types.ts` 第 54-71 行

---

## Step 2: 修改 `src/help.ts` - 增强 HelpConfig 和 formatHelp

**目标**：添加分组支持和详细/概览模式

**方法**：

### 2.1 更新 HelpConfig 接口
```ts
export interface HelpConfig {
  // ... 现有字段
  detailedHelp?: boolean;      // 默认详细模式
  groupOrder?: string[];       // 分组显示顺序
  styles?: {
    // ... 现有样式
    groupTitle?: (s: string) => string;  // 分组标题样式
  };
}
```

### 2.2 修改 formatHelp 函数
- 添加 `detailed: boolean` 参数（默认 true）
- 概览模式：不显示 Options、Global Options，仅显示 Arguments 和 Commands
- 详细模式：显示全部内容

### 2.3 添加分组格式化逻辑
```ts
function formatGroupedSection<T extends { group?: string }>(
  items: T[],
  formatter: (item: T) => string,
  groupOrder: string[],
  styles: HelpConfig['styles']
): string[]
```

**参考**：`src/help.ts` 第 91-217 行

---

## Step 3: 修改 `src/command.ts` - 集成帮助功能

**目标**：添加 `-h`/`--help` 选项和内置 help 命令

**方法**：

### 3.1 添加帮助选项定义
```ts
private _helpOptions = {
  short: '-h',
  long: '--help',
  shortDesc: 'Show brief help',
  longDesc: 'Show full help',
};
```

### 3.2 修改构造函数或 init 方法
- 自动注册 `-h` 和 `--help` 选项（隐藏，不影响正常解析）

### 3.3 修改 `_parse` 方法
- 检测 `-h`：显示概览帮助，exit(0)
- 检测 `--help`：显示详细帮助，exit(0)
- 检测 `help`：调用 help 命令处理器

### 3.4 添加 help 命令处理
```ts
helpText(options?: { detailed?: boolean }): string {
  return formatHelp({
    // ... 
    detailed: options?.detailed ?? true,
  });
}

helpCommand(): Command {
  // 创建内置 help 子命令
}
```

### 3.5 更新 option/argument 方法
- 允许传入 `group` 配置

### 3.6 添加分组配置到 configureHelp
```ts
configureHelp(config: HelpConfig & { groupOrder?: string[] }): this
```

**参考**：`src/command.ts` 第 281-530 行

---

## Step 4: 更新 `src/index.ts` - 导出新类型

**目标**：确保新类型可被外部访问

**方法**：
- 导出更新后的 `OptionDef`、`ArgDef` 类型

---

## Step 5: 更新测试和示例

**目标**：验证新功能

**方法**：

### 5.1 更新 `tests/command.test.ts`
添加测试用例：
- `-h` 显示概览帮助
- `--help` 显示详细帮助
- `help` 子命令工作正常
- 分组功能正常工作

### 5.2 更新 `examples/demo.ts`
添加分组示例：
```ts
.option('-p, --port <port>', 'Port', { group: 'Server Options' })
.option('--host <host>', 'Host', { group: 'Server Options' })
.option('-v, --verbose', 'Verbose', { group: 'Output Options' })
```

---

## Step 6: 类型检查

**目标**：确保类型安全

**方法**：
- 运行 `pnpm typecheck`
- 修复任何类型错误

# 5. TESTING AND VALIDATION

## 5.1 功能测试

| 测试场景 | 预期结果 |
|----------|----------|
| `demo -h` | 只显示 Usage 和 Commands |
| `demo --help` | 显示完整帮助信息 |
| `demo help` | 显示详细帮助 |
| `demo help serve` | 显示 serve 子命令的帮助 |
| `demo help unknown` | 显示错误提示 |
| 分组选项/参数 | 按组显示，有分组标题 |

## 5.2 测试命令

```bash
# 运行测试
pnpm test

# 类型检查
pnpm typecheck

# 手动验证
pnpm demo -h
pnpm demo --help
pnpm demo help
pnpm demo serve -h
pnpm demo serve --help
```

## 5.3 成功标准

- [ ] `-h` 只显示概览（Usage + Arguments + Commands）
- [ ] `--help` 显示完整帮助
- [ ] `help` 子命令正常工作
- [ ] `help <command>` 显示指定命令帮助
- [ ] 分组功能正常工作
- [ ] 所有现有测试通过
- [ ] 类型检查通过
