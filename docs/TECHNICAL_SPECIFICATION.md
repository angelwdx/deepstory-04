# Story Mind 应用程序技术规格说明书 (Technical Specification)

**版本**: 1.0.0
**日期**: 2025-12-26
**状态**: 草稿 (Draft)

---

## 1. 简介 (Introduction)

### 1.1 项目背景

Story Mind 是一款基于生成式 AI（Generative AI）的长篇小说辅助创作工具。旨在解决长篇创作中“逻辑不连贯”、“设定遗忘”和“灵感枯竭”三大痛点。它通过结构化的流水线（Pipeline），引导用户从一个简单的脑洞出发，逐步构建出具备完整世界观、角色体系和严密情节架构的从长篇小说。

### 1.2 文档目的

本文档详细描述了 Story Mind 应用程序的技术架构、数据结构、核心功能模块的输入输出规范以及状态管理机制。旨在为开发人员、Prompt 工程师和测试人员提供统一的技术参照。

### 1.3 核心设计哲学

- **结构化生成 (Structured Generation)**: 将复杂的长篇创作任务拆解为 8 个独立的原子步骤。
- **标签系统 (Tag System)**: 使用自然语言标签作为代码与大模型交互的“协议接口”。
- **状态流转 (State Flow)**: 仅仅生成文本是不够的，必须将生成的非结构化文本转化为结构化的 State 数据，并在步骤间传递。

---

## 2. 系统架构 (System Architecture)

### 2.1 技术栈 (Tech Stack)

- **核心框架**: React 18 + Vite (TypeScript)
- **UI 组件库**: Tailwind CSS (Styling), Lucide React (Icons)
- **状态管理**: React Hooks (`useState`, `useReducer`)
- **数据持久化**: LocalStorage (浏览器本地存储)
- **Markdown 渲染**: `react-markdown` + `remark-gfm`
- **AI 交互层**: 适配多模型的统一 API Service (支持 Google Gemini, OpenAI 等)

### 2.2 数据流架构

系统采用单向数据流。
`User Inputs` -> `Prompt Construction` -> `LLM API` -> `Response Parsing` -> `State Update` -> `UI Rendering`

---

## 3. 核心数据结构 (Data Structures)

系统主要由两个核心 Interface 定义数据形态：

### 3.1 用户输入 (`UserInputs`)

存储用户的初始意图和配置。

```typescript
interface UserInputs {
  topic: string; // 核心脑洞
  genre: string; // 题材分类
  tone: string; // 故事基调
  ending: string; // 结局倾向
  perspective: string; // 叙事视角 (第一/第三人称)
  numberOfChapters: number; // 预计章节数
  wordCount: number; // 每章字数
  novelTitle: string; // 小说名称
  customRequirements: string; // 全局自定义要求
}
```

### 3.2 生成数据状态 (`GeneratedData`)

存储 AI 生成的所有内容，作为系统的"临时数据库"。

```typescript
interface GeneratedData {
  dna: string | null; // 核心DNA (Markdown)
  characters: string | null; // 角色动力学 (Markdown)
  world: string | null; // 世界观 (Markdown)
  plot: string | null; // 情节架构 (Markdown)
  blueprint: string | null; // 章节蓝图 (Markdown - 可解析为结构化数据)
  state: string | null; // 角色状态档案 (Markdown)
  globalSummary: string | null; // 全局故事摘要 (动态更新)
  chapters: Chapter[]; // 已生成的章节列表
  stateHistory: StateArchive[]; // 历史状态存档 (用于回滚/查看)
}
```

---

## 4. 功能模块详细规格 (Module Specifications)

本节详细定义每个创作模块的输入、处理逻辑和输出。

### 4.1 创作初始化 (Module: Initialization)

- **功能**: 收集用户基础意图。
- **输入源**: 用户通过 UI 表单填写。
- **输出**: 填充 `UserInputs` 对象。
- **持久化**: 存入 `localStorage.getItem('storymind_inputs')`。

### 4.2 核心 DNA 生成 (Module: Story DNA)

- **功能**: 确立故事的核心骨架。
- **前置条件**: `UserInputs` 必须非空。
- **输入参数 (Prompt Injection)**:
  - `novel_title` <- `inputs.novelTitle`
  - `topic` <- `inputs.topic`
  - `genre` <- `inputs.genre`
  - ... (其他 `UserInputs` 字段)
- **处理逻辑**:
  1.  加载 `PROMPTS.DNA` 模板。
  2.  执行 `formatPrompt` 替换占位符。
  3.  调用 LLM API。
  4.  **后处理 (Post-processing)**: 使用正则 `/(?:^|\n)(##\s*)?核心DNA\s*\(STORY_DNA\)[\s\S]*/i` 提取核心内容，去除冗余对话。
- **输出**: 更新 `GeneratedData.dna`。

### 4.3 角色动力学 (Module: Character Dynamics)

- **功能**: 设计角色冲突网络。
- **输入参数**:
  - `STORY_DNA` <- `GeneratedData.dna`
- **处理逻辑**: 依据 DNA 中的核心冲突，推导需要的角色配置。
- **输出**: 更新 `GeneratedData.characters`。

### 4.4 世界观构建 (Module: World Building)

- **功能**: 构建服务于剧情的物理/社会规则。
- **输入参数**:
  - `STORY_DNA` <- `GeneratedData.dna`
  - `character_dynamics` <- `GeneratedData.characters`
- **逻辑**: 世界观设定必须激化角色之间的冲突（资源稀缺性设计）。
- **输出**: 更新 `GeneratedData.world`。

### 4.5 情节架构 (Module: Plot Architecture)

- **功能**: 宏观剧情规划。
- **输入参数**:
  - `plot_structure` <- 用户选择的结构模型 (如: 三幕式, 英雄之旅)
  - `STORY_DNA`, `character_dynamics`, `world_building`
- **输出**: 更新 `GeneratedData.plot`。

### 4.6 章节蓝图 (Module: Chapter Blueprint)

- **功能**: 将宏观情节拆解为单元（章节）。
- **技术难点**: 需要生成结构化非常强的文本，以便后续正则解析。
- **输入参数**:
  - `plot_architecture` <- `GeneratedData.plot`
  - `number_of_chapters` <- `inputs.numberOfChapters`
- **输出**: 更新 `GeneratedData.blueprint`。
- **解析逻辑 (Parser)**:
  - 系统会尝试解析此 Markdown，识别 `### 第X章` 格式，从中提取 `定位`、`作用`、`悬念` 等字段，作为后续生成正文的参数。

### 4.7 正文创作与状态机 (Module: Writing & State Machine)

这是系统最复杂的部分，包含一个闭环反馈回路。

#### 4.7.1 步骤一：正文生成

- **Input**:
  - `chapter_blueprint_params` (来自蓝图解析：本章写什么)
  - `current_character_state` (角色现在什么状态)
  - `global_context` (前文发生了什么)
- **Process**: 调用生成模型撰写正文。
- **Output**: 纯文本章节内容。

#### 4.7.2 步骤二：状态同步 (State Sync)

- **Input**: 新生成的章节内容。
- **Process**: 调用 `PROMPTS.STATE_UPDATE`。AI 分析新章节，判断：
  1.  是否有角色受伤、获得物品、关系改变？ -> 更新 `generatedData.state`
  2.  是否揭示了新世界观？ -> 更新 `globalSummary`
- **Output**: 生成新的状态快照（State Snapshot），存入历史记录。

---

## 5. 接口与交互规范 (Interface Specifications)

### 5.1 Prompt 标签协议 (The Tag Protocol)

为了确保非结构化的 LLM 输出能够被程序识别，系统定义了一套强制标签系统。
**规范**: 所有 Prompt 必须要求 AI 在输出特定模块时，使用以下格式包裹：
`## 模块中文名 (MODULE_ID_EN)`

**标签注册表**:

- 核心 DNA: `STORY_DNA`
- 角色: `CHARACTER_DYNAMICS`
- 世界: `WORLD_BUILDING`
- 情节: `PLOT_ARCHITECTURE`
- 蓝图: `CHAPTER_BLUEPRINT`
- 状态: `CHARACTER_STATE`

### 5.2 解析器容错机制 (Parser Robustness)

由于 LLM 输出的不确定性，解析器必须具备容错能力：

1.  **Markdown 清理**: 自动移除 ```markdown 代码块标记。
2.  **标题模糊匹配**: 允许 AI 在标题前后增加空格或符号。
3.  **缺省值填充**: 如果某字段解析失败，使用 "暂无" 或 "正常" 等默认值，防止程序崩溃。

---

## 6. 数据持久化与导出 (Persistence & Export)

### 6.1 自动保存

- 机制: `useEffect` 监听 `inputs` 和 `generatedData` 变化。
- 存储: `localStorage`。
- Key: `storymind_inputs`, `storymind_data`.

### 6.2 项目导出

- 格式: JSON 文件。
- 包含: 输入配置、所有生成数据、用户自定义指令、状态历史。
- 用途: 备份、分享或在不同设备间迁移项目。

---

## 7. 安全性与性能 (Security & Performance)

- **API Key 安全**: API Key 仅存储在用户浏览器的 `localStorage` 中，不经过任何中间服务器，直接从前端请求 LLM 提供商。
- **性能优化**:
  - 大文本渲染: `MarkdownViewer` 应实现虚拟滚动或分页（待优化），避免长篇小说渲染卡顿。
  - API 耗时: 虽然生成过程较长（10s-60s），但通过 `Streaming` (目前项目中使用全量等待，未来可升级为流式) 或加载动画优化用户体验。

---

**附录**: 详细 Prompt 模板内容请参阅 `constants.ts` 文件。
