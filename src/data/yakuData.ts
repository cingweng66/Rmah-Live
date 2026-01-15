// M League役种数据定义
// 基于M League规则 + 标准riichi.wiki补充

export interface YakuInfo {
  name: string; // 中文名
  nameJa: string; // 日文名
  nameRomaji: string; // 罗马音
  han: number; // 翻数
  description: string; // 简述
  closedOnly: boolean; // 门前限定
  reducedHanWhenOpen?: number; // 副露减翻后的翻数（如果存在）
}

// M League役种列表（按翻数分组）
export const YAKU_DATA: Record<string, YakuInfo> = {
  // 1翻役
  'menzenchin_tsumohou': {
    name: '门前清自摸和',
    nameJa: '門前清自摸和',
    nameRomaji: 'Menzenchin tsumohou',
    han: 1,
    description: '门清自摸和牌',
    closedOnly: true,
  },
  'riichi': {
    name: '立直',
    nameJa: '立直',
    nameRomaji: 'Riichi',
    han: 1,
    description: '门清听牌宣言',
    closedOnly: true,
  },
  'ippatsu': {
    name: '一发',
    nameJa: '一発',
    nameRomaji: 'Ippatsu',
    han: 1,
    description: '立直后一巡内和牌（附属于立直）',
    closedOnly: true,
  },
  'yakuhai': {
    name: '役牌',
    nameJa: '役牌',
    nameRomaji: 'Yakuhai',
    han: 1,
    description: '自风/场风/三元牌刻子/杠',
    closedOnly: false,
  },
  'pinfu': {
    name: '平和',
    nameJa: '平和',
    nameRomaji: 'Pinfu',
    han: 1,
    description: '门清全顺子、两面听、无役牌雀头',
    closedOnly: true,
  },
  'tanyao': {
    name: '断幺九',
    nameJa: '断么九',
    nameRomaji: 'Tanyao',
    han: 1,
    description: '全2-8牌，无幺九/字牌',
    closedOnly: false,
  },
  'iipeikou': {
    name: '一杯口',
    nameJa: '一盃口',
    nameRomaji: 'Iipeikou',
    han: 1,
    description: '门清相同顺子一对',
    closedOnly: true,
  },
  'haitei_raoyue': {
    name: '海底捞月',
    nameJa: '海底摸月',
    nameRomaji: 'Haitei raoyue',
    han: 1,
    description: '自摸牌山最后一张',
    closedOnly: false,
  },
  'houtei_raoyui': {
    name: '河底捞鱼',
    nameJa: '河底撈魚',
    nameRomaji: 'Houtei raoyui',
    han: 1,
    description: '荣和牌河最后一张',
    closedOnly: false,
  },
  'chankan': {
    name: '抢杠',
    nameJa: '搶槓',
    nameRomaji: 'Chankan',
    han: 1,
    description: '荣和他人加杠牌',
    closedOnly: false,
  },
  'rinshan_kaihou': {
    name: '岭上开花',
    nameJa: '嶺上開花',
    nameRomaji: 'Rinshan kaihou',
    han: 1,
    description: '杠后自摸岭上牌',
    closedOnly: false,
  },
  
  // 2翻役
  'double_riichi': {
    name: '双立直',
    nameJa: 'ダブル立直',
    nameRomaji: 'Double riichi',
    han: 2,
    description: '第一巡门清立直',
    closedOnly: true,
  },
  'renpuuhai': {
    name: '连风牌',
    nameJa: '連風牌',
    nameRomaji: 'Renpuuhai',
    han: 2,
    description: '自风+场风刻子（役牌变体）',
    closedOnly: false,
  },
  'toitoi': {
    name: '对对和',
    nameJa: '対々和',
    nameRomaji: 'Toitoi',
    han: 2,
    description: '全刻子/杠',
    closedOnly: false,
  },
  'sanankou': {
    name: '三暗刻',
    nameJa: '三暗刻',
    nameRomaji: 'Sanankou',
    han: 2,
    description: '三暗刻/暗杠',
    closedOnly: false,
  },
  'sanshoku_doukou': {
    name: '三色同刻',
    nameJa: '三色同刻',
    nameRomaji: 'Sanshoku doukou',
    han: 2,
    description: '同数字三色刻子',
    closedOnly: false,
  },
  'sankantsu': {
    name: '三杠子',
    nameJa: '三槓子',
    nameRomaji: 'Sankantsu',
    han: 2,
    description: '三杠',
    closedOnly: false,
  },
  'shousangen': {
    name: '小三元',
    nameJa: '小三元',
    nameRomaji: 'Shousangen',
    han: 2,
    description: '两三元刻+一三元对（役牌x2）',
    closedOnly: false,
  },
  'honroutou': {
    name: '混老头',
    nameJa: '混老頭',
    nameRomaji: 'Honroutou',
    han: 2,
    description: '全幺九/字牌（七对/对对和）',
    closedOnly: false,
  },
  'sanshoku_doujun': {
    name: '三色同顺',
    nameJa: '三色同順',
    nameRomaji: 'Sanshoku doujun',
    han: 2,
    description: '同数字三色顺子',
    closedOnly: false,
    reducedHanWhenOpen: 1,
  },
  'ittsu': {
    name: '一气通贯',
    nameJa: '一気通貫',
    nameRomaji: 'Ittsu',
    han: 2,
    description: '同色123+456+789',
    closedOnly: false,
    reducedHanWhenOpen: 1,
  },
  'chantaiyao': {
    name: '混全带幺九',
    nameJa: '全帯么九',
    nameRomaji: 'Chantaiyao',
    han: 2,
    description: '每组/对带幺九',
    closedOnly: false,
    reducedHanWhenOpen: 1,
  },
  'chiitoitsu': {
    name: '七对子',
    nameJa: '七対子',
    nameRomaji: 'Chiitoitsu',
    han: 2,
    description: '七个不同对（25符固定）',
    closedOnly: true,
  },
  
  // 3翻役
  'ryanpeikou': {
    name: '二杯口',
    nameJa: '二盃口',
    nameRomaji: 'Ryanpeikou',
    han: 3,
    description: '两对相同顺子',
    closedOnly: true,
  },
  'honitsu': {
    name: '混一色',
    nameJa: '混一色',
    nameRomaji: 'Honitsu',
    han: 3,
    description: '单色数牌+字牌',
    closedOnly: false,
    reducedHanWhenOpen: 2,
  },
  'junchan': {
    name: '纯全带幺九',
    nameJa: '純全帯么九',
    nameRomaji: 'Junchan',
    han: 3,
    description: '每组/对带终端（无字）',
    closedOnly: false,
    reducedHanWhenOpen: 2,
  },
  
  // 6翻役
  'chinitsu': {
    name: '清一色',
    nameJa: '清一色',
    nameRomaji: 'Chinitsu',
    han: 6,
    description: '单色数牌',
    closedOnly: false,
    reducedHanWhenOpen: 5,
  },
  
  // 役满
  'tenhou': {
    name: '天和',
    nameJa: '天和',
    nameRomaji: 'Tenhou',
    han: 13,
    description: '庄家首巡自摸',
    closedOnly: true,
  },
  'chiihou': {
    name: '地和',
    nameJa: '地和',
    nameRomaji: 'Chiihou',
    han: 13,
    description: '闲家首巡自摸（无鸣牌）',
    closedOnly: true,
  },
  'kokushi_musou': {
    name: '国士无双',
    nameJa: '国士無双',
    nameRomaji: 'Kokushi musou',
    han: 13,
    description: '13幺九单吊+1重复',
    closedOnly: true,
  },
  'suuankou': {
    name: '四暗刻',
    nameJa: '四暗刻',
    nameRomaji: 'Suuankou',
    han: 13,
    description: '四暗刻（单骑双役满）',
    closedOnly: true,
  },
  'daisangen': {
    name: '大三元',
    nameJa: '大三元',
    nameRomaji: 'Daisangen',
    han: 13,
    description: '三三元刻',
    closedOnly: false,
  },
  'ryuuiisou': {
    name: '绿一色',
    nameJa: '緑一色',
    nameRomaji: 'Ryuuiisou',
    han: 13,
    description: '全绿牌（M League: 无緑發OK）',
    closedOnly: false,
  },
  'tsuuiisou': {
    name: '字一色',
    nameJa: '字一色',
    nameRomaji: 'Tsuuiisou',
    han: 13,
    description: '全字牌',
    closedOnly: false,
  },
  'shousuushii': {
    name: '小四喜',
    nameJa: '小四喜',
    nameRomaji: 'Shousuushii',
    han: 13,
    description: '三风刻+一风对',
    closedOnly: false,
  },
  'daisuushii': {
    name: '大四喜',
    nameJa: '大四喜',
    nameRomaji: 'Daisuushii',
    han: 13,
    description: '四风刻（部分规则双役满）',
    closedOnly: false,
  },
  'chinroutou': {
    name: '清老头',
    nameJa: '清老頭',
    nameRomaji: 'Chinroutou',
    han: 13,
    description: '全终端数牌',
    closedOnly: false,
  },
  'suukantsu': {
    name: '四杠子',
    nameJa: '四槓子',
    nameRomaji: 'Suukantsu',
    han: 13,
    description: '四杠',
    closedOnly: false,
  },
  'chuuren_poutou': {
    name: '九莲宝灯',
    nameJa: '九蓮宝燈',
    nameRomaji: 'Chuuren poutou',
    han: 13,
    description: '1112345678999+1同色（纯正双役满）',
    closedOnly: true,
  },
};

// 根据役种key获取役种信息
export function getYakuInfo(key: string): YakuInfo | undefined {
  return YAKU_DATA[key];
}

// 根据役种名称（中文/日文/罗马音）查找役种key
export function findYakuKey(name: string): string | undefined {
  const lowerName = name.toLowerCase();
  for (const [key, info] of Object.entries(YAKU_DATA)) {
    if (
      info.name === name ||
      info.nameJa === name ||
      info.nameRomaji.toLowerCase() === lowerName ||
      info.name.toLowerCase() === lowerName
    ) {
      return key;
    }
  }
  return undefined;
}

// 获取所有役种列表（按翻数分组）
export function getYakuListByHan(): Record<number, YakuInfo[]> {
  const result: Record<number, YakuInfo[]> = {};
  for (const yaku of Object.values(YAKU_DATA)) {
    if (!result[yaku.han]) {
      result[yaku.han] = [];
    }
    result[yaku.han].push(yaku);
  }
  return result;
}
