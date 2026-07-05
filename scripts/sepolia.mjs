import fs from "node:fs";
import path from "node:path";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  formatEther,
  getAddress,
  http,
  parseEther
} from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const rootDir = process.cwd();
const contractSourcePath = path.join(rootDir, "contracts", "SignalAttestation.sol");
const contractSourceName = "contracts/SignalAttestation.sol";
const contractName = "SignalAttestation";
const deploymentsDir = path.join(rootDir, "deployments");
const deploymentPath = path.join(deploymentsDir, "sepolia.json");
const defaultRpcUrl = "https://rpc.sepolia.ethpandaops.io";
const explorerBaseUrl = "https://sepolia.etherscan.io";
const apiBaseUrl = "https://api.etherscan.io/v2/api";
const chainId = 11155111;

const testReport = {
  id: "rep_eth_001",
  topic: "ETH",
  riskScore: 32,
  alphaScore: 68,
  verdict: "OBSERVE",
  reportHash: "0x224cfdd555031d61f2259f4b40598a6452b04ba594324b8d5c878dc1c8fcec27",
  evidenceHash: "0x27189c3f7d6763c8e5af07c22c095f9a9469b73767ee7683cd8a4361a9c1a28a",
  metadataURI: "chainpulse://reports/rep_eth_001"
};

const command = process.argv[2] ?? "help";

try {
  if (command === "compile") await compileCommand();
  else if (command === "deploy") await deployCommand();
  else if (command === "check") await checkCommand();
  else if (command === "attest-test") await attestTestCommand();
  else if (command === "verify") await verifyCommand();
  else printHelp();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Sepolia ${command} failed: ${message}`);
  process.exitCode = 1;
}

async function compileCommand() {
  const compiled = compileContract();
  console.log(`Compiled ${contractName} with solc ${compiled.solcVersion}`);
  console.log(`ABI entries: ${compiled.abi.length}`);
  console.log(`Bytecode bytes: ${(compiled.bytecode.length - 2) / 2}`);
}

async function deployCommand() {
  const env = readEnv();
  const compiled = compileContract();
  const { publicClient, walletClient, account, rpcUrl } = createClients(env);
  await assertSepolia(publicClient);
  await assertDeployBalance(publicClient, account.address, compiled.bytecode);

  const hash = await walletClient.deployContract({
    abi: compiled.abi,
    bytecode: compiled.bytecode
  });
  console.log(`Deploy tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`deploy receipt status=${receipt.status}`);
  }

  const deployment = {
    chainId,
    network: "sepolia",
    contractName,
    contractAddress: getAddress(receipt.contractAddress),
    deployTx: hash,
    deployer: account.address,
    deployedAt: new Date().toISOString(),
    rpcUrl,
    explorerAddressUrl: `${explorerBaseUrl}/address/${receipt.contractAddress}`,
    explorerTxUrl: `${explorerBaseUrl}/tx/${hash}`,
    abiVariant: "SignalAttestation.attest(bytes32,bytes32,string,uint8,uint8,string,string)",
    solcVersion: compiled.solcVersion,
    sourceVerification: {
      status: "not requested",
      checkedAt: new Date().toISOString()
    }
  };

  writeDeployment(deployment);
  upsertEnvLocal({
    NEXT_PUBLIC_CHAIN_ID: String(chainId),
    NEXT_PUBLIC_CONTRACT_ADDRESS: deployment.contractAddress,
    NEXT_PUBLIC_EXPLORER_BASE_URL: explorerBaseUrl,
    SEPOLIA_RPC_URL: env.SEPOLIA_RPC_URL || defaultRpcUrl
  });

  console.log(`Contract: ${deployment.contractAddress}`);
  console.log(`Explorer: ${deployment.explorerAddressUrl}`);
}

async function checkCommand() {
  const env = readEnv();
  const compiled = compileContract();
  const { publicClient } = createClients(env, { walletRequired: false });
  const deployment = readDeploymentOrEnv(env);
  await assertSepolia(publicClient);
  const code = await publicClient.getCode({ address: deployment.contractAddress });
  if (!code || code === "0x") {
    throw new Error(`no bytecode at ${deployment.contractAddress}`);
  }
  const reportCount = await publicClient.readContract({
    address: deployment.contractAddress,
    abi: compiled.abi,
    functionName: "reportCount"
  });
  console.log(`Contract bytecode is present at ${deployment.contractAddress}`);
  console.log(`reportCount: ${reportCount.toString()}`);
}

async function attestTestCommand() {
  const env = readEnv();
  const compiled = compileContract();
  const { publicClient, walletClient, account } = createClients(env);
  const deployment = readDeploymentOrEnv(env);
  await assertSepolia(publicClient);
  await assertWalletBalance(publicClient, account.address, parseEther("0.0005"));

  const hash = await walletClient.writeContract({
    address: deployment.contractAddress,
    abi: compiled.abi,
    functionName: "attest",
    args: [
      testReport.reportHash,
      testReport.evidenceHash,
      testReport.topic,
      testReport.riskScore,
      testReport.alphaScore,
      testReport.verdict,
      testReport.metadataURI
    ]
  });
  console.log(`Attest tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`attest receipt status=${receipt.status}`);
  }

  const event = findReportAttestedEvent(compiled.abi, deployment.contractAddress, receipt.logs);
  if (!event) {
    throw new Error("ReportAttested event was not found");
  }
  const reportId = event.args.reportId;
  const chainReport = normalizeChainReport(
    await publicClient.readContract({
      address: deployment.contractAddress,
      abi: compiled.abi,
      functionName: "getReport",
      args: [reportId]
    })
  );

  assertChainReportMatches(chainReport, testReport);

  const nextDeployment = {
    ...deployment,
    lastAttestationTest: {
      reportId: reportId.toString(),
      txHash: hash,
      checkedAt: new Date().toISOString(),
      explorerTxUrl: `${explorerBaseUrl}/tx/${hash}`,
      status: "passed"
    }
  };
  writeDeployment(nextDeployment);

  console.log(`ReportAttested reportId: ${reportId.toString()}`);
  console.log(`Verified chain record for ${testReport.topic}/${testReport.verdict}`);
}

async function verifyCommand() {
  const env = readEnv();
  const apiKey = env.ETHERSCAN_API_KEY?.trim();
  const deployment = readDeploymentOrEnv(env);

  if (!apiKey) {
    writeDeployment({
      ...deployment,
      sourceVerification: {
        status: "skipped",
        reason: "ETHERSCAN_API_KEY is not configured",
        checkedAt: new Date().toISOString()
      }
    });
    console.log("Skipped source verification: ETHERSCAN_API_KEY is not configured");
    return;
  }

  const compiled = compileContract();
  const guid = await submitEtherscanVerification(apiKey, deployment, compiled);
  console.log(`Etherscan verification submitted: ${guid}`);
  const verification = await waitForVerification(apiKey, guid);
  const source = await etherscanRequest(apiKey, {
    module: "contract",
    action: "getsourcecode",
    address: deployment.contractAddress
  });
  const abi = await etherscanRequest(apiKey, {
    module: "contract",
    action: "getabi",
    address: deployment.contractAddress
  });

  writeDeployment({
    ...deployment,
    sourceVerification: {
      status: verification.status,
      message: verification.message,
      result: verification.result,
      sourceName: Array.isArray(source.result) ? source.result[0]?.ContractName : undefined,
      abiAvailable: abi.status === "1",
      checkedAt: new Date().toISOString()
    }
  });

  console.log(`Etherscan verification ${verification.status}: ${verification.result}`);
}

function compileContract() {
  const source = fs.readFileSync(contractSourcePath, "utf8");
  const input = {
    language: "Solidity",
    sources: {
      [contractSourceName]: {
        content: source
      }
    },
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"]
        }
      }
    }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors ?? [];
  const fatal = errors.filter((item) => item.severity === "error");
  if (fatal.length > 0) {
    throw new Error(fatal.map((item) => item.formattedMessage).join("\n"));
  }

  const contract = output.contracts?.[contractSourceName]?.[contractName];
  if (!contract?.abi || !contract?.evm?.bytecode?.object) {
    throw new Error(`compiled artifact missing for ${contractName}`);
  }

  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
    standardJsonInput: input,
    solcVersion: solc.version()
  };
}

function createClients(env, { walletRequired = true } = {}) {
  const rpcUrl = env.SEPOLIA_RPC_URL?.trim() || defaultRpcUrl;
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl)
  });

  if (!walletRequired) {
    return {
      publicClient,
      rpcUrl
    };
  }

  const account = getAccount(env);
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl)
  });

  return {
    publicClient,
    walletClient,
    account,
    rpcUrl
  };
}

function getAccount(env) {
  const privateKey = env.SEPOLIA_PRIVATE_KEY?.trim();
  if (privateKey) return privateKeyToAccount(privateKey);

  const mnemonic = env.SEPOLIA_MNEMONIC?.trim();
  if (!mnemonic) {
    throw new Error("SEPOLIA_MNEMONIC is required in .env.local");
  }
  return mnemonicToAccount(mnemonic);
}

async function assertSepolia(publicClient) {
  const currentChainId = await publicClient.getChainId();
  if (currentChainId !== chainId) {
    throw new Error(`RPC returned chainId=${currentChainId}; expected Sepolia ${chainId}`);
  }
}

async function assertDeployBalance(publicClient, address, bytecode) {
  const gasPrice = await publicClient.getGasPrice();
  let required = parseEther("0.001");
  try {
    const gas = await publicClient.estimateGas({
      account: address,
      data: bytecode
    });
    required = gas * gasPrice * 2n;
  } catch {
    required = parseEther("0.003");
  }
  await assertWalletBalance(publicClient, address, required);
}

async function assertWalletBalance(publicClient, address, requiredWei) {
  const balance = await publicClient.getBalance({ address });
  console.log(`Deployer: ${address}`);
  console.log(`Sepolia balance: ${formatEther(balance)} ETH`);
  if (balance < requiredWei) {
    throw new Error(`insufficient Sepolia ETH; need at least ${formatEther(requiredWei)} ETH`);
  }
}

function findReportAttestedEvent(abi, contractAddress, logs) {
  for (const log of logs) {
    if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi,
        data: log.data,
        topics: log.topics
      });
      if (decoded.eventName === "ReportAttested") return decoded;
    } catch {
      // Ignore non-matching logs.
    }
  }
  return null;
}

function normalizeChainReport(value) {
  if (Array.isArray(value)) {
    return {
      reportHash: value[0],
      evidenceHash: value[1],
      topic: value[2],
      riskScore: Number(value[3]),
      alphaScore: Number(value[4]),
      verdict: value[5],
      metadataURI: value[6],
      creator: value[7],
      createdAt: value[8]
    };
  }
  return value;
}

function assertChainReportMatches(actual, expected) {
  const checks = [
    ["reportHash", actual.reportHash?.toLowerCase(), expected.reportHash.toLowerCase()],
    ["evidenceHash", actual.evidenceHash?.toLowerCase(), expected.evidenceHash.toLowerCase()],
    ["topic", actual.topic, expected.topic],
    ["riskScore", actual.riskScore, expected.riskScore],
    ["alphaScore", actual.alphaScore, expected.alphaScore],
    ["verdict", actual.verdict, expected.verdict],
    ["metadataURI", actual.metadataURI, expected.metadataURI]
  ];

  const mismatch = checks.find(([, actualValue, expectedValue]) => actualValue !== expectedValue);
  if (mismatch) {
    throw new Error(`chain report mismatch for ${mismatch[0]}: got ${mismatch[1]}, expected ${mismatch[2]}`);
  }
}

async function submitEtherscanVerification(apiKey, deployment, compiled) {
  const result = await etherscanRequest(apiKey, {
    module: "contract",
    action: "verifysourcecode",
    contractaddress: deployment.contractAddress,
    sourceCode: JSON.stringify(compiled.standardJsonInput),
    codeformat: "solidity-standard-json-input",
    contractname: `${contractSourceName}:${contractName}`,
    compilerversion: `v${compiled.solcVersion}`,
    optimizationUsed: "1",
    runs: "200",
    constructorArguements: "",
    licenseType: "3"
  });
  if (result.status !== "1") {
    throw new Error(`Etherscan rejected verification: ${result.message} / ${result.result}`);
  }
  return result.result;
}

async function waitForVerification(apiKey, guid) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(attempt === 0 ? 2500 : 10_000);
    const result = await etherscanRequest(apiKey, {
      module: "contract",
      action: "checkverifystatus",
      guid
    });
    const text = String(result.result ?? "");
    if (result.status === "1" || /already verified/i.test(text) || /pass/i.test(text)) {
      return {
        status: "passed",
        message: result.message,
        result: text
      };
    }
    if (/pending|queue|processing|in progress/i.test(text)) continue;
    return {
      status: "failed",
      message: result.message,
      result: text
    };
  }
  return {
    status: "pending",
    message: "timeout",
    result: "verification did not finish before timeout"
  };
}

async function etherscanRequest(apiKey, params) {
  const body = new URLSearchParams({
    chainid: String(chainId),
    apikey: apiKey,
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]))
  });
  const response = await fetch(apiBaseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!response.ok) {
    throw new Error(`Etherscan HTTP ${response.status}`);
  }
  return response.json();
}

function readDeploymentOrEnv(env) {
  if (fs.existsSync(deploymentPath)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    if (deployment.contractAddress) {
      return {
        ...deployment,
        contractAddress: getAddress(deployment.contractAddress)
      };
    }
  }

  const contractAddress = env.NEXT_PUBLIC_CONTRACT_ADDRESS?.trim();
  if (!contractAddress) {
    throw new Error("deployment missing; run npm run sepolia:deploy or set NEXT_PUBLIC_CONTRACT_ADDRESS");
  }

  return {
    chainId,
    network: "sepolia",
    contractName,
    contractAddress: getAddress(contractAddress),
    explorerAddressUrl: `${explorerBaseUrl}/address/${contractAddress}`
  };
}

function writeDeployment(value) {
  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.writeFileSync(deploymentPath, `${JSON.stringify(value, null, 2)}\n`);
}

function readEnv() {
  return {
    ...readEnvFile(path.join(rootDir, ".env")),
    ...readEnvFile(path.join(rootDir, ".env.local")),
    ...process.env
  };
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function upsertEnvLocal(values) {
  const envPath = path.join(rootDir, ".env.local");
  const lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8").split(/\r?\n/) : [];
  const remaining = new Map(Object.entries(values));
  const nextLines = lines.map((line) => {
    const separator = line.indexOf("=");
    if (separator === -1) return line;
    const key = line.slice(0, separator).trim();
    if (!remaining.has(key)) return line;
    const value = remaining.get(key);
    remaining.delete(key);
    return `${key}=${value}`;
  });

  for (const [key, value] of remaining) {
    nextLines.push(`${key}=${value}`);
  }

  fs.writeFileSync(envPath, `${nextLines.filter((line, index, arr) => line || index < arr.length - 1).join("\n")}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printHelp() {
  console.log("Usage: node scripts/sepolia.mjs <compile|deploy|check|attest-test|verify>");
}
