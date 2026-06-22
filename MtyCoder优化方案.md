# MtyCoder 深度优化方案

## 一、现状诊断

### 核心架构（Effect-TS 服务层）

| 模块 | 关键文件 | 行数 | 状态 |
|------|---------|------|------|
| Agent 系统 | `src/agent/agent.ts` | 554 | 可用，但权限查找线性扫描 |
| 会话核心循环 | `src/session/prompt.ts` | 3400+ | **最大风险**：职责混杂 |
| 事件处理器 | `src/session/processor.ts` | — | 可变状态 vs Effect 函数式 |
| 工具注册 | `src/tool/registry.ts` | 420 | 启动时急初始化全部 24+ 工具 |
| 记忆系统 | `src/memory/reconcile.ts` | — | 每次搜索同步全量扫描磁盘 |
| 上下文管理 | `src/session/checkpoint.ts` | 1475 | fork/no-fork 分支复杂 |
| 配置系统 | `src/config/config.ts` | — | Effect Schema + Zod 混合 |

### 首次使用体验（UX 诊断）

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 无首次引导 | **致命** | 用户直接落在空白 prompt，不知如何配置 Provider |
| Tips 对新用户隐藏 | **致命** | session count === 0 时不显示任何提示 |
| /help 几乎为空 | 高 | 只有一行 "按 Ctrl+P 查看命令" |
| 无 `mty init` 命令 | 高 | 不会自动创建 `.mtycoder/` 配置 |
| 文档仍用 OpenCode 品牌 | 中 | 17 种语言的文档未更新 |

---

## 二、优化方向总览

```
Phase 1: 首次使用引导 & UX 修复（立即可做，成本低）
Phase 2: 集成本地 Skills & MCP（开箱即用）
Phase 3: 借鉴 Claude 机制提升准确性
Phase 4: 借鉴 Hermes 自动 Skill 生成
Phase 5: 核心架构优化（长期）
```

---

## Phase 1: 首次使用引导 & UX 修复

### 1.1 首次运行引导向导

**位置**: `src/cli/cmd/tui/thread.ts` 或新建 `src/cli/cmd/tui/onboarding.ts`

```
检测条件: 无 auth 文件 + session count === 0
┌─────────────────────────────────────────────┐
│  欢迎使用 MtyCoder!                        │
│                                             │
│  首先，我们需要配置一个 AI 模型提供方:       │
│                                             │
│  1. MtyCoder Auto（免费通道，零配置）        │
│  2. 自定义 API Key（OpenAI / Claude / 其他） │
│  3. 导入 Claude Code 配置                   │
│                                             │
│  选择后进入交互式配置...                    │
└─────────────────────────────────────────────┘
```

**涉及文件**:
- `src/cli/cmd/tui/thread.ts` — 添加首次检测逻辑
- 新建 `src/cli/cmd/tui/component/dialog-onboarding.tsx` — 引导 UI
- `src/cli/cmd/tui/routes/home.tsx` — 首页显示快速提示

### 1.2 修复 Tips 显示逻辑

**位置**: `src/cli/cmd/tui/feature-plugins/home/tips.tsx`

```typescript
// 当前（错误）：session count === 0 时不显示
const first = createMemo(() => api.state.session.count() === 0)

// 修改为：session count === 0 时显示入门级 tips
const isFirstRun = createMemo(() => api.state.session.count() === 0)
const filteredTips = createMemo(() =>
  isFirstRun()
    ? tips.filter(t => t.level === "beginner")  // 新手提示
    : tips
)
```

### 1.3 增强 /help 命令

**位置**: `src/cli/cmd/tui/ui/dialog-help.tsx`

显示内容:
- 核心快捷键列表（Ctrl+P 命令面板、Ctrl+C 取消、Tab 切换 Agent）
- 常用斜杠命令（/connect、/init、/model、/agent、/goal）
- 指向文档的链接

### 1.4 添加 `mty init` 子命令

**位置**: 新建 `src/cli/cmd/init.ts`

功能:
- 创建 `.mtycoder/mtycoder.jsonc` 模板
- 创建 `.mtycoder/AGENTS.md` 项目说明
- 创建 `.mtycoder/skills/` 目录
- 询问是否安装推荐的 MCP 服务器

### 1.5 首次消息前检查 Provider

**位置**: `src/session/prompt.ts` 的 `runLoop` 入口

```typescript
// 在发送第一条消息前检查是否配置了 provider
if (!hasConfiguredProvider()) {
  // 注入提示："请先运行 /connect 配置 AI Provider"
  return injectSetupHint()
}
```

---

## Phase 2: 集成本地 Skills & MCP

### 2.1 集成高价值 Skills（开箱即用）

将以下 skill 内置到 `.mtycoder/skills/` 或作为默认 skill 注册：

| Skill | 来源路径 | 价值 |
|-------|---------|------|
| **code-review** | `~/.claude/skills/code-review/` | 通用代码审查，安全+性能+可读性 |
| **tdd-workflow** | `~/.claude/skills/tdd-workflow/` | TDD 流程强制执行 |
| **security-review** | `~/.claude/skills/security-review/` | 安全审查 |
| **search-first** | `~/.claude/skills/search-first/` | "先搜后写" 防止重复造轮子 |
| **frontend-design** | `~/.claude/skills/frontend-design/` | 前端 UI 设计质量 |
| **mcp-builder** | `~/.claude/skills/mcp-builder/` | 帮用户自建 MCP 服务器 |
| **verification-loop** | `~/.claude/skills/verification-loop/` | 迭代验证工作流 |
| **strategic-compact** | `~/.claude/skills/strategic-compact/` | 上下文压缩策略 |

**实现方式**:
```
方案 A: 将 skill 文件复制到 packages/opencode/src/skill/builtin/ 并注册
方案 B: 在首次运行时从模板目录复制到用户的 .mtycoder/skills/
推荐方案 A — 编译进二进制，零配置即用
```

### 2.2 集成高价值 Rules（代码质量标准）

将通用 rules 内置为默认代码规范：

| Rule 文件 | 内容 |
|-----------|------|
| `common/coding-style.md` | 不可变性、文件组织、错误处理、输入验证 |
| `common/security.md` | 安全检查清单（SQL 注入、XSS、CSRF、密钥管理）|
| `common/testing.md` | 80% 覆盖率、TDD 工作流 |
| `common/patterns.md` | Repository 模式、API 响应格式 |

**集成位置**: `src/session/instruction.ts` — 在加载 `AGENTS.md` 时同时加载内置 rules

### 2.3 集成高价值 Agents（专家子代理）

将以下 agent 模板内置：

| Agent | 来源 | 模型 | 用途 |
|-------|------|------|------|
| **architect** | `~/.claude/agents/architect.md` | opus | 系统设计、架构决策 |
| **planner** | `~/.claude/agents/planner.md` | opus | 实施计划制定 |
| **code-reviewer** | `~/.claude/agents/code-reviewer.md` | sonnet | 代码审查 |
| **security-reviewer** | `~/.claude/agents/security-reviewer.md` | sonnet | 安全审查 |
| **tdd-guide** | `~/.claude/agents/tdd-guide.md` | — | TDD 流程引导 |

**集成方式**: 添加到 `src/agent/config.ts` 的 `SYSTEM_SPAWNED_AGENT_TYPES`

### 2.4 集成默认 MCP 服务器

在 `mtycoder.jsonc` 默认模板中预配置：

```jsonc
{
  "mcp": {
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"],
      "description": "实时库文档查询"
    },
    "memory": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic/memory-mcp@latest"],
      "description": "持久化知识图谱"
    }
  }
}
```

**位置**: 修改 `.mtycoder/mtycoder.jsonc` 和 `src/config/` 中的默认配置模板

### 2.5 内置 CCG 质量门系统

从 CCG 系统移植质量门检查流程：

```
代码变更 > 30 行 → 自动触发 /verify-change → /verify-quality
新模块创建 → 自动触发 /gen-docs → /verify-module → /verify-security
安全相关变更 → 自动触发 /verify-security
```

**实现**: 在 `src/plugin/` 中创建 quality-gate 插件，hook into `tool.execute.after`

---

## Phase 3: 借鉴 Claude 机制提升准确性

### 3.1 借鉴 Claude 的 Plan Mode（计划模式）

**Claude 的机制**: 进入 Plan Mode 后，Agent 只做读操作和分析，不修改任何文件。用户确认计划后才进入 Build Mode。

**MtyCoder 现状**: 已有 `plan` agent（只读），但缺少：
- Plan ↔ Build 的无缝切换 UX
- Plan 审批工作流（用户确认后自动切换到 build）
- Plan 文件的持久化和引用

**优化**:
```
src/cli/cmd/tui/thread.ts
  - 添加 Plan/Build 模式切换 UI（Tab 键已绑定）
  - Plan 完成后显示 "确认执行？[Y/n]" 提示
  
src/session/prompt.ts
  - Plan agent 完成后自动暂停，等待用户确认
  - 确认后将 plan 内容注入 build agent 的上下文
```

### 3.2 借鉴 Claude 的 Context Window Management

**Claude 的机制**:
- 自动压缩：接近上下文限制时智能摘要旧消息
- 保留最近 N 轮完整对话
- 系统提示不参与压缩

**MtyCoder 现状**: 已有 `compaction.ts` 和 `checkpoint.ts`，但：
- 压缩阈值可配置但默认偏保守
- Checkpoint 重建后缺少"微压缩"步骤
- 没有"紧急压缩"模式（当突发大输出导致溢出）

**优化**:
```
src/session/compaction.ts
  - 增加 emergency compaction（90% 使用率时立即触发）
  - 保留最近 3 轮完整对话（当前实现可能只保留 1 轮）
  - 压缩后的摘要注入 token budget 控制
  
src/session/overflow.ts
  - 增加 pressure level 4（紧急）用于突发溢出
```

### 3.3 借鉴 Claude 的 Parallel Tool Calling

**Claude 的机制**: 支持在一次回复中并行调用多个独立工具

**MtyCoder 现状**: 已支持并行工具调用（AI SDK 的 `toolChoice: 'auto'`）

**优化空间**:
```
src/session/prompt.ts
  - 检测可并行的工具调用（如多个文件读取）
  - 对 Bash 命令添加超时保护（当前无超时可能导致挂起）
  - 工具调用结果注入时保持原始顺序
```

### 3.4 借鉴 Claude 的 Auto-Edit（自动编辑验证）

**Claude 的机制**: 编辑文件后自动重新读取验证编辑是否正确

**MtyCoder 现状**: 无自动验证机制

**优化**:
```
src/tool/edit.ts
  - 编辑完成后自动 read 验证内容是否匹配预期
  - 如果验证失败，自动重试（最多 2 次）
  - 记录编辑验证日志供调试
```

### 3.5 借鉴 Claude 的 Self-Correction（自我纠错）

**Claude 的机制**: 
- 工具调用失败后分析错误原因并重试
- 编译/测试失败后自动分析日志并修复
- 限制重试次数防止无限循环

**MtyCoder 现状**: 有 doom-loop 检测但缺少智能重试

**优化**:
```
src/session/processor.ts
  - 工具执行失败时注入错误分析提示
  - 测试/构建失败后自动触发 "分析失败原因并修复" 流程
  - 增强 doom-loop 检测：不仅检测重复，还检测"无效循环"
    （如反复编辑同一文件但测试始终失败）
```

---

## Phase 4: 借鉴 Hermes 自动 Skill 生成

### 4.1 理解 Hermes 的机制

Hermes 的核心思想：
1. 监控用户重复执行的手动工作流
2. 当检测到模式时，自动生成可复用的 skill
3. Skill 包含触发条件、执行步骤、验证标准

### 4.2 MtyCoder 的 /distill 命令（已有基础）

**现状**: `/distill` 命令已存在，可以扫描会话轨迹提取可复用模式

**优化方向**:
```
src/session/auto-dream.ts
  - 增强 distill 的模式检测算法
  - 从 "命令序列" 扩展到 "决策模式"（如：每次写新模块都先建目录结构再写代码）
  - 自动生成 SKILL.md 格式的 skill 定义

src/cli/cmd/tui/auto-distill.ts
  - 后台静默运行 distill（不打断用户）
  - 检测到模式后提示用户："检测到重复工作流，是否保存为可复用 Skill？"
  - 用户确认后自动写入 .mtycoder/skills/
```

### 4.3 自动 Skill 评分和推荐

```
评分维度:
  - 重复次数（权重 40%）：出现 3+ 次的模式
  - 节省时间（权重 30%）：每次执行平均节省的交互轮数
  - 置信度（权重 30%）：模式的一致性和可泛化程度

推荐逻辑:
  - score > 0.7 → 自动推荐给用户
  - score > 0.9 → 建议用户发布到社区
```

### 4.4 Skill 市场系统

借鉴 oh-my-claudecode 的插件市场架构：

```
.mtycoder/market/
  sources.json       — 社区 skill 源列表
  installed.json     — 已安装 skill 索引
  cache/             — 缓存的 skill 文件

命令:
  /skill search <query>   — 搜索社区 skill
  /skill install <name>   — 安装 skill
  /skill publish          — 发布自己的 skill
  /skill update           — 更新已安装 skill
```

---

## Phase 5: 核心架构优化（长期）

### 5.1 拆分 prompt.ts（3400+ 行 → 模块化）

```
当前: src/session/prompt.ts (3400+ 行, 混合所有职责)

拆分为:
  src/session/prompt.ts           — 核心 runLoop 编排（~300 行）
  src/session/prompt-tools.ts     — 工具解析和包装（~300 行）
  src/session/prompt-message.ts   — 用户消息构建（~200 行）
  src/session/prompt-gates.ts     — 停止条件检查（~200 行）
  src/session/prompt-shell.ts     — Shell 命令执行（~150 行）
  src/session/prompt-mcp.ts       — MCP 工具集成（~200 行）
```

### 5.2 工具懒加载

```
当前: registry.ts 启动时初始化全部 24+ 工具
优化: 仅在首次调用时初始化

  src/tool/registry.ts
    - 将 Tool.define() 改为工厂函数
    - 注册时只记录元数据，不创建 Effect
    - 首次 resolveTools() 时才实例化
```

### 5.3 记忆系统增量更新

```
当前: reconcileMemory() 每次搜索前同步扫描全目录
优化: 
  - 使用 fs.watch 监听 memory 目录变更
  - 增量更新 FTS 索引（只更新变更的文件）
  - 搜索时直接使用索引，无需 reconcile
```

### 5.4 Provider 适配器模式

```
当前: toModelMessages() 有 250 行 provider-specific 条件逻辑
优化:
  src/session/provider-adapter/
    anthropic.ts    — Anthropic 特定逻辑
    openai.ts       — OpenAI 特定逻辑
    gemini.ts       — Gemini 特定逻辑
    default.ts      — 默认适配器
```

---

## 三、实施优先级

| 优先级 | 任务 | 预估工作量 | 影响面 |
|--------|------|-----------|--------|
| **P0** | 首次运行引导向导 | 1-2 天 | 直接影响新用户留存 |
| **P0** | 修复 Tips 新用户隐藏 | 30 分钟 | 立即改善首次体验 |
| **P0** | 增强 /help 命令 | 2 小时 | 用户自助解决问题 |
| **P1** | 集成 6 个核心 Skills | 1 天 | 开箱即用的编程质量 |
| **P1** | 集成 4 个核心 Agents | 1 天 | 专家子代理能力 |
| **P1** | 集成 context7 + memory MCP | 半天 | 实时文档 + 持久知识 |
| **P1** | 内置 Rules 质量标准 | 半天 | 代码规范开箱即用 |
| **P2** | 自动编辑验证 | 1 天 | 提升编辑准确性 |
| **P2** | 增强 /distill 自动 Skill 生成 | 2-3 天 | 自我进化能力 |
| **P2** | Plan-Confirm-Build 工作流 | 2 天 | 提升复杂任务成功率 |
| **P3** | prompt.ts 拆分 | 3-5 天 | 长期可维护性 |
| **P3** | 工具懒加载 | 1 天 | 启动性能 |
| **P3** | 记忆增量更新 | 2 天 | 搜索性能 |

---

## 四、预期效果

| 指标 | 当前 | 优化后 |
|------|------|--------|
| 新用户首次成功配置时间 | 未知（无引导）| < 2 分钟 |
| 代码编辑准确率 | 基线 | +15-25%（自动验证 + 纠错）|
| 可用 Skills 数量 | 1（effect 示例）| 15+ 内置 |
| 可用 Agents 数量 | 3（build/plan/compose）| 8+（含专家子代理）|
| MCP 服务器 | 0 内置 | 2 内置（context7 + memory）|
| 代码质量标准 | 无 | 内置安全/测试/编码规范 |
| 自动 Skill 生成 | /distill 手动触发 | 后台自动检测 + 推荐 |
| prompt.ts 可维护性 | 3400+ 行单文件 | 6 个职责清晰的模块 |
