# ChainPulse Product Design Audit

## 目标用户

| 用户 | 关键诉求 | 路演判断点 |
|---|---|---|
| ETH Beijing 评委 | 3 分钟内理解产品闭环与可信度 | 不探索侧边栏也能看懂 Agent 如何从输入走到链上证明 |
| Web3 投研用户 | 快速判断风险、证据来源与可复查性 | 报告不是黑盒结论，证据、Trace、Hash 能相互指向 |
| DAO 治理成员 | 复核同一份决策记录 | reportHash、evidenceHash、txHash 能说明记录未被篡改 |

## 核心任务

输入目标 -> Agent 运行 -> 查看 xAPI Trace -> 查看报告 -> 查看链上证明。

## 当前体验优点

| 页面 / 组件 | 优点 |
|---|---|
| `/workspace` | 输入对象、模式选择、Evidence window 和 mock run 状态已经表达了 Agent 任务入口。 |
| `/tasks` | Timeline、实时日志、Trace 入口让 Agent workflow 可观察。 |
| `/trace` | Input / Output JSON、headers、inputHash / outputHash 已经能说明 xAPI 调用可审计。 |
| `/reports` 与 `/reports/[id]` | 报告列表、详情页、证据权重和 Hash 字段已经形成报告复核基础。 |
| `/attestation` | reportHash、evidenceHash、txHash 和 explorer 链接能表达链上证明方向。 |
| `GlobalSearch` | 支持报告、任务、Trace、Watchlist 跨域跳转，适合路演快速定位。 |

## 当前体验阻塞点

| 优先级 | 页面 / 组件 | 问题 | 对路演的影响 |
|---|---|---|---|
| P0 | 全局导航 | 缺少一条明确的评委演示路径，评委需要自己探索页面顺序。 | 3 分钟内可能只看到功能点，看不到完整叙事闭环。 |
| P0 | `/reports/[id]`、`/attestation` | xAPI -> Evidence -> Report -> Hash -> Chain 的链路分散在多个区块里。 | 链上证明看起来像孤立字段，可信度不够直观。 |
| P0 | `ReportCenterPage`、`TracePage` | render 阶段根据 URL query 调用 `setState`。 | 当前可运行，但后续维护和 React 升级中容易产生不可预测渲染。 |
| P1 | `/reports/[id]` | 详情页缺少 verdict rationale，Evidence 也没有直接回跳 Trace。 | 投研用户难以快速回答“为什么是这个结论”。 |
| P1 | `GlobalSearch` | 搜索结果未分组，无结果时没有反馈，跳转后 query 保留。 | 像通用搜索框，不像专业路演工具。 |
| P1 | `/attestation` | 只展示 Hash 和流程，缺少 why on-chain 与本地验证解释。 | 区块链部分容易显得生硬。 |
| P1 | `/workspace`、`/tasks` | ETH 推荐路径、下一步动作和每阶段意义不够明显。 | 讲解者需要口头补齐很多上下文。 |

## 本轮优先级

| 优先级 | 工作项 | 验收口径 |
|---|---|---|
| P0 | 新增 `/demo` 与导航入口 | 评委从 Demo Mode 可按 5 步走完整路径，并复制演示链接。 |
| P0 | 新增 `ProofChain` 并接入报告详情和链上证明 | 页面能直观看到 User Query -> xAPI Actions -> Evidence -> Report -> Hash -> On-chain Attestation。 |
| P0 | 修复 URL query 同步隐患 | `ReportCenterPage` 和 `TracePage` 不在 render 阶段调用 `setState`，URL 初始化仍正确。 |
| P1 | 报告详情可信度精修 | 有 Verdict rationale、Evidence 到 Trace 的链接、行动建议分类和审计可信度卡。 |
| P1 | 搜索、Attestation、Workspace、Tasks 叙事增强 | 搜索分组/空状态/跳转清空，链上原因清晰，ETH demo 推荐路径更明显。 |
