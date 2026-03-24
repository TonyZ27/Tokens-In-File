# 交互说明文档 (Interaction PRD) - Tokens in Page

> 旨在为研发和测试补充视觉验收标准与交互边界（状态、异常流转、鼠标/键盘行为）。本文档紧密贴合您已有的 Figma 设计原型，并针对此前 PRD 中确立的“清理 Unlinked”、“Main Component 溯源”等进阶审查目标进行了交互逻辑补全。

## 1. 全局视口及框架规范
- **默认视口 (Viewport)**: `Width 400px`, `Height 480px` (建议开启拖拽 Resizing 权限，受限于列表长数据的包容性，最小高度限定在 `300px`，最大宽/高不设限以便提供更好的列表呈现)。
- **深色模式 (Dark Mode)**: 插件全系使用 CSS 原生媒体查询直接跟随宿主 Figma UI 的亮暗色偏好，不提供内部手动切换开关以保持原生沉浸感。

## 2. 核心页面流转 (Page Workflows)

### 2.1 首屏：入口与扫描配置页 (Setup & Filter)
> **交互组件与对齐**：为提升点击效率，Type (属性)、Source (来源) 及 Layer Types (层级) 的多选交互统一采用 **`ToggleChip` (胶囊切换按钮)** 替代传统的 Checkbox。

- **页面结构**：作为插件唤起后的默认展示页，它承载全部过滤网。
  - **Type (属性过滤)**: 使用 Select 下拉菜单控件封装（包含 All, Variables, Style），精简主屏空间。
  - **Source (来源过滤)**: 允许组合过滤 `Local`, `Linked`, `Unlinked` 以及已被彻底移除造成的 **`Missing`** 引用。`Missing` 标签取消警示红文案以防引发不必要的误导焦虑。
  - **批量选择 (Select/Deselect All)**：Source / Layer Types 选项组右上侧提供显式的 `Select All` 按钮。
  - **组件视觉降噪**：选中的 `ToggleChip` 防撞色处理，弃用大面积 Fill 色块，转用轻盈的品牌色边框与浅透明底色，与底部的 `Scan` 主按钮拉开视觉层级。
  - **Layer Type (通透匹配判定)**: 包含 `All`, `Component`, `Instance`, `Text`, `Shape`, `Frame` 等选项。各选项固定维护严整的 **3-column 网格布局**，保障列表对齐美感。**注意匹配降级逻辑**：只要组件/容器的上游命中了用户的勾选项，该组件或容器内包裹的所有深层子代节点均被视为“连带命中”。保证结构化查询时不会因为子图层类型不对而漏扫其上绑定的 token。
  - **状态持久化 (State Persistence)**: 从次级页面 (Inventory) 退回首屏时，保留并继承上一次成功发起的扫描参数勾选项。
- **Primary Action (扫描执行)**:
  - 点击 `Scan` 按钮后，按钮自身文案或图标需切换为 Loading 态（如 Spinner），此刻给全屏加上一个隐形的 Overlay 以拦截任何对筛选器的次生点击修改。
  - **中止扫描 (Cancel Scan)**：在 Loading 状态旁边或下方提供一个明确的 `Cancel Scan` 按钮。若扫描耗时过长，用户可随时中止，释放线程阻断并重置界面。

### 2.2 过渡态与空数据 (Empty States)
- **扫描结果为空（返回 0）**：留在当前首屏，在 `Scan` 按钮下方或顶部显示一个醒目的警告 Toast：“当前过滤条件下未发现结果，请调整筛选条件后重试。”
- **扫描成功且有数据**：平滑跳转（推入动画 Slide-in 或直接闪切）至二级“资产列表页”。
  - **返回与重置**：需在二级列表顶部常驻 `< Back to Filter` 按钮或折叠拦，允许用户随时退回首屏重新选择范围。

## 3. 二级与三级：审查与节点归属 (Inventory & Node Details)

### 3.1 二级：变量汇总列表 (Inventory List)
- **全局操作区 (Global Actions)**：
  - **刷新机制与动态监听**：
    - 列表顶部提供带 `Spin` 转圈动效反馈的 `🔄 Refresh` 按钮。
    - **钩子静默联动与状态锁定**：只要当前 Scope 为 `Selection` 或 `Current Page`，当 Figma 抛出对应的 `selectionchange` 或 `currentpagechange` 事件时，插件隐式触发一次后台级刷新以保持数据鲜活度。**交互冲突过滤**：系统必须能识别由插件发起的 `zoom-to-node` 定位操作，并在此时**锁定列表状态**，避免因选中项变更而触发非预期的列表重载，确保用户的审计流不被中断。
  - **变量搜索**：提供一个搜索框（Search Variables by Keyword），允许按名称实时检索与过滤当前列表内的变量。
- **多层级导航布局**：
  - **左侧边栏 (Sidebar)**：展示 Figma Variables/Styles 的 **Collections** 结构。**侧栏宽度固定为 `120px`**，以容纳较长的集合名称，防止文字截断。
    - **排序优先级 (Priority)**：`Variable Collections` (权重 1) > `Styles/Typography` (权重 2) > `Missing` (权重 3) > `Hardcoded` (权重 4)。确保常规资产优先显示，异常类资产（Missing/Hardcode）常驻底部。**同优先级项内部按字母序 (Alphabetical) 排序**。
    - **视觉差异化 (Visual Styles)**: 
      - **Missing**：文本及图标采用红色 (`#f24822`)，配以 `CircleHelp` 图标。
      - **Hardcoded**：采用辅助色 (`text-tertiary`)，配以 `Unlink` 图标。
      - **Active 态**：选中项背景切换为品牌蓝 (`#0d99ff`)，文字与图标统一反白。
  - **右侧主体 (主内容区)**：采用“折叠面板（Accordion）”形态，按 **Variable Group** 名称进行纵向排列。**Variable Group 现已支持自由地展开与收起**。当展开内层后，外层的 Variable Group 与 Variable 标题行均须启动 **Sticky to top（吸顶保护）**，即便在深度滑动时也清晰暴露出所查看层级的父级线索。
- **Global 默认组兜底逻辑**：若解析到的变量并未被分配至任何具体的 Variable Group，系统须强制将其归类至名为 **“Global”** 的面板组中，并将该组**默认悬停在右侧列表的最顶部**，确保散乱变量被优先处理。
- **视觉可读性强化 (Visual Icons)**:
  - **动态属性类型标识**：基于底层识别的 `variableType` 进行差异化渲染。
    - **六边形图标 (Hexagon)**：所有 Variable 类型统一使用 Figma 原生风格的六边形图标（尺寸 10x10，透明度 40%），位置位于数值右侧：`[数值] [图标] [变量名]`。
    - **Typography**：显示为 `Aa` 文本标识。
    - **Missing**：显示为问号/帮助图标 (`CircleHelp`)，颜色为红色 (`#f24822`)。
  - **数值展示规范 (Token Value)**：
    - **Badge 样式**：`String`、`Number`、`Boolean` 统一采用圆角矩形 Badge，Number/Boolean 保持全大写加粗。
    - **颜色圆块**：`Color` 类型仅显示**带细微阴影的圆形色块**，不再显示 Hex 字符串。
  - **图层类型标识**：各具体节点之前（Component，Instance，Text，Shape，Frame 等）均需渲染原生 Figma 风格或寓意明确的结构图标。
- **位置识别提示**：在节点列表的 Frame 标题中，显式包含所属的 **Page 名称**，格式为：`Page Name / Frame Name` (例如：`UI Toolkit / Base Components`)。
- **聚合点击与下钻展开 (Expand to Nodes)**：
  - **引用计数 (Citation Count)**：每个层级变量条目的右侧，清晰展现目前该文件中引用它的总次数（如 `Primary Blue (4)`）。
  - **点击行为**：二级列表中的变量行**不应直接触发单体画布跳转**（因为 1 个引用大于 1 的变量对应了画布上的 N 个散落图层）。点击该变量行，应当是“向下展开 (Expand)”展示一个子集列表，或平滑推入“第三级节点明细页”，暴露出这 4 个具体的引用图层。
- **性能防崩规范 (Virtual Scroll)**：右侧主体的折叠列表由于承载了潜在的万级数据，必须底层支持**虚拟滚动（Virtual Scroll）**。

### 3.2 三级：节点级定位与画布联动 (Layer Nodes & Zoom In)
> **逻辑勘误**：“定位与画布联动”的精准触发点，必须是在树状结构的最底端——也就是**具体的图层节点 (Layer Node)** 级别上。

- **明细列表呈现**：在展开了某一特定变量（或进入三级）后，此区域呈现所有使用了该变量的图层对象，建议按所在 Frame (画板) 组织。
- **明细列表层级减负 (Visual Lightness)**：三级图层（Layer Object）的行容器应弱化边框厚度与背景块面积，避免层级过深时的视觉臃肿。
- **指示器与 Hover 层**：鼠标悬停该节点行时，图层文本自身呈现品牌色高亮转换，并在行末快速唤入品牌色的“瞄准（Target）”图标。最前面的图层类型 Icon 保持中性静默，防止色彩溢出。
- **Click 触发联动**：
  - 单击图层节点行（非 Checkbox 区域），触发高精度定位：Figma 画板自动计算坐标，瞬间居中放大至该唯一图层，并执行 `Selected` 高亮选中。
  - **响应去重**：如果用户已经在明细列表中高频点击切换多个图层，视图缩放应抛弃滑行过渡态，直接闪切到目标，以防引起晕眩。

## 4. 批量排错区 (Batch Actions)

### 4.1 动作触发层可见性与组内全选 (Group Selection)
- **动作按钮激活条件**：动作按钮（Replace 和 Detach）只有在列表中**至少由 Checkbox 勾选了 `>= 1` 个图层节点**时才会激活。
- **未勾选态**：未勾选任何项目时，这部分 UI 应保持禁用（Opacity 50%）以防误触。
- **Variable 层级全选 (Select All in Group)**：
  - **交互位置**：在 Accordion Header (Variable Row) 的变量图标左侧增加 Checkbox。
  - **全选逻辑**：勾选 Header Checkbox，自动选中该变量下当前过滤后可见的所有图层节点。
  - **半选态 (Indeterminate)**：当变量下的子节点被部分勾选时，Header Checkbox 显示为“横杠”图标。
  - **吸顶同步**：当变量行吸顶时，吸顶的粘性表头同步展示对应的 Checkbox 状态及操作逻辑。

### 4.2 核心修补动作响应 (Replace / Detach)
- **Replace (批量映射替换)**:
  - 点击后，就地弹起 Figma 设计规范的下拉搜索栏（Popover Menu）。
  - 用户在输入框中实时检索库里正常的 Variable。点击映射后，弹窗关闭。
  - **批量操作反馈动画**：
    - **成功**：项目行立即显示绿色背景闪烁 -> 600ms 后执行淡出动画 -> 400ms 后从列表中彻底移除。
    - **失败**：保留红色背景、显示 `XCircle` 图标，并在悬停时通过 Tooltip 显示失败原因（如“受限图层”）。
  - **锁定图层替换逻辑**：对于被 Locked 的图层，后台逻辑应为“临时解锁 -> 替换变量 -> 重新锁回去”（保障替换通过）。
- **Detach (解绑为硬编码)**:
  - 操作生效后向工作区底部抛出一个原生带 `Cancel/Undo` 功能的 Toast `(figma.notify)`。用原生提醒兜底由于误触带来的解绑后患。
  - 失败或部分成功表现同上，提供状态分类反馈。

## 5. 异常屏蔽与兜底 (Exceptions Handling)

- **受限的主组件溯源 (Go to Main Component)**: 
  - **查漏纠正提示**：当我们扫到了一个深层次 Variant 实例里的死链接，Figma 后端 API 是无法直接越权 Replace 该属性的。
  - **交互应对**：此时列表点击 Replace 会上抛一条 Error Toast。如果该图层被标记为受保护，列表中该节点右侧须展现一个专门的直达按钮 `Go to Main`，点击强制跳转至其源头画板，引导设计师从上游根治。
- **只读权限 (Read-only)**: 初始化进入时如果 Figma file 属于 View 权限，整个修改组件全盘 Disable，顶部强展现黄色 `Warning Banner - View Only`。
