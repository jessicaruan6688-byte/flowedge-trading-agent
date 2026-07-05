# ChainPulse Agent

An autonomous AI analysis agent that collects multi-source crypto market evidence via xAPI MCP, generates structured risk and alpha reports, and anchors the report and evidence integrity hashes on-chain through a Sepolia smart contract.

## Problem

AI-generated market signals and DAO governance analysis have a fundamental trust problem:

- **Unverifiable inputs** — no way to confirm which data sources actually drove a conclusion
- **No audit trail** — results are ephemeral; there is no persistent, reproducible record
- **Opaque reasoning** — users must trust the system's output without being able to inspect or replay the evidence

## Solution

ChainPulse Agent runs a structured, multi-step evidence pipeline that produces a cryptographically verifiable report:

1. **Evidence collection** — xAPI MCP actions pull structured data from Twitter, Web, News, and on-chain sources
2. **AI-driven reasoning** — LLM plans tool selection, scores each evidence item, and writes a structured report
3. **Deterministic hashing** — SHA-256 of the report JSON and evidence packet, computed locally
4. **On-chain attestation** — `reportHash` + `evidenceHash` + scores written to `SignalAttestation.sol` via browser wallet

Anyone can reproduce the hash from the raw report and verify it matches the on-chain record — without trusting the application.

## Architecture

```
User Input (topic + scan mode)
        │
        ▼
  Agent Planner  ←── LLM (tool selection)
        │
        ├─ xAPI health check
        ├─ Action discovery (search)
        ├─ Schema-first input construction
        └─ Parallel action calls
             ├─ Twitter social signals
             ├─ Web / News articles
             └─ On-chain / market data
        │
        │  XApiTrace per call (input hash, output hash, latency, source mode)
        ▼
  Evidence Normalizer
  (weight, confidence, source attribution, traceId linkback)
        │
        ▼
  LLM Report Writer
  (riskScore 0–100, alphaScore 0–100, verdict, rationale[])
        │
        ▼
  Proof Bundle
  ┌─────────────────────────────────────────────┐
  │  reportHash   = SHA-256(Report JSON)        │
  │  evidenceHash = SHA-256(Evidence Packet)    │
  └─────────────────────────────────────────────┘
        │
        ▼
  SignalAttestation.sol (Sepolia)
  attest(reportHash, evidenceHash, topic, riskScore, alphaScore, verdict)
        │
        ▼
  ReportAttested event + on-chain reportId
```

## AI Agent + Blockchain Integration

The connection between the AI layer and the blockchain layer is the **proof bundle** — a pair of hashes that can be independently recomputed from the raw data.

| Component | Role |
|---|---|
| `agent-planner.ts` | LLM selects which xAPI actions to call based on the topic and scan mode |
| `agent-runner.ts` | Orchestrates the full pipeline: health → search → schema → call → normalize → score → write |
| `report-writer.ts` | LLM generates a structured `Report` with `riskScore`, `alphaScore`, `verdict`, and per-evidence `rationale` |
| `attestation-client.ts` | SHA-256 hashes the Report and Evidence Packet; encodes `SignalAttestation.attest(...)` calldata via `viem`; sends via browser wallet |
| `SignalAttestation.sol` | Stores `(reportHash, evidenceHash, topic, riskScore, alphaScore, verdict)` on-chain; emits `ReportAttested`; exposes `getReport(reportId)` for on-demand verification |

The hash is deterministic: given the same raw report JSON, anyone can recompute `reportHash` and compare it against the on-chain value.

## On-chain Contract Interface

```solidity
// contracts/SignalAttestation.sol
function attest(
    bytes32 reportHash,
    bytes32 evidenceHash,
    string calldata topic,
    uint8 riskScore,
    uint8 alphaScore,
    string calldata verdict,
    string calldata metadataURI
) external returns (uint256 reportId);

function getReport(uint256 reportId) external view returns (Report memory);

event ReportAttested(
    uint256 indexed reportId,
    address indexed creator,
    string topic,
    uint8 riskScore,
    uint8 alphaScore,
    string verdict,
    bytes32 reportHash,
    bytes32 evidenceHash,
    string metadataURI,
    uint256 createdAt
);
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| AI | OpenAI-compatible API (default: `gpt-4.1-mini`), provider-configurable via env |
| Data collection | xAPI MCP — `action.xapi.to` (Twitter, Web, News, Crypto actions) |
| Blockchain client | viem — ABI encoding + `eth_sendTransaction` via EIP-1193 browser wallet |
| Smart contract | Solidity ^0.8.24 — `SignalAttestation.sol` deployed on Sepolia |
| Persistence | File-based JSON store (`.chainpulse/store.json`) |
| Testing | Vitest + Testing Library |

## Evidence Pipeline Detail

### 1. xAPI Action Calls (schema-first)

```
GET  /api/xapi/schema?action=<actionId>   → discover required input fields
POST /api/xapi/call { action, input }     → execute and return structured result
```

Every call produces an `XApiTrace` recording the input hash, output hash, latency, HTTP status, and source mode (`live` / `partial` / `fallback`).

### 2. Evidence Normalization

Raw xAPI outputs are normalized into `EvidenceItem[]`:

- `weight` (0–1): signal relevance to the query topic
- `confidence` (0–1): assessed reliability of the data source
- `sourceMode`: `live` | `partial` | `fallback`
- `traceId`: direct link back to the `XApiTrace` that produced this item

### 3. Proof Bundle Construction

```typescript
// attestation-client.ts
reportHash   = SHA-256(JSON.stringify(report, null, 0))
evidenceHash = SHA-256(JSON.stringify(evidencePacket, null, 0))
```

`verifyProofBundle(report, evidence, record)` recomputes both hashes locally and compares them against a stored or on-chain record — no network required.

## Setup

### Environment Variables

```env
# .env.local

# AI (required for live scoring)
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1   # override for compatible providers
OPENAI_MODEL=gpt-4.1-mini

# xAPI MCP (server-side only — never exposed to browser)
XAPI_KEY=
XAPI_ACTION_HOST=action.xapi.to
XAPI_TIMEOUT_MS=12000

# Sepolia testnet
SEPOLIA_RPC_URL=https://rpc.sepolia.ethpandaops.io
SEPOLIA_MNEMONIC=                            # deployment only
ETHERSCAN_API_KEY=                           # source verification only

# Browser-side chain config
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_CONTRACT_ADDRESS=               # set after deploy
NEXT_PUBLIC_EXPLORER_BASE_URL=https://sepolia.etherscan.io
```

### Run

```bash
npm install
npm run dev          # binds to 0.0.0.0:3000
```

For NAT traversal / tunnel access:

```bash
TUNNEL_ORIGIN=<public-ip>:<port> npm run dev
```

### Deploy Contract

```bash
npm run contract:compile     # compile SignalAttestation.sol
npm run sepolia:deploy       # deploy and write NEXT_PUBLIC_CONTRACT_ADDRESS to .env.local
npm run sepolia:check        # verify bytecode exists and read reportCount
npm run sepolia:attest:test  # end-to-end: attest → receipt → decode ReportAttested → compare on-chain record
npm run sepolia:verify       # submit source to Etherscan (requires ETHERSCAN_API_KEY)
```

### Tests

```bash
npm run test
npm run typecheck
npm run lint
```

## API Routes

```
POST /api/agent/run          start agent task (async background job, returns taskId immediately)
GET  /api/tasks              list persisted tasks
GET  /api/tasks/[id]         get task + report + traces
GET  /api/reports            list reports
GET  /api/reports/[id]       get report detail
GET  /api/traces             list xAPI traces (filterable by taskId)
GET  /api/xapi/health        xAPI connectivity check
GET  /api/xapi/search        action discovery
GET  /api/xapi/schema        action schema
POST /api/xapi/call          execute xAPI action
```

## Key Source Files

```
src/lib/server/
  agent-planner.ts     LLM tool selection from xAPI action candidates
  agent-runner.ts      Full pipeline orchestration
  ai-service.ts        OpenAI-compatible LLM client
  report-writer.ts     Structured report generation from evidence
  xapi-service.ts      xAPI MCP server-side calls
  xapi-normalize.ts    Raw xAPI output → EvidenceItem normalization
  agent-store.ts       File-based persistence (.chainpulse/store.json)

src/lib/adapters/
  attestation-client.ts  SHA-256 hashing + viem calldata encoding + wallet send

contracts/
  SignalAttestation.sol  On-chain report integrity store

scripts/
  sepolia.mjs            Deploy / check / attest-test / verify scripts
```

## Fallback Behavior

When live services are unavailable the system degrades explicitly — it never silently fabricates data:

| Capability | Live path | Fallback |
|---|---|---|
| xAPI data | Server route → `XAPI_KEY` → `xapi-to` CLI | Returns structured mock; traces marked `fallback` |
| AI scoring | `OPENAI_API_KEY` → LLM API | Returns zero-score report; `sourceMode: fallback` |
| Attestation | Browser wallet → `SignalAttestation.attest()` | Button disabled; missing config shown explicitly |
| Explorer links | `NEXT_PUBLIC_EXPLORER_BASE_URL` + tx/address | Links omitted; no fabricated URLs |
