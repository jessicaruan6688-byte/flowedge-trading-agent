/**
 * 预设 Demo 案例：描述"时间机器"验证场景。
 * 代码仅导出静态数据，不主动拉行情；真实K线由 Yahoo Finance 动态加载后交由 replay-engine 回放。
 */

export interface PresetCase {
  id: string;
  symbol: string;
  symbolDisplay: string;
  decisionDate: string; // YYYY-MM-DD "回到过去" 的那一天
  userIdea: string;
  mode: string;
  scenarioTag: string;
  narrative: string;
  expectedLesson: string;
}

export const PRESET_CASES: PresetCase[] = [
  {
    id: "tencent-panic-buy",
    symbol: "0700.HK",
    symbolDisplay: "0700 腾讯控股",
    decisionDate: "2025-04-07",
    userIdea:
      "特朗普关税冲击导致港股恐慌性抛售，腾讯从高点回调20%+，RSI进入超卖区，MA60提供强支撑，市场过度悲观。",
    mode: "Swing",
    scenarioTag: "超跌反弹",
    narrative:
      "2025年4月7日，市场因关税恐慌暴跌，所有人都在抛售。此时Agent发出BUY信号，因为巴菲特看到了安全边际。一周后市场反弹，验证了'别人恐惧时我贪婪'。",
    expectedLesson: "恐惧时的逆向买入（巴菲特框架）",
  },
  {
    id: "smic-fomo-reject",
    symbol: "0981.HK",
    symbolDisplay: "0981 中芯国际",
    decisionDate: "2025-05-20",
    userIdea:
      "中芯国际受国产替代概念刺激连续大涨，RSI进入超买区，市场FOMO情绪高涨，想追涨。",
    mode: "Spot",
    scenarioTag: "高潮追涨",
    narrative:
      "连续大涨后散户FOMO追高，RSI>78，索罗斯发出反身性预警，闸门直接REJECT。一周后回调，证明了不追高的纪律。",
    expectedLesson: "高潮禁追（闸门风控+索罗斯反身性）",
  },
  {
    id: "xiaomi-su7-breakout",
    symbol: "1810.HK",
    symbolDisplay: "1810 小米集团",
    decisionDate: "2025-03-25",
    userIdea:
      "小米SU7销量持续超预期，新车型发布催化，价格在MA20上缩量回调，等待突破前高关键点。",
    mode: "Swing",
    scenarioTag: "突破跟进",
    narrative:
      "利弗莫尔等待关键点确认后入场，当价格放量突破前高时进场，跟随趋势盈利。",
    expectedLesson: "关键点突破（利弗莫尔动量框架）",
  },
  {
    id: "alibaba-learning-loop",
    symbol: "9988.HK",
    symbolDisplay: "9988 阿里巴巴",
    decisionDate: "2025-06-10",
    userIdea: "阿里AI+电商双轮驱动，回调至MA20支撑，看起来是机会。",
    mode: "Swing",
    scenarioTag: "错误后的权重调整",
    narrative:
      "第一次：巴菲特框架建议买入但错了（震荡亏损-3%），系统记录这个教训，在'震荡市价值框架'场景下巴菲特权重下降。下一次类似场景，Agent学会了等待信号确认而不是盲目抄底。",
    expectedLesson: "从错误中学习（权重进化机制）",
  },
];
