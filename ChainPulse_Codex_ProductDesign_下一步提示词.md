# ChainPulse Agent Product Design 路演体验优化提示词

你是 Codex。请在当前项目 `/Users/a111/chen/beijin` 中继续开发 ChainPulse Agent Web Demo。

**本轮必须使用 [@product-design](plugin://product-design@openai-curated-remote) 插件能力**：先从产品设计视角审查当前 Web 端体验，再实施高优先级改进。请把 Product Design 的关注点落到：评委 3 分钟能否看懂、xAPI 价值是否突出、链上证明是否可信、页面之间是否形成完整叙事闭环。

当前项目已经完成：

- Next.js 16 + React 19 + TypeScript + TailwindCSS。
- 7 个主路由：`/workspace`、`/tasks`、`/reports`、`/trace`、`/attestation`、`/watchlist`、`/settings`。
- 报告详情路由：`/reports/[id]`。
- 全局搜索：支持 report / task / trace / watchlist。
- URL query 状态：
  - `/reports?query=ZEC&verdict=CAUTION&minRisk=60`
  - `/trace?trace=trace_004&headers=open`
  - `/watchlist?target=wl_curve`
- adapter 占位层：
  - `src/lib/adapters/xapi-client.ts`
  - `src/lib/adapters/attestation-client.ts`
- 当前验证已通过：
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`，当前约 19 个用例
  - `npm run build`

本轮继续聚焦桌面 Web 端，暂时不要做移动端。

## 一、本轮不要做什么

- 不做移动端适配。
- 不接真实 xAPI。
- 不接真实钱包或合约。
- 不引入大型 UI 框架。
- 不做 landing page。
- 不推翻现有视觉风格。
- 不删除当前已有页面、路由和测试。

## 二、Product Design 审查任务

请先用 Product Design 视角完成一次简短审查，并把结果写入：

```txt
docs/product-design-audit.md
```

审查结构：

1. **目标用户**：ETH Beijing 评委、Web3 投研用户、DAO 治理成员。
2. **核心任务**：输入目标 -> Agent 运行 -> 查看 xAPI Trace -> 查看报告 -> 查看链上证明。
3. **当前体验优点**。
4. **当前体验阻塞点**。
5. **本轮优先级**：按 P0 / P1 排序。

审查要具体，不要泛泛写“优化视觉”。每个问题都要对应到页面或组件。

## 三、P0：新增 Demo Mode / Judge Flow

目标：让评委不需要探索页面，也能按 3 分钟路径理解项目价值。

新增路由：

```txt
/demo
```

新增导航入口：

- Sidebar 顶部或 API 配额卡片上方增加 `Demo Mode` / `评委演示` 入口。
- Header 可增加一个低调的 `Demo Mode` 按钮，但不要破坏当前布局。

`/demo` 页面内容：

1. 顶部标题：`ChainPulse Agent Demo Flow`
2. 一句话价值：
   - `AI Agent uses xAPI to collect multi-source evidence, generates an auditable report, and anchors report/evidence hashes on-chain.`
3. 3 分钟演示路径卡片：
   - Step 1 `/workspace`：输入 ETH，选择 Risk Scan。
   - Step 2 `/tasks`：看 Agent 运行、Timeline、日志。
   - Step 3 `/trace?task=task_eth_risk_001`：看 xAPI action、schema、input/output hash。
   - Step 4 `/reports/rep_eth_001`：看风险分、证据、行动建议。
   - Step 5 `/attestation`：看 reportHash、evidenceHash、txHash。
4. 每一步要有：
   - 目标
   - 评委应该看什么
   - CTA 按钮
   - 预估讲解时间
5. 右侧增加 `What judges should notice` 面板：
   - xAPI 动态能力发现
   - Schema-first tool calling
   - Evidence-linked reasoning
   - On-chain hash proof
6. 增加 `Copy demo links` 按钮，下载或复制包含上述链接的 JSON / 文本。

要求：

- 桌面端布局为左侧流程、右侧评委观察点。
- 不做大 hero，不做营销页。
- 风格延续当前 SaaS Dashboard。
- 增加测试：`/demo` 能渲染，CTA 链接存在。

## 四、P0：新增 Proof Chain 可视化组件

目标：强化“xAPI -> Evidence -> Report -> Hash -> Chain”的产品理解。

新增组件：

```txt
src/components/ui/ProofChain.tsx
```

使用场景：

- `/reports/[id]`
- `/attestation`
- 可选：`/demo`

内容节点：

1. User Query
2. xAPI Actions
3. Evidence Packet
4. Report JSON
5. Report Hash / Evidence Hash
6. On-chain Attestation

要求：

- 用 HTML/CSS + icons 实现，不引入图表库。
- 每个节点显示简短状态，例如 `schema fetched`、`2 evidence items`、`hash ready`、`tx confirmed`。
- 节点之间使用细线或箭头连接。
- 桌面端横向展示，必要时允许横向滚动。
- 可复用，接受 props：
  - `topic`
  - `mode`
  - `actions`
  - `evidenceCount`
  - `reportHash`
  - `evidenceHash`
  - `txHash`
  - `attested`

## 五、P0：修复 URL 状态同步的实现隐患

当前 `ReportCenterPage` 和 `TracePage` 使用了 render 阶段的 `setState` 来同步 query 状态。虽然测试和构建通过，但这不利于长期维护。

需要修复：

- [src/components/pages/ReportCenterPage.tsx]
- [src/components/pages/TracePage.tsx]
- 如有类似模式，也一并修。

要求：

- 不在 render 阶段调用 `setState`。
- 使用以下二选一：
  1. 直接从 `useSearchParams()` 派生展示状态，只在用户交互时 `router.push`。
  2. 用 `useEffect` 同步 URL -> state，并确保不会产生循环更新。
- 保持现有测试通过。
- 增加一个测试，确保从 URL query 进入时页面状态正确。

## 六、P1：报告详情页产品设计精修

当前 `/reports/[id]` 已有详情页，但信息层级还可以更像“可审计报告”。

请优化：

1. 顶部加入 `Verdict rationale` 区块：
   - 用 2-3 条 bullet 解释为什么是 `OBSERVE / CAUTION / POSITIVE`。
   - 内容从 mock 数据推导即可。
2. Evidence 卡片增加：
   - source action badge
   - evidence weight
   - `View related Trace` 链接，跳到 `/trace?trace=<id>` 或按 source 找到相关 trace。
3. Actions 建议增加分类：
   - `Observe`
   - `Risk Control`
   - `DAO / Governance`
4. 右侧不要重复两个相同的 distribution：
   - `xAPI sources summary`
   - `Evidence weight distribution`
   当前两者都用同一组数据，需做出差异或删掉一个。
5. 增加“审计可信度”小卡：
   - Evidence linked
   - Hash generated
   - Attestation status

## 七、P1：全局搜索产品细节

当前全局搜索可用，但还可以更像专业工具。

请优化：

- 搜索结果按类型分组：
  - Reports
  - Tasks
  - xAPI Trace
  - Watchlist
- 无结果时显示轻量 empty state，而不是无反馈。
- 打开结果后清空 query。
- 高亮匹配关键词，简单 `<mark>` 即可。
- 搜索结果里优先展示更适合路演的结果：
  - ETH report
  - ETH running task
  - failed trace
  - attested report
- 增加测试覆盖：
  - 无结果状态。
  - 打开结果后调用 router push。
  - 键盘选择仍可用。

## 八、P1：Attestation 页面可信度增强

目标：让区块链部分“不生硬”，能说明为什么要上链。

请在 `/attestation` 增加：

1. `Why on-chain?` 卡片：
   - Proves report existed at timestamp
   - Proves report/evidence not modified
   - Lets DAO review the same decision record
2. `Verify locally` mock 区块：
   - 展示 reportHash / evidenceHash 的 recompute 说明。
   - 提供 `Download proof bundle` 按钮，下载 JSON。
3. 使用 `ProofChain` 展示证明路径。

## 九、P1：Workspace 和 Tasks 叙事增强

Workspace：

- 快速案例卡片增加 `Demo recommended` 标记，用于路演推荐 ETH Risk Scan。
- 最近报告表格中的报告标题可点击进入 `/reports/[id]`。
- Run Agent 后按钮不要一直保持 loading 状态；跳转前可以短暂 loading，但进入任务页前应可恢复或无需持久。

Tasks：

- 当前任务右侧增加 `Next step` 面板：
  - `Inspect xAPI Trace`
  - `Open Report Draft`
  - `Prepare Attestation`
- Timeline 每个阶段增加一句“为什么重要”的短说明，面向评委解释 Agent workflow。

## 十、文档更新

更新 `README.md`：

- 增加 `/demo` 路由说明。
- 增加 Product Design audit 文件说明。
- 更新 3 分钟路演脚本，把 `/demo` 作为起点。
- 增加 Proof Chain 说明。

## 十一、测试要求

完成后必须补充或更新测试，至少覆盖：

- `/demo` 页面渲染和 CTA 链接。
- `ProofChain` 在 report detail 或 attestation 中显示关键节点。
- `ReportCenterPage` 和 `TracePage` 不依赖 render 阶段 setState 后仍能从 URL query 正确初始化。
- Report detail 中 `View related Trace` 链接存在。
- Global search 无结果 empty state。
- Workspace 最近报告标题能跳转到报告详情。

## 十二、验证命令

完成后必须运行：

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

再启动：

```bash
npm run dev
```

桌面端手动验收：

- 打开 `/demo`，按流程进入 `/workspace`、`/tasks`、`/trace`、`/reports/rep_eth_001`、`/attestation`。
- 打开 `/reports/rep_eth_001`，确认 Proof Chain、Evidence、Trace link、hash proof 都可见。
- 打开 `/trace?trace=trace_004&headers=open`，确认失败 trace 和 headers 直接可见。
- 使用全局搜索搜索不存在的词，看到 empty state。
- 1440px 宽度下无明显遮挡、错位、过度留白。

## 十三、最终回复必须包含

请用简体中文汇报：

1. 是否使用 Product Design 插件视角完成审查。
2. `docs/product-design-audit.md` 内容摘要。
3. 新增/修改文件清单。
4. `/demo` 实现说明。
5. `ProofChain` 实现说明。
6. Report detail 精修说明。
7. 全局搜索精修说明。
8. URL 状态同步修复说明。
9. 测试与构建验证结果。
10. 本地预览地址。
11. 剩余风险和下一步建议。

如果插件能力不可用，也必须明确说明，并继续按 Product Design 审查框架完成同等输出。
