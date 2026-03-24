# Product Requirements Document (PRD) - Tokens in Page

## 1. Executive Summary

- **Problem Statement (核心痛点)**：在复杂的 Figma 设计项目中，不仅图层会频繁出现失效的引用（Missing Tokens）和未绑定规范的硬编码（Unlinked），**更严重的挑战在于长周期的设计迭代导致的替换成本，使得过往的旧版设计资产极难被追踪和统一管理。** 新旧样式混杂且缺乏清晰的审计脉络，极大地降低了开发与设计文件的可维护性并加剧了设计债务。
- **Proposed Solution (解决方案)**：构建专属 Figma 插件 **Tokens in Page**，进行页面/图层级别的深度扫描与审查。插件提供“审查定界 -> 资产结构树 -> 画布快速定位溯源”的闭环链路，并辅以解绑（Detach）、批量替换（Replace）的操作来一站式纠偏资产。
- **Success Criteria (成功指标)**：
  - 显著提升设计师全盘整理、清理单文件设计资产的运转效率。
  - 对于千级数量节点的文件扫描诊断结果能在 1-2 秒内稳定呈现。

---

## 2. User Experience & Functionality

### 2.1 User Personas (目标用户)
- **UX/UI 设计师**：日常项目走查与交付前设计规范校验。
- **Design Ops (设计维稳人员)**：清理企业级 Design System 组件库中的冗余历史属性。

### 2.2 User Stories (需求场景)
- `作为一名设计师，我希望` 能够划定特定的“页面或选中图层”进行扫描， `以便` 我可以分步清理庞大的旧项目，防止一次性扫描死机。
- `作为一名设计师，我希望` 能一键从脏数据列表定位跳转 (Zoom In) 并选中相关源图层， `以便` 第一时间看清该图层的视觉上下文，判断是否可以安全替换。
- `作为一名设计师，我希望` 对于受限制的组件实例中的错误样式，能有明确的快捷入口直达其主组件（Main Component）， `以便` 从根源解除实例覆盖问题。
- `作为一名设计师，我希望` 针对一堆毫无规范的硬编码属性提供快速的“解绑 (Detach)”或是“统一覆盖为新 Token”的功能， `以便` 大幅节省逐个双击画板去重设属性的时间。

### 2.3 Acceptance Criteria (验收标准)
- **多维度检索定界 (Setup & Filter)**：
  - 支持 `Entire File`, `Current Page`, 及 `Current Layer`。
  - 核心属性支持过滤查询 `Local`，跨库 `Linked` 以及包含硬编码的脱离引用 `Unlinked`。
- **结构化资产列表 (Inventory List)**：
  - 按照 Variable Group / Styles 形成折叠面板（无组织变量统一归类至 'Global'）。
  - 右侧显示依赖计数（例如 `Color Primary (12)`）。
- **节点操作交互 (Details & Actions)**：
  - 点击列表图层项可立刻在 Figma 画布居中放大该节点对象（Zoom/Pan）。
  - 针对只读状态和被锁（Locked）的节点做视觉置灰禁用处理。
  - 勾选多项后可执行 `批量替换 (Replace)` 或弱视觉展示的 `样式解绑 (Detach)`。
- **无干扰审计定位 (Status Locking)**：点击列表项进行 Zoom 定位时，插件需能识别此操作为内部触发，从而在 `Selection` 模式下自动跳过针对该事件的列表刷新，确保审计上下文不丢失。

### 2.4 Non-Goals (明确不做范围)
- Style 的审计与操作中，当前阶段 **仅支持 Typography（文本样式）**，暂不处理 EffectStyles / GridStyles 相关的审查与排错逻辑。
- 不提供复杂跨文件自动同步或组件版本控制，不参与云端云组件同步冲突（一切以 Figma 本地 API 提取值为准）。

---

## 3. Technical Specifications

### 3.1 Architecture Overview (架构概览)
- **核心技术栈**：采用 **React + TypeScript**，保证后期工程的组件化可维护性与类型安全。界面生态完全遵照 Figma 官方 UI 设计系统标准（Noto Sans，极简暗浅色调支持）。
- **生命周期线程隔离**：
  - **Main Thread (核心控制器)**：挂载于 Figma 内存插件沙箱。负责在后台通过 DFS/BFS 深度遍历 `figma.currentPage.findAll()`，快速提炼 Node 上的 `boundVariables` 及文字属性。**每次扫描前必须显式调用 `cacheVariables.clear()` 和 `cacheCollections.clear()` 以防止跨文件缓存污染。**
  - **UI Thread (展示界面)**：利用 React Hook 及 Context 管理繁杂的面板数据状态。**静默同步监听与状态锁定**：通过捕获 `figma.on('selectionchange')` 和 `figma.on('currentpagechange')` 事件进行自动重扫。**冲突处理机制**：通过传递 `source` 载荷区分“用户手动点选”与“插件内部定位”，从而在执行图层定位时保持列表数据的稳定性，实现“审计状态锁定”。

### 3.2 Integration Points (集成点)
- **Figma API 集成**：强依赖 `figma.variables`（解析与反查询变量信息）、`figma.viewport.scrollAndZoomIntoView()` 以及 `figma.notify()` 反馈机制。
- **性能优化手段 (Performance Hook)**：由于 React 界面面临万级长列表节点，强制引入 `react-window` 或等效的虚拟滚动（Virtual List），防止 iframe 崩溃。

### 3.3 Security & Privacy (数据隐私)
- 高度合规：无任何第三方接口或后端中转器。全部递归遍历、映射替换仅在当前所激活的 Figma 桌面端/Web版内存中闭环执行。

---

## 4. Risks & Roadmap

### 4.1 Phased Rollout (发布规划)
- **MVP 版本 (当前实现)**：完成 Setup (ToggleChips 交互机制与全选/反选支持)、处理 Variables 与 Typography Styles 维度的 Local / Linked / Unlinked / Missing 类型。跑通底层的 Zoom 溯源、Main Component 跳转与解绑 (Detach) 能力。
- **v1.1 版本**：攻关超大文件性能边界（分片扫描控制台与 Generator 异步化），开放整个 File 的扫描计算；引入高级全局搜索（跨 Collection 检索）与批量的精准 Replace 能力。

### 4.2 Technical Risks (技术风险)
- **大图层树导致的假死与阻塞**：(超过 50k 图层时) UI 主线程直接遍历计算会引发长耗时的卡顿甚至插件挂掉。
  - **规避预案**：通过对遍历代码分片异步处理（如 `Promise` 定时器 / Generator 让出主时间片），配套展现渲染级的 Loading 态并具备“主动 Cancel 扫描”熔断机制。
- **深层实例的数据覆盖被吞（Instance Override Blocks）**：通过 API 强制篡改一个被上层属性锁定的 Variant 变量偶尔触发不可控失败。
  - **规避预案**：底层须配有极其严谨的 `Try/Catch` 校验。针对 **Locked (被锁定)** 的图层，执行“临时解锁 -> 执行 Replace -> 还原锁定状态”的原子操作链以通过权限校验。在 API 抛出拦截或异常时向业务侧展现反馈。
