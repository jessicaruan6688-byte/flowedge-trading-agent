# flowEdge 项目交接文档

> 黑客松项目：AI港股交易Agent - 5位投资大师多空辩论 + 风控裁决 + 权重学习
> 技术栈：Next.js 16 + TypeScript + TailwindCSS v4 + Recharts
> 最后更新：2026-07-04 22:00

---

## 一句话产品定位

**flowEdge** = 一个会从交易结果中学习的港股AI交易Agent。用户输入港股代码+投资想法，5位大师（巴菲特/索罗斯/达利欧/林奇/利弗莫尔）独立分析，多方vs空方辩论，风控审核后给出BUY/SELL/HOLD裁决，模拟下单。每笔交易结果更新大师权重，下次同场景胜率高的大师话语权更大。

---

## 快速启动

```bash
cd trade-agent
npm install
npm run dev    # http://localhost:3000
```

**环境变量**（`.env.local`）：
```
DOUBAO_API_KEY=your_doubao_ark_key     # 火山引擎豆包API，不配则用确定性规则fallback（演示可跑）
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_MODEL=doubao-seed-2-1-pro-260628
INITIAL_PAPER_BALANCE=1000000          # 模拟盘初始资金HKD
```

---

## 当前完成状态（可跑Demo）

### ✅ 已完成
- Next.js 16项目骨架，浅色金融主题（白底+#007acc蓝+绿涨红跌）
- AppShell布局：Sidebar(260px) + Header + 主内容区 + Footer
- **6个页面路由**：/workspace(交易台) /court(分析庭) /cases(卷宗) /memory(大师战绩) /trace(溯源) /settings
- **K线走势图**（Recharts AreaChart + 成交量柱 + ENTRY/SL/TP参考线）
- 顶部行情条（价格/涨跌幅/高低量/RSI/ATR/ADX等指标pill）
- **三栏辩论布局**：左绿多方(巴菲特+林奇) | 中间风控+裁决+达利欧 | 右红空方(索罗斯+利弗莫尔)
- 大师卡片（头像/信号badge/陈词/要点/指标/置信度彩条/延迟）
- **最终裁决英雄卡**（大字BUY/SELL/HOLD + 4格数据 + 加权得分条）
- 底部Output面板（执行日志/裁决摘要/详细分析三tab）
- **SSE流式API** `/api/court/run`（POST，text/event-stream）
- 5位大师Agent（buffett/soros/dalio/lynch/livermore），带真实投资框架prompt
- 风控引擎（波动率仓位/熔断检查/止损止盈/凯利仓位）
- 模拟盘portfolio（100万HKD初始资金，buy/sell/hold）
- 权重学习系统（乘法权重更新，场景×大师胜率矩阵）
- Yahoo Finance港股数据接入（0700.HK等，自动fallback到mock数据）
- Mock demo模式：点"开始分析"5秒内走完完整流程（无需API key）

### ❌ 待完成
- [ ] 接豆包真实LLM推理（目前mock模式，需配DOUBAO_API_KEY）
- [ ] Replay回放模式（推进N根K线后判定胜负→更新权重）
- [ ] 卷宗列表页(/cases)真实填充历史案件
- [ ] 大师战绩页(/memory)从weight-store读真实权重
- [ ] 溯源页(/trace)真实trace展示
- [ ] 设置页功能完善（模型切换/数据源切换）
- [ ] 部署到Vercel
- [ ] 产品说明文档（比赛提交用）

---

## 项目文件结构

```
trade-agent/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # 根布局(字体/metadata)
│   │   ├── globals.css               # 全局样式(浅色主题+CSS变量)
│   │   ├── page.tsx                  # 根路由→重定向/workspace
│   │   ├── workspace/page.tsx        # 交易台
│   │   ├── court/page.tsx            # 分析庭 ★核心页面
│   │   ├── cases/page.tsx            # 卷宗列表
│   │   ├── case/[id]/page.tsx        # 案件详情
│   │   ├── memory/page.tsx           # 大师战绩
│   │   ├── trace/page.tsx            # 调用溯源
│   │   ├── settings/page.tsx         # 设置
│   │   └── api/
│   │       ├── court/run/route.ts    # ★SSE流式分析API
│   │       ├── cases/route.ts        # 案件列表GET
│   │       ├── cases/[id]/route.ts   # 单案件GET
│   │       ├── portfolio/route.ts    # 组合GET
│   │       └── traces/route.ts       # 溯源GET
│   │
│   ├── components/
│   │   ├── DashboardApp.tsx          # 路由→页面映射
│   │   ├── shell/                    # AppShell
│   │   │   ├── AppShell.tsx          # 主布局容器
│   │   │   ├── AppContext.tsx        # 全局state(toast/language/balance)
│   │   │   ├── Sidebar.tsx           # 左侧导航(蓝色激活态)
│   │   │   ├── Header.tsx            # 顶栏(搜索/组合净值/语言/头像)
│   │   │   ├── Footer.tsx            # 底栏(hash信息)
│   │   │   ├── GlobalSearch.tsx      # 股票代码搜索
│   │   │   └── OnboardingGuide.tsx   # 新手引导
│   │   ├── pages/                    # 页面组件
│   │   │   ├── WorkspacePage.tsx      # 交易台(股票选择+想法输入+快速pick)
│   │   │   ├── CourtPage.tsx         # ★分析庭(K线+辩论+裁决)
│   │   │   ├── CasesPage.tsx         # 卷宗列表
│   │   │   ├── CaseDetailPage.tsx    # 案件详情
│   │   │   ├── MemoryPage.tsx        # 大师战绩
│   │   │   ├── TracePage.tsx         # 调用溯源
│   │   │   └── SettingsPage.tsx      # 设置
│   │   └── ui/                       # UI组件库
│   │       ├── styles.ts             # 共享class(cardClass/inputClass/buttonClass等)
│   │       ├── Button.tsx            # 按钮(primary=黑底白字/accent=蓝)
│   │       ├── Card.tsx              # 卡片(白底圆角阴影)
│   │       ├── Badge.tsx             # 徽章(bull绿/bear红/warning黄/blue蓝)
│   │       ├── Input.tsx / Textarea  # 输入框
│   │       ├── StatCard.tsx          # 统计卡
│   │       ├── ProgressBar.tsx       # 进度条(蓝紫渐变)
│   │       ├── VerdictBadge.tsx      # 裁决badge(绿↑/红↓/灰-)
│   │       ├── ScoreBar.tsx          # 分数条
│   │       ├── PageHeading.tsx       # 页头
│   │       ├── EmptyState.tsx        # 空状态
│   │       └── ...其他组件
│   │
│   └── lib/
│       ├── types.ts                  # ★所有TypeScript类型定义
│       ├── navigation.ts             # 导航项/港股列表/模式选项/分析步骤
│       ├── i18n.ts                   # 中英文字典
│       └── server/                   # 服务端代码
│           ├── ai-service.ts         # ★豆包LLM服务层(OpenAI兼容协议)
│           ├── data-source.ts        # ★行情数据(Yahoo Finance + 技术指标计算)
│           ├── risk-engine.ts        # 风控引擎(波动率仓位/熔断/止损止盈)
│           ├── portfolio-manager.ts  # 模拟盘管理(下单/持仓/结算)
│           ├── weight-store.ts       # 权重学习(乘法权重更新+持久化)
│           ├── case-store.ts         # 案件持久化(原子写入.flowedge/store.json)
│           ├── court-runner.ts       # ★核心编排器(SSE事件流)
│           ├── xapi-trace.ts         # hash工具(SHA-256)
│           └── agents/               # 5位大师Agent
│               ├── shared.ts         # 共享LLM调用封装
│               ├── buffett.ts        # 巴菲特(价值投资)
│               ├── soros.ts          # 索罗斯(反身性/泡沫)
│               ├── dalio.ts          # 达利欧(风险平价)
│               ├── lynch.ts          # 林奇(GARP/十倍股)
│               └── livermore.ts      # 利弗莫尔(动量/关键点)
│
├── .env.local                        # 环境变量(需创建)
├── .env.example                      # 环境变量模板
├── package.json
├── tsconfig.json
├── next.config.ts
└── tailwind.config.ts (内联在globals.css @theme)
```

---

## 核心数据流

```
用户在Workspace选股票+输入想法
        ↓ router.push(/court?symbol=xxx&idea=xxx&mode=xxx)
CourtPage useEffect检测URL参数→startAnalysis()
        ↓ POST /api/court/run {symbol, userIdea, mode}
        ↓ SSE stream (data: {...}\n\n)
court-runner.ts 按顺序执行：
  1. MarketDataSource.getMarketData() → K线+技术指标+行情
  2. checkCircuitBreakers() → 熔断预检
  3. loadPortfolio() → 加载组合
  4. for each master [buffett, lynch, soros, livermore, dalio]:
       emit agent_started → agent调用LLM/fallback → emit agent_signal
  5. assessRisk() → 风控评估
  6. 加权聚合(weights × signal × confidence) → BUY/SELL/HOLD
  7. executeOrder() → 模拟下单
  8. saveCase() + saveTraces() → 持久化
  9. emit case_completed
        ↓
CourtPage实时接收事件更新UI状态：
  - data_loaded → 画K线图+行情条
  - agent_started → 卡片显示"分析中"spinner+渐变进度条
  - agent_signal → 卡片显示信号+陈词+置信度条
  - risk_assessed → 风控卡
  - decision_made → 裁决英雄卡显示BUY/SELL+入场止损止盈
  - order_executed → 模拟订单卡
  - case_completed → 停止spinner
```

---

## SSE事件格式

前端从`/api/court/run`的POST响应中按行解析`data: {...}`：

```typescript
type CourtEvent =
  | { type: "case_started"; caseId: string; symbol: string; timestamp: string }
  | { type: "progress"; percent: number; message: string }
  | { type: "data_loaded"; bars: number; price: number; scenario: string;
      indicators: Record<string,number>;
      klines?: KlinePoint[];                    // 给前端画K线
      quote?: { price; change; changePercent; high; low; volume };
      technicals?: Record<string,number>; }
  | { type: "circuit_breaker"; triggered: boolean; reason?: string }
  | { type: "agent_started"; masterId: MasterId; masterName: string }
  | { type: "agent_signal"; masterId: MasterId; signal: MasterSignal; latencyMs: number }
  | { type: "risk_assessed"; assessment: RiskAssessment }
  | { type: "decision_made"; decision: PortfolioDecision; allowed: {maxShares:number} }
  | { type: "order_executed"; action: string; quantity: number; price: number }
  | { type: "case_completed"; caseId: string; verdict: string; position?: string }
  | { type: "error"; message: string; recoverable: boolean };
```

MasterSignal格式：
```typescript
{ direction: "bullish"|"bearish"|"neutral"; confidence: number; // 0-100
  thesis: string;          // 陈词文字
  keyPoints?: string[];    // 要点
  keyMetrics?: Record<string,string|number>; }
```

---

## 5位大师配置

| ID | 中文名 | 英文名 | 框架 | 颜色 | 默认倾向 |
|---|---|---|---|---|---|
| buffett | 巴菲特 | Buffett | 价值投资/护城河/安全边际 | 绿 #10b981 | Bull(多方) |
| lynch | 林奇 | Lynch | GARP/十倍股 | 天蓝 #0ea5e9 | Bull(多方) |
| soros | 索罗斯 | Soros | 反身性/泡沫识别 | 红 #ef4444 | Bear(空方) |
| livermore | 利弗莫尔 | Livermore | 动量/关键点/突破 | 橙 #f97316 | Bear(空方) |
| dalio | 达利欧 | Dalio | 原则/风险平价 | 琥珀 #f59e0b | Center(风控) |

---

## UI设计规范

**主题色**：
- 页面背景：`#F0F0F0` (bg-gray-50)
- 卡片/侧栏/Header/Footer：白色 `#FFFFFF`
- 边框：`#E5E7EB` / `#D9D9D9` (border-gray-200)
- 主按钮色：`#171717` 近黑黑底白字
- 强调色：`#007acc` VSCode蓝（链接/激活态/Run按钮）
- 涨/ Bullish：`#10b981` 绿
- 跌/ Bearish：`#ef4444` 红
- Neutral/风控：`#f59e0b` 琥珀
- 主文字：`#0A0A0A` 近黑
- 次级文字：`#444444` / `#737373`

**字体**：Inter (sans) + 等宽 font-mono（价格/数字/代码）
**圆角**：rounded-lg (8px)
**间距**：gap-4, p-3/p-4 标准
**图表**：Recharts AreaChart（价格）+ BarChart（成交量）

---

## 重要代码路径

| 要改什么 | 改哪个文件 |
|---|---|
| 大师prompt/人设 | `src/lib/server/agents/{buffett,soros,dalio,lynch,livermore}.ts` |
| 风控规则 | `src/lib/server/risk-engine.ts` |
| 仓位算法 | `src/lib/server/risk-engine.ts` calculateRiskLevels/kellyPositionSize |
| 数据流/编排顺序 | `src/lib/server/court-runner.ts` runCourtSession() |
| LLM切换/模型配置 | `src/lib/server/ai-service.ts` |
| 数据源/港股API | `src/lib/server/data-source.ts` |
| K线图/指标显示 | `src/components/pages/CourtPage.tsx` chartData/AreaChart部分 |
| 三栏布局/大师卡片 | `src/components/pages/CourtPage.tsx` MasterCard组件 |
| 裁决卡样式 | `src/components/pages/CourtPage.tsx` Verdict Hero部分 |
| 裁决算法(加权投票) | `src/lib/server/court-runner.ts` 第349-376行 |
| 权重更新/学习 | `src/lib/server/weight-store.ts` |
| 模拟盘/下单 | `src/lib/server/portfolio-manager.ts` |
| 新增页面 | 在src/app/下创建目录+page.tsx，在navigation.ts加路由，在DashboardApp.tsx加映射 |
| 新增导航项 | `src/lib/navigation.ts` navigationItems数组 |

---

## 已知问题/TODO

1. **CourtPage默认用mock流**（`useMock = true`），要切真实API把第321行`const useMock = true`改为false并配DOUBAO_API_KEY
2. **大师fallback逻辑**：无API key时每个agent用确定性规则（基于RSI/PE等硬编码阈值）返回信号，不是真LLM
3. **Replay模式未实现**：当前下单后不会自动推进K线判定胜负，需要加setTimeout推进K线+markToMarket+closeOrder逻辑
4. **权重目前只存储不读取**：weight-store.ts有updateWeights但court-runner目前用默认权重1.0，需要在场景分类后读取真实权重
5. **Yahoo Finance有时超时/429**：data-source有缓存(5分钟)和GBM mock fallback，但生产需要替换为QVeris SDK
6. **数据持久化在.flowedge/store.json**：重启dev server数据不丢，但部署Vercel需要用KV/数据库
7. **CourtPage的court-runner事件类型是手动定义的**（不import server端类型，避免client bundle包含server代码），如果改事件类型需要两边同步

---

## 对接真实LLM

配了`DOUBAO_API_KEY`后：
1. ai-service.ts自动启用
2. 每个agent调用`${baseUrl}/chat/completions`（OpenAI兼容格式）
3. System prompt在各agents/{name}.ts文件中
4. 失败时自动fallback到确定性规则，不中断流程
5. 超时默认30s（AI_TIMEOUT_MS）

可切换模型：改`DOUBAO_MODEL`环境变量
可切换base URL：改`DOUBAO_BASE_URL`（支持任何OpenAI兼容API：OpenAI/Claude/DeepSeek/Qwen等）

---

## Demo演示剧本（给评委看）

1. 打开 http://localhost:3000 → 交易台
2. Quick-pick选"0700 腾讯" → 自动填充代码
3. 投资想法输入框有默认示例，直接点"开始分析"
4. 跳转到/court，观察：
   - 行情条出现价格/涨跌
   - K线图渲染
   - 大师卡片逐个亮起（分析中spinner→完成显示陈词）
   - 风控卡通过
   - 最终裁决卡大字BUY/SELL
   - 模拟订单执行
5. 切换到不同股票重复2-3次展示
6. 切到/memory展示大师战绩页面
7. 强调："每笔交易后大师权重会更新，下次同场景胜率高的大师话语权更大——这就是闭环学习"

---

## 参考项目

- **ChainPulse-Agent**（UI骨架）：https://github.com/jessicaruan6688-byte/ChainPulse-Agent
- **ai-hedge-fund**（Agent架构参考）：/tmp/ai-hedge-fund/ — 58K stars，LangGraph多Agent+确定性规则+LLM润色模式
- **FinceptTerminal**（UI参考，彭博风）：15K stars，深色多面板
- **TradingAgents-GUI**（辩论UI参考）：Bull/Bear辩论+实时进度

---

## 关键原则

1. **Talk is cheap, show me the running agent** — 评委只看跑通的闭环
2. **风控硬规则优先于LLM** — checkCircuitBreakers触发直接REJECT，LLM无权绕过
3. **零成本切换模型** — ai-service.ts统一OpenAI兼容接口，改env就行
4. **所有Agent工作必须可视化** — 每个大师的分析过程都在UI上显示，不做黑盒
5. **确定性fallback** — LLM失败不崩溃，用硬规则兜底保证demo能跑完
