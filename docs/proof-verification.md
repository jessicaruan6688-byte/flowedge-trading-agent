# Proof Verification

ChainPulse 的证明链分为三层：xAPI runtime trace、report/evidence hash、本地或链上 proof receipt。目标是让评委和后续 DAO 复核者能确认同一份报告没有被静默改写。

## 证明对象

| 对象 | 说明 | 页面 |
|---|---|---|
| xAPI runtime trace | Agent 对外部 action 的 health/search/schema/call 过程，含 input/output hash。 | `/trace` |
| Report JSON | 报告主体内容。计算 hash 时排除 `reportHash` 和 `evidenceHash` 字段，避免自引用。 | `/reports/[id]` |
| Evidence packet | evidence 数组中的 `id`、`source`、`title`、`summary`、`weight`。 | `/reports/[id]`、`/attestation` |
| Proof receipt | `reportHash`、`evidenceHash`、`txHash`、wallet、block、timestamp。 | `/attestation` |

## 本地复算流程

1. 使用稳定 JSON 序列化：对象 key 排序，数组保持原顺序。
2. 对 Report payload 计算 SHA-256，得到 `reportHash`。
3. 对 Evidence packet 计算 SHA-256，得到 `evidenceHash`。
4. 与 receipt 展示的 `Report Hash` 和 `Evidence Hash` 比较。
5. 页面显示 `Report Hash match` 和 `Evidence Hash match`。

实现位置：

```txt
src/lib/adapters/attestation-client.ts
```

核心函数：

```txt
createDeterministicHash()
createReportHash()
createEvidenceHash()
verifyProofBundle()
```

## 链上证明配置

环境变量：

```env
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_EXPLORER_BASE_URL=https://sepolia.etherscan.io
```

默认合约 ABI：

```solidity
function attest(
  bytes32 reportHash,
  bytes32 evidenceHash,
  string topic,
  uint8 riskScore,
  uint8 alphaScore,
  string verdict,
  string metadataURI
) returns (uint256 reportId)
```

链上调用路径：

1. `readAttestationConfig()` 读取链 ID、合约地址、Explorer。
2. `prepareChainAttestation()` 用 `viem` 编码 calldata。
3. `chainAttestationClient.attestReport()` 调用浏览器钱包的 `eth_sendTransaction`。
4. 钱包返回 tx hash 后，页面更新 receipt。

## Sepolia 自动验证

项目包含 `contracts/SignalAttestation.sol` 和 Sepolia 脚本：

```bash
npm run contract:compile
npm run sepolia:deploy
npm run sepolia:check
npm run sepolia:attest:test
npm run sepolia:verify
```

`sepolia:attest:test` 会确认合约 bytecode、调用 `attest(...)`、等待交易成功、解码 `ReportAttested` 事件，并读取 `getReport(reportId)` 比对 reportHash、evidenceHash、topic、riskScore、alphaScore、verdict 与 metadataURI。`sepolia:verify` 需要 `ETHERSCAN_API_KEY`；没有 key 时会跳过源码验证但保留链上功能验证。

## 状态边界

| 状态 | 含义 | UI 行为 |
|---|---|---|
| `Live ready` | 合约地址和 Explorer 已配置；钱包可用时能发真实交易。 | 展示 live readiness，钱包缺失时按钮仍禁用。 |
| `Mock fallback` | 可展示本地 mock receipt，但不会声称已真实写链。 | 明确标注 fallback。 |
| `Not configured` | 缺少 `NEXT_PUBLIC_CONTRACT_ADDRESS`。 | 禁用真实写链按钮，并说明缺少配置。 |

## 复核问题清单

| 问题 | 应如何回答 |
|---|---|
| 这是不是截图证明？ | 不是。页面会下载 proof bundle，并本地复算 report/evidence hash。 |
| 没有链上配置时是否伪造交易？ | 不会。按钮 disabled，页面显示 `not configured` / `mock fallback`。 |
| xAPI 密钥是否泄露？ | 不会。浏览器只调用 `/api/xapi/*`，`XAPI_KEY` 只在服务端读取。 |
| 证据能否回到原始调用？ | 可以。Report evidence 卡片链接到对应 Trace，Trace 保留 action、schema、input/output hash。 |
