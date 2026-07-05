export type AppLanguage = "en" | "zh";

export const defaultLanguage: AppLanguage = "zh";

const translations = {
  en: {
    /* ---------- Language switcher ---------- */
    "language.switch": "Switch language",
    "language.next": "中文",

    /* ---------- Brand / Header ---------- */
    "brand.name": "flowEdge",
    "brand.nameShort": "flowEdge",
    "shell.subtitle": "AI Master Investor Tribunal",
    "header.reviewConsole": "Trading Desk",
    "header.operational": "Live",
    "header.notifications": "Notifications",
    "header.operatorWorkspace": "flowEdge Trading",
    "header.portfolioValue": "Portfolio",
    "header.connectWallet": "Connect Broker",
    "header.connectedWallet": "Broker Connected",

    /* ---------- Navigation (matches navigation.ts) ---------- */
    "nav.workspace": "Trading Desk",
    "nav.court": "Courtroom",
    "nav.cases": "Case Files",
    "nav.memory": "Masters",
    "nav.trace": "Trace",
    "nav.settings": "Settings",

    /* ---------- Shell ---------- */
    "shell.skip": "Skip to content",
    "shell.evidenceQuota": "Evidence quota",
    "shell.agentCapacity": "Agent capacity",
    "shell.reasoning": "5 Masters Debate",
    "shell.evidenceTools": "Risk-First Verdict",
    "shell.attestationEnabled": "Track Record Learning",
    "shell.evidenceQuotaDetail": "14,280 / 20,000 calls",
    "shell.agentCapacityDetail": "Tribunal ready",

    /* Sidebar feature bullets (bottom hints) */
    "shell.feature.debate": "5 Masters Debate",
    "shell.feature.precedent": "Track Record Learning",
    "shell.feature.judgeRisk": "Risk-First Verdict",

    /* ---------- Trial / Courtroom terminology ---------- */
    "trial.filed": "Filing",
    "trial.evidentiary": "Discovery",
    "trial.bullArguing": "Buffett",
    "trial.bearArguing": "Soros",
    "trial.precedentSearch": "Precedent Search",
    "trial.judging": "Verdict",
    "trial.executed": "Execution",
    "trial.archived": "Track Record Updated",

    /* Roles */
    "role.buffett": "Warren Buffett",
    "role.soros": "George Soros",
    "role.dalio": "Ray Dalio",
    "role.lynch": "Peter Lynch",
    "role.livermore": "Jesse Livermore",
    "role.pm": "Portfolio Manager",
    "role.risk": "Risk Manager",
    "role.reviewer": "Reviewer",

    /* Verdicts */
    "verdict.BUY": "BUY",
    "verdict.SELL": "SELL",
    "verdict.REJECT": "DISMISSED",
    "verdict.REDUCE_POSITION": "REDUCE",

    /* Modes */
    "mode.Spot": "Spot HK",
    "mode.Swing": "Swing",
    "mode.Event": "Event Driven",
    "mode.Sentiment": "Sentiment",

    /* ---------- (Wallet strings retained but unused in HK paper-trading demo) ---------- */
    "walletGate.eyebrow": "Paper trading",
    "walletGate.title": "flowEdge paper trading mode",
    "walletGate.description": "flowEdge simulates HK stock trades with 5 master investors debating each idea. No crypto wallet required.",
    "walletGate.detected": "Paper mode",
    "walletGate.missing": "Paper mode",
    "walletGate.disconnected": "Paper mode",
    "walletGate.connected": "Paper trading active",
    "walletGate.connect": "Paper trade",
    "walletGate.detail": "All trades are simulated with $1,000,000 HKD starting capital.",
    "walletGate.proofTitle": "Paper trading path",
    "walletGate.proofDetail": "Decisions are recorded with evidenceHash and decisionHash only.",

    "attestation.eyebrow": "Trade record",
    "attestation.title": "Trade Receipts",
    "attestation.description": "Select a persisted case to view evidenceHash and decisionHash.",
    "attestation.receiptSummary": "Receipt summary",
    "attestation.report": "Case File",
    "attestation.connectWallet": "Connect wallet",
    "attestation.connectedWallet": "Connected wallet",
    "attestation.walletRequired": "Connect wallet first",
    "attestation.write": "Write with connected wallet",
    "attestation.writing": "Writing trade record...",
    "attestation.backendSynced": "Backend receipt synced",
    "attestation.backendPending": "Backend receipt pending",
    "attestation.backendFailed": "Backend sync failed",
    "attestation.walletStatus": "Wallet status",
    "attestation.walletMissing": "Paper trading mode",
    "attestation.walletDisconnected": "Paper trading mode",
    "attestation.walletConnected": "Paper trading active",
    "attestation.walletGateTitle": "Paper trading mode",
    "attestation.walletGateDetail": "EvidenceHash and decisionHash only — no on-chain write in HK demo.",
    "attestation.backendSource": "Case source",
    "attestation.openExplorer": "Open Explorer Tx",
    "attestation.downloadReceipt": "Download Receipt JSON",
    "attestation.realDisabled": "Real chain write disabled",
    "attestation.realDisabledDetail": "Paper trading demo: evidenceHash + decisionHash only.",
    "attestation.reviewProof": "Review record",
    "report.openWalletAttestation": "Open trade record",
    "report.reviewProofReceipt": "Review trade receipt",
  },
  zh: {
    /* ---------- 语言切换 ---------- */
    "language.switch": "切换语言",
    "language.next": "EN",

    /* ---------- 品牌 / 头部 ---------- */
    "brand.name": "flowEdge",
    "brand.nameShort": "flowEdge",
    "shell.subtitle": "AI 投资大师审判团",
    "header.reviewConsole": "交易台",
    "header.operational": "运行中",
    "header.notifications": "通知",
    "header.operatorWorkspace": "flowEdge 交易",
    "header.portfolioValue": "组合净值",
    "header.connectWallet": "连接券商",
    "header.connectedWallet": "券商已连接",

    /* ---------- 导航（与 navigation.ts 一致） ---------- */
    "nav.workspace": "交易台",
    "nav.court": "分析庭",
    "nav.cases": "交易卷宗",
    "nav.memory": "大师战绩",
    "nav.trace": "调用溯源",
    "nav.settings": "设置",

    /* ---------- Shell ---------- */
    "shell.skip": "跳到内容区",
    "shell.evidenceQuota": "证据额度",
    "shell.agentCapacity": "智能体容量",
    "shell.reasoning": "五位大师辩论",
    "shell.evidenceTools": "风控优先裁决",
    "shell.attestationEnabled": "战绩学习进化",
    "shell.evidenceQuotaDetail": "14,280 / 20,000 次调用",
    "shell.agentCapacityDetail": "审判团就绪",

    /* 侧边栏底部特性列表 */
    "shell.feature.debate": "五位大师辩论",
    "shell.feature.precedent": "战绩学习进化",
    "shell.feature.judgeRisk": "风控优先裁决",

    /* ---------- 庭审术语 ---------- */
    "trial.filed": "立案",
    "trial.evidentiary": "证据开示",
    "trial.bullArguing": "巴菲特",
    "trial.bearArguing": "索罗斯",
    "trial.precedentSearch": "判例检索",
    "trial.judging": "裁决",
    "trial.executed": "执行",
    "trial.archived": "战绩更新",

    /* 角色 */
    "role.buffett": "沃伦·巴菲特",
    "role.soros": "乔治·索罗斯",
    "role.dalio": "瑞·达利欧",
    "role.lynch": "彼得·林奇",
    "role.livermore": "杰西·利弗莫尔",
    "role.pm": "组合经理",
    "role.risk": "风控官",
    "role.reviewer": "复核员",

    /* 裁决 */
    "verdict.BUY": "做多",
    "verdict.SELL": "做空",
    "verdict.REJECT": "驳回",
    "verdict.REDUCE_POSITION": "减仓",

    /* 模式 */
    "mode.Spot": "港股现货",
    "mode.Swing": "波段",
    "mode.Event": "事件驱动",
    "mode.Sentiment": "情绪",

    /* ---------- (钱包字符串保留但港股模拟盘不使用) ---------- */
    "walletGate.eyebrow": "模拟盘",
    "walletGate.title": "flowEdge 港股模拟盘",
    "walletGate.description": "flowEdge 由 5 位投资大师辩论每一个港股交易想法，无需加密钱包。",
    "walletGate.detected": "模拟盘模式",
    "walletGate.missing": "模拟盘模式",
    "walletGate.disconnected": "模拟盘模式",
    "walletGate.connected": "模拟盘运行中",
    "walletGate.connect": "模拟交易",
    "walletGate.detail": "所有交易均为模拟，初始资金 $1,000,000 港币。",
    "walletGate.proofTitle": "模拟交易路径",
    "walletGate.proofDetail": "决策以 evidenceHash 和 decisionHash 记录。",

    "attestation.eyebrow": "交易记录",
    "attestation.title": "交易回执",
    "attestation.description": "选择已持久化的卷宗，查看 evidenceHash 与 decisionHash。",
    "attestation.receiptSummary": "回执摘要",
    "attestation.report": "卷宗",
    "attestation.connectWallet": "连接钱包",
    "attestation.connectedWallet": "已连接钱包",
    "attestation.walletRequired": "请先连接钱包",
    "attestation.write": "用已连接钱包上链",
    "attestation.writing": "正在写入交易记录…",
    "attestation.backendSynced": "后端回执已同步",
    "attestation.backendPending": "后端回执待同步",
    "attestation.backendFailed": "后端同步失败",
    "attestation.walletStatus": "钱包状态",
    "attestation.walletMissing": "模拟盘模式",
    "attestation.walletDisconnected": "模拟盘模式",
    "attestation.walletConnected": "模拟盘运行中",
    "attestation.walletGateTitle": "模拟盘模式",
    "attestation.walletGateDetail": "港股 Demo 仅展示 evidenceHash + decisionHash，不上链。",
    "attestation.backendSource": "卷宗来源",
    "attestation.openExplorer": "打开浏览器交易",
    "attestation.downloadReceipt": "下载回执 JSON",
    "attestation.realDisabled": "真实上链已禁用",
    "attestation.realDisabledDetail": "港股模拟盘：仅 evidenceHash + decisionHash。",
    "attestation.reviewProof": "查看记录",
    "report.openWalletAttestation": "查看交易记录",
    "report.reviewProofReceipt": "查看交易回执",
  },
} as const;

export type I18nKey = keyof typeof translations.en;

export function translate(language: AppLanguage, key: I18nKey) {
  return translations[language][key] ?? translations.en[key];
}

export function parseLanguage(value: string | null | undefined): AppLanguage {
  return value === "zh" || value === "en" ? value : defaultLanguage;
}
