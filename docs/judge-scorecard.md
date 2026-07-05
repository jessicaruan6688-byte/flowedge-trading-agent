# ChainPulse Judge Scorecard

这份清单用于黑客松/路演前自检，目标是让评委在 3 分钟内确认：ChainPulse 不是静态 mock UI，而是有 xAPI 调用路径、证据链、哈希复算和链上证明准备度的 Agent 原型。

## 评分目标

| 维度 | 目标分 | 当前证明点 |
|---|---:|---|
| 产品叙事 | 20/20 | `/demo` 串起 Workspace、Tasks、Trace、Report、Attestation，并提供 `100-point judge checklist`。 |
| 工程质量 | 25/25 | `lint`、`typecheck`、`test`、`build` 作为验收门；xAPI 密钥只在服务端读取；schema-first 调用有测试。 |
| 功能完整度 | 20/20 | Workspace Run Agent 执行 `health -> search -> schema -> call`，Trace 和 Report 可回溯。 |
| 创新与记忆点 | 20/20 | Proof bundle 可本地复算；证据卡展示来源 action、权重、贡献和 Trace 链接。 |
| 真实落地可信度 | 14-15/15 | 无合约时明确 `not configured`；有合约、Explorer、钱包时开启真实链上交易入口。 |

## 10 秒评委检查

| 检查项 | 页面 | 通过口径 |
|---|---|---|
| Agent workflow | `/workspace` | 点击 `Run Agent` 后会保存 runtime trace，不只是保存表单。 |
| xAPI integration | `/trace` | 显示 `live xAPI`、`no XAPI_KEY` 或 `upstream failed`，状态不伪装。 |
| Schema-first call | `/trace` | 调用详情显示 `schema-first call`，并保留 input/output hash。 |
| Evidence traceability | `/reports/rep_eth_001` | 每个 evidence 能说明 source action、weight、contribution 和 trace link。 |
| Local hash verification | `/attestation` | 显示 `Report Hash match` 与 `Evidence Hash match`。 |
| On-chain readiness | `/attestation` | 显示 `Contract configured`、`Explorer configured`、`Wallet mode`；缺配置时按钮禁用。 |
| Test/build readiness | 终端 | `npm run lint && npm run typecheck && npm run test && npm run build` 全通过。 |

## 推荐演示顺序

| 时间 | 页面 | 讲解重点 |
|---|---|---|
| 0:00-0:20 | `/demo` | 展示完整闭环和 100 分清单。 |
| 0:20-0:50 | `/workspace` | 说明 Agent run 会真实调用 route client。 |
| 0:50-1:20 | `/tasks` | 展示阶段日志和可观察 runtime。 |
| 1:20-1:55 | `/trace?task=task_eth_risk_001` | 说明 schema-first xAPI 调用和 hash。 |
| 1:55-2:35 | `/reports/rep_eth_001` | 说明结论如何由 evidence 支撑。 |
| 2:35-3:00 | `/attestation` | 展示本地复算、mock/live 边界和真实链上准备度。 |

## 不应承诺的内容

| 场景 | 必须如实说明 |
|---|---|
| 没有 `XAPI_KEY` | 当前是 `no XAPI_KEY / mock fallback`，不是 live xAPI。 |
| 上游 xAPI 失败 | 当前是 `upstream failed / mock fallback`，保留错误摘要但不泄露密钥。 |
| 没有合约地址 | 当前是 `not configured`，不会伪造真实上链交易。 |
| 没有钱包 | 合约可配置，但真实写链按钮应 disabled。 |
| ABI 不同 | 需要调整 `src/lib/adapters/attestation-client.ts` 内的 `attestationAbi`。 |
