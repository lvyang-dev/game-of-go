// ============================================================================
// Kaya Sensei Go — Internationalization (zh-TW default, zh-CN, en)
// ============================================================================

export const SUPPORTED_LANGS = ['zh-TW', 'zh-CN', 'en'];
export const DEFAULT_LANG = 'zh-TW';

let currentLang = DEFAULT_LANG;

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (SUPPORTED_LANGS.includes(lang)) {
    currentLang = lang;
  } else {
    currentLang = DEFAULT_LANG;
  }
  return currentLang;
}

// ============================================================================
// Traditional Chinese -> Simplified Chinese Converter
// Tailored with natural Mainland Go & UI terminology + full character mapping
// ============================================================================

const PHRASE_T2S = [
  ['專案', '项目'],
  ['快取', '缓存'],
  ['檔案', '文件'],
  ['記憶體', '内存'],
  ['網路', '网络'],
  ['瀏覽器', '浏览器'],
  ['伺服器', '服务器'],
  ['設定', '设置'],
  ['預設', '默认'],
  ['自訂', '自定义'],
  ['本機', '本地'],
  ['貼上', '粘贴'],
  ['定石', '定式'],
  ['詰碁', '诘棋'],
  ['佈局', '布局'],
  ['佔據', '占据'],
  ['佔角', '占角'],
  ['佔領', '占领'],
  ['搶佔', '抢占'],
  ['著手', '着手'],
  ['禁著', '禁着'],
  ['執色', '执子颜色'],
  ['掛黏', '挂粘'],
  ['扳黏', '扳粘'],
  ['實黏', '实粘'],
  ['補黏', '补粘'],
  ['緊黏', '紧粘'],
  ['黏在', '粘在'],
  ['黏回', '粘回'],
  ['雙黏', '双粘'],
  ['乾淨', '干净'],
  ['乾脆', '干脆'],
  ['餘味', '余味'],
  ['資訊', '信息'],
  ['覆盤', '复盘'],
];

const CHAR_T2S = {
  '並': '并', '乾': '干', '佈': '布', '佔': '占', '來': '来', '個': '个',
  '價': '价', '優': '优', '內': '内', '兩': '两', '別': '别', '務': '务',
  '勝': '胜', '勢': '势', '匯': '汇', '協': '协', '卻': '却', '參': '参',
  '啟': '启', '單': '单', '嚴': '严', '圍': '围', '圖': '图', '執': '执',
  '堅': '坚', '場': '场', '塊': '块', '壓': '压', '夾': '夹', '奪': '夺',
  '實': '实', '寬': '宽', '將': '将', '專': '专', '尋': '寻', '對': '对',
  '導': '导', '屬': '属', '師': '师', '帶': '带', '幾': '几', '張': '张',
  '強': '强', '彈': '弹', '後': '后', '從': '从', '復': '复', '徹': '彻',
  '惡': '恶', '態': '态', '慘': '惨', '慮': '虑', '憶': '忆', '應': '应',
  '懲': '惩', '戰': '战', '戶': '户', '掙': '挣', '掛': '挂', '採': '采',
  '換': '换', '損': '损', '搶': '抢', '撥': '拨', '撲': '扑', '撿': '捡',
  '擇': '择', '擊': '击', '擋': '挡', '據': '据', '擠': '挤', '擴': '扩',
  '敵': '敌', '數': '数', '斷': '断', '於': '于', '時': '时', '暫': '暂',
  '曠': '旷', '書': '书', '會': '会', '東': '东', '業': '业', '極': '极',
  '構': '构', '標': '标', '樣': '样', '機': '机', '檔': '档', '檢': '检',
  '權': '权', '歷': '历', '歸': '归', '殲': '歼', '殺': '杀', '氣': '气',
  '決': '决', '沒': '没', '淨': '净', '淺': '浅', '準': '准', '溫': '温',
  '滅': '灭', '滿': '满', '潰': '溃', '瀏': '浏', '為': '为', '無': '无',
  '營': '营', '牆': '墙', '牽': '牵', '狀': '状', '獨': '独', '獲': '获',
  '現': '现', '當': '当', '發': '发', '盡': '尽', '盤': '盘', '碁': '棋',
  '確': '确', '禦': '御', '稱': '称', '積': '积', '穩': '稳', '窺': '窥',
  '節': '节', '範': '范', '築': '筑', '粹': '粹', '約': '约', '紅': '红',
  '純': '纯', '級': '级', '紮': '扎', '細': '细', '終': '终', '結': '结',
  '絕': '绝', '絡': '络', '給': '给', '經': '经', '維': '维', '網': '网',
  '緊': '紧', '緒': '绪', '線': '线', '締': '缔', '編': '编', '緩': '缓',
  '練': '练', '縮': '缩', '總': '总', '繞': '绕', '繫': '系', '繼': '继',
  '續': '续', '罰': '罚', '習': '习', '聯': '联', '職': '职', '腦': '脑',
  '腳': '脚', '膽': '胆', '與': '与', '舉': '举', '萬': '万', '著': '着',
  '薦': '荐', '處': '处', '虛': '虚', '術': '术', '衝': '冲', '補': '补',
  '裡': '里', '製': '制', '複': '复', '見': '见', '規': '规', '視': '视',
  '覽': '览', '觀': '观', '訂': '订', '計': '计', '討': '讨', '記': '记',
  '設': '设', '註': '注', '評': '评', '試': '试', '詰': '诘', '該': '该',
  '認': '认', '誤': '误', '課': '课', '調': '调', '請': '请', '論': '论',
  '證': '证', '譜': '谱', '譯': '译', '議': '议', '護': '护', '讀': '读',
  '變': '变', '讓': '让', '豐': '丰', '負': '负', '費': '费', '貼': '贴',
  '資': '资', '賺': '赚', '躍': '跃', '軍': '军', '較': '较', '載': '载',
  '輕': '轻', '輪': '轮', '輸': '输', '轉': '转', '連': '连', '進': '进',
  '運': '运', '過': '过', '違': '违', '遙': '遥', '遠': '远', '適': '适',
  '選': '选', '還': '还', '邊': '边', '鄰': '邻', '銀': '银', '銅': '铜',
  '錯': '错', '鍵': '键', '鎖': '锁', '鐵': '铁', '鑽': '钻', '長': '长',
  '門': '门', '閉': '闭', '開': '开', '間': '间', '闊': '阔', '關': '关',
  '陣': '阵', '階': '阶', '隨': '随', '隻': '只', '雖': '虽', '雙': '双',
  '離': '离', '難': '难', '靈': '灵', '靜': '静', '鞏': '巩固'[0], '韌': '韧',
  '頂': '顶', '順': '顺', '須': '须', '領': '领', '頭': '头', '頻': '频',
  '顆': '颗', '題': '题', '額': '额', '顧': '顾', '顯': '显', '風': '风',
  '飄': '飘', '飛': '飞', '餘': '余', '驅': '驱', '驗': '验', '驚': '惊',
  '體': '体', '鬆': '松', '鬥': '斗', '黃': '黄', '黏': '粘', '點': '点',
  '龍': '龙', '傳': '传', '僅': '仅', '備': '备', '側': '侧', '儲': '储',
  '劃': '划', '動': '动', '勵': '励', '區': '区', '團': '团', '圓': '圆',
  '報': '报', '壞': '坏', '審': '审', '對': '对', '層': '层', '幣': '币',
  '廣': '广', '彈': '弹', '徵': '征', '慣': '惯', '戰': '战', '據': '据',
  '擬': '拟', '攔': '拦', '斷': '断', '條': '条', '檢': '检', '歲': '岁',
  '殘': '残', '濟': '济', '準': '准', '滿': '满', '點': '点', '熱': '热',
  '獨': '独', '環': '环', '產': '产', '異': '异', '畫': '画', '盤': '盘',
  '確': '确', '離': '离', '種': '种', '積': '积', '競': '竞', '筆': '笔',
  '簡': '简', '類': '类', '紅': '红', '組': '组', '統': '统', '網': '网',
  '線': '线', '編': '编', '總': '总', '縮': '缩', '續': '续', '義': '义',
  '職': '职', '聯': '联', '聲': '声', '勝': '胜', '臺': '台', '舉': '举',
  '舊': '旧', '萬': '万', '葉': '叶', '號': '号', '衛': '卫', '裝': '装',
  '複': '复', '見': '见', '觀': '观', '規': '规', '視': '视', '覺': '觉',
  '覽': '览', '觸': '触', '計': '计', '訊': '讯', '討': '讨', '訓': '训',
  '記': '记', '設': '设', '許': '许', '訴': '诉', '評': '评', '詞': '词',
  '試': '试', '詩': '诗', '話': '话', '該': '该', '詳': '详', '語': '语',
  '誤': '误', '說': '说', '誰': '谁', '課': '课', '調': '调', '談': '谈',
  '請': '请', '論': '论', '證': '证', '識': '识', '譜': '谱', '警': '警',
  '譯': '译', '議': '议', '護': '护', '讀': '读', '變': '变', '讓': '让',
  '負': '负', '財': '财', '責': '责', '貨': '货', '質': '质', '費': '费',
  '貼': '贴', '資': '资', '賞': '赏', '賢': '贤', '賣': '卖', '賦': '赋',
  '質': '质', '賴': '赖', '賺': '赚', '賽': '赛', '贊': '赞', '贈': '赠',
  '贏': '赢', '趕': '赶', '趙': '赵', '躍': '跃', '車': '车', '軌': '轨',
  '軍': '军', '軒': '轩', '軟': '软', '軸': '轴', '較': '较', '載': '载',
  '輔': '辅', '輕': '轻', '輛': '辆', '輝': '辉', '輩': '辈', '輪': '轮',
  '輯': '辑', '輸': '输', '轉': '转', '辦': '办', '辭': '辞', '農': '农',
  '連': '连', '進': '进', '運': '运', '過': '过', '達': '达', '違': '违',
  '遙': '遥', '遜': '逊', '遠': '远', '適': '适', '選': '选', '遺': '遗',
  '還': '还', '邁': '迈', '邊': '边', '邏': '逻', '郵': '邮', '鄉': '乡',
  '鄰': '邻', '醫': '医', '釋': '释', '針': '针', '釣': '钓', '銀': '银',
  '銅': '铜', '銘': '铭', '銷': '销', '鋒': '锋', '銳': '锐', '錯': '错',
  '錄': '录', '鋼': '钢', '錢': '钱', '錦': '锦', '鍵': '键', '鍾': '钟',
  '鎖': '锁', '鎮': '镇', '鏡': '镜', '鐘': '钟', '鐵': '铁', '鑑': '鉴',
  '鑽': '钻', '長': '长', '門': '门', '閃': '闪', '閉': '闭', '開': '开',
  '閒': '闲', '間': '间', '閘': '闸', '閣': '阁', '閱': '阅', '闊': '阔',
  '關': '关', '闡': '阐', '隊': '队', '階': '阶', '陽': '阳', '陰': '阴',
  '陣': '阵', '陸': '陆', '陳': '陈', '險': '险', '隨': '随', '隱': '隐',
  '隻': '只', '雙': '双', '雜': '杂', '雞': '鸡', '離': '离', '難': '难',
  '雲': '云', '電': '电', '霧': '雾', '靈': '灵', '靜': '静', '響': '响',
  '頁': '页', '頂': '顶', '項': '项', '順': '顺', '須': '须', '預': '预',
  '頑': '顽', '頓': '顿', '頗': '颇', '領': '领', '頻': '频', '顆': '颗',
  '題': '题', '額': '额', '顏': '颜', '願': '愿', '類': '类', '顧': '顾',
  '顯': '显', '風': '风', '飄': '飘', '飛': '飞', '飯': '饭', '飲': '饮',
  '飾': '饰', '養': '养', '餘': '余', '館': '馆', '馬': '马', '駁': '驳',
  '駐': '驻', '駕': '驾', '駛': '驶', '駝': '驼', '騎': '骑', '騙': '骗',
  '驅': '驱', '驕': '骄', '驗': '验', '驚': '惊', '驟': '骤', '體': '体',
  '髮': '发', '鬆': '松', '鬥': '斗', '鬧': '闹', '鬱': '郁', '魚': '鱼',
  '魯': '鲁', '鮮': '鲜', '鳥': '鸟', '鳴': '鸣', '鳳': '凤', '鳴': '鸣',
  '鹽': '盐', '麗': '丽', '麥': '麦', '麵': '面', '黃': '黄', '點': '点',
  '黨': '党', '齊': '齐', '齒': '齿', '齡': '龄', '龍': '龙', '龜': '龟',
  '從': '从', '眾': '众', '優': '优', '傘': '伞', '偉': '伟', '傷': '伤',
  '傭': '佣', '偽': '伪', '僥': '侥', '儀': '仪', '億': '亿', '價': '价',
  '儲': '储', '兒': '儿', '兌': '兑', '兩': '两', '冊': '册', '凍': '冻',
  '凜': '凛', '凱': '凯', '別': '别', '刪': '删', '剄': '刭', '則': '则',
  '剛': '刚', '剝': '剥', '創': '创', '劃': '划', '劇': '剧', '劉': '刘',
  '劍': '剑', '劑': '剂', '勁': '劲', '動': '动', '務': '务', '勳': '勋',
  '勝': '胜', '勞': '劳', '勢': '势', '匯': '汇', '區': '区', '協': '协',
  '卻': '却', '廠': '厂', '廳': '厅', '歷': '历', '厲': '厉', '壓': '压',
  '厭': '厌', '廁': '厕', '參': '参', '叢': '丛', '吳': '吴', '員': '员',
  '喚': '唤', '啟': '启', '問': '问', '啞': '哑', '喬': '乔', '單': '单',
  '喪': '丧', '嘆': '叹', '噴': '喷', '嚇': '吓', '嚴': '严', '囑': '嘱',
  '國': '国', '圍': '围', '園': '园', '圓': '圆', '圖': '图', '團': '团',
  '執': '执', '堅': '坚', '場': '场', '塊': '块', '塗': '涂', '塵': '尘',
  '墊': '垫', '墜': '坠', '墮': '堕', '壘': '垒', '壯': '壮', '壺': '壶',
  '壽': '寿', '夠': '够', '夢': '梦', '夾': '夹', '奧': '奥', '奪': '夺',
  '獎': '奖', '奮': '奋', '妝': '妆', '婦': '妇', '媽': '妈', '娛': '娱',
  '孫': '孙', '學': '学', '實': '实', '寧': '宁', '審': '审', '寫': '写',
  '寬': '宽', '寵': '宠', '寶': '宝', '將': '将', '專': '专', '尋': '寻',
  '對': '对', '導': '导', '爾': '尔', '塵': '尘', '堯': '尧', '屆': '届',
  '屍': '尸', '屏': '屏', '屬': '属', '岡': '冈', '島': '岛', '峽': '峡',
  '嵐': '岚', '嶺': '岭', '嶽': '岳', '幣': '币', '帥': '帅', '師': '师',
  '帳': '帐', '帶': '带', '幀': '帧', '幫': '帮', '幹': '干', '幾': '几',
  '庫': '库', '應': '应', '廟': '庙', '廢': '废', '廣': '广', '廳': '厅',
  '開': '开', '異': '异', '棄': '弃', '張': '张', '強': '强', '彈': '弹',
  '歸': '归', '當': '当', '錄': '录', '彙': '汇', '彥': '彦', '徹': '彻',
  '徑': '径', '從': '从', '復': '复', '徵': '征', '德': '德', '憶': '忆',
  '憂': '忧', '快': '快', '懷': '怀', '態': '态', '慍': '愠', '慘': '惨',
  '懲': '惩', '懶': '懒', '懼': '惧', '戀': '恋', '愛': '爱', '慶': '庆',
  '憑': '凭', '懇': '恳', '應': '应', '憲': '宪', '戰': '战', '戲': '戏',
  '戶': '户', '拋': '抛', '掃': '扫', '揚': '扬', '換': '换', '揮': '挥',
  '損': '损', '搖': '摇', '搜': '搜', '搞': '搞', '搬': '搬', '搶': '抢',
  '摘': '摘', '撥': '拨', '撫': '抚', '撲': '扑', '擁': '拥', '擇': '择',
  '擊': '击', '擋': '挡', '操': '操', '擔': '担', '據': '据', '擠': '挤',
  '擦': '擦', '擬': '拟', '擴': '扩', '擺': '摆', '擾': '扰', '攝': '摄',
  '攤': '摊', '攪': '搅', '攬': '揽', '敵': '敌', '數': '数', '斂': '敛',
  '斃': '毙', '斬': '斩', '斷': '断', '無': '无', '舊': '旧', '時': '时',
  '晝': '昼', '暈': '晕', '暉': '晖', '暢': '畅', '暫': '暂', '曉': '晓',
  '曠': '旷', '曬': '晒', '書': '书', '會': '会', '朧': '胧', '術': '术',
  '機': '机', '殺': '杀', '雜': '杂', '權': '权', '條': '条', '來': '来',
  '楊': '杨', '傑': '杰', '極': '极', '構': '构', '槍': '枪', '楓': '枫',
  '業': '业', '樣': '样', '標': '标', '模': '模', '樹': '树', '橋': '桥',
  '檢': '检', '檔': '档', '櫃': '柜', '欄': '栏', '權': '权', '歡': '欢',
  '歐': '欧', '歲': '岁', '歷': '历', '歸': '归', '殘': '残', '殲': '歼',
  '殼': '壳', '毀': '毁', '畢': '毕', '氣': '气', '氫': '氢', '氧': '氧',
  '決': '决', '沒': '没', '沖': '冲', '況': '况', '洩': '泄', '洶': '汹',
  '洲': '洲', '洶': '汹', '淨': '净', '淺': '浅', '測': '测', '濟': '济',
  '瀏覽': '浏览',
};

export function toSimplified(str) {
  if (!str || typeof str !== 'string') return str;
  let out = str;
  for (const [trad, simp] of PHRASE_T2S) {
    if (out.includes(trad)) {
      out = out.split(trad).join(simp);
    }
  }
  let res = '';
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    res += CHAR_T2S[ch] || ch;
  }
  return res;
}

// ============================================================================
// UI & System Strings Dictionary
// ============================================================================

const STRINGS = {
  pageTitle: {
    zhTW: '榧木師範 — 圍棋對弈與 AI 指導',
    en: 'Kaya Sensei — Go Game & AI Coach',
  },
  brandName: {
    zhTW: '榧木師範',
    en: 'Kaya Sensei',
  },
  brandSub: {
    zhTW: '圍棋對弈與 AI 指導',
    en: 'Go & AI Coach',
  },
  ariaModeSwitch: {
    zhTW: '功能切換',
    en: 'Switch Mode',
  },
  tabPlay: {
    zhTW: '對弈指導',
    en: 'Play & Coach',
  },
  tabDojo: {
    zhTW: '實戰道場',
    en: 'Practice Dojo',
  },
  btnNewGame: {
    zhTW: '新開一局',
    en: 'New Game',
  },
  titleSound: {
    zhTW: '切換落子音效',
    en: 'Toggle stone sound',
  },
  titleLang: {
    zhTW: '切換介面語言',
    en: 'Select Language',
  },
  ariaGoban: {
    zhTW: '圍棋棋盤',
    en: 'Go Board',
  },
  capturesLabel: {
    zhTW: '提子：',
    en: 'Captures: ',
  },
  youBlack: {
    zhTW: '您（黑棋）',
    en: 'You (Black)',
  },
  aiBlack: {
    zhTW: '師範 AI（黑棋）',
    en: 'Sensei AI (Black)',
  },
  youWhite: {
    zhTW: '您（白棋）',
    en: 'You (White)',
  },
  aiWhite: {
    zhTW: '師範 AI（白棋）',
    en: 'Sensei AI (White)',
  },
  blackShort: { zhTW: '黑棋', en: 'Black' },
  whiteShort: { zhTW: '白棋', en: 'White' },
  blackWinShort: { zhTW: '黑勝', en: 'Black +' },
  whiteWinShort: { zhTW: '白勝', en: 'White +' },
  gameMetaPill: {
    zhTW: '{size}路 · 貼 {komi} 目 · {rank} AI',
    en: '{size}×{size} · Komi {komi} · {rank} AI',
  },
  turnViewing: {
    zhTW: '檢視第 {move} 手',
    en: 'Viewing Move {move}',
  },
  turnScoring: {
    zhTW: '請點選死子確認勝負',
    en: 'Click dead stones to score',
  },
  turnResignWin: {
    zhTW: '{winner}中盤勝',
    en: '{winner} wins by resignation',
  },
  turnMarginWin: {
    zhTW: '{winnerShort} {margin} 目',
    en: '{winnerShort}{margin} pts',
  },
  turnAiThinking: {
    zhTW: '師範 AI 思考中…',
    en: 'Sensei AI thinking…',
  },
  turnBlackPlay: {
    zhTW: '黑棋落子',
    en: 'Black to play',
  },
  turnWhitePlay: {
    zhTW: '白棋落子',
    en: 'White to play',
  },
  moveOpening: {
    zhTW: '開局',
    en: 'Start',
  },
  moveCounterFmt: {
    zhTW: '第 {cur}/{total} 手',
    en: 'Move {cur}/{total}',
  },
  // Retry Compare Banner
  retryBannerTag: {
    zhTW: '重練對照模式',
    en: 'Retry & Compare',
  },
  retryBannerText: {
    zhTW: '重練第 {moveNum} 手（原下在 {coord}，已在盤上標記）',
    en: 'Retrying Move {moveNum} (originally {coord}, marked on board)',
  },
  btnShowHintsRetry: {
    zhTW: '查看推薦選點',
    en: 'Show Hints',
  },
  btnRestoreOriginal: {
    zhTW: '還原原譜',
    en: 'Restore Game',
  },
  titleRestoreOriginal: {
    zhTW: '結束重練並還原至原始棋譜',
    en: 'Exit retry and restore the original full game',
  },
  origMoveTag: {
    zhTW: '原第{moveNum}手',
    en: 'Orig #{moveNum}',
  },
  origMoveDefault: {
    zhTW: '原本著手',
    en: 'Orig',
  },
  // Toolbar
  btnUndo: { zhTW: '悔棋', en: 'Undo' },
  titleUndo: { zhTW: '悔棋（⌘Z）', en: 'Undo (⌘Z)' },
  btnPass: { zhTW: '虛手', en: 'Pass' },
  titlePass: { zhTW: '虛手（停一手）', en: 'Pass turn' },
  btnResign: { zhTW: '認輸', en: 'Resign' },
  titleResign: { zhTW: '認輸結束本局', en: 'Resign game' },
  titleNavStart: { zhTW: '回到開局', en: 'First move' },
  titleNavPrev: { zhTW: '上一手', en: 'Previous move' },
  titleNavNext: { zhTW: '下一手', en: 'Next move' },
  titleNavEnd: { zhTW: '回到最新一手', en: 'Latest move' },
  btnTerritory: { zhTW: '形勢', en: 'Influence' },
  titleTerritory: { zhTW: '顯示地盤與厚薄形勢', en: 'Show territory & influence' },
  btnAtari: { zhTW: '叫吃', en: 'Atari' },
  titleAtari: { zhTW: '標記被叫吃的棋串', en: 'Highlight stones in atari' },
  btnNumbers: { zhTW: '手數', en: 'Numbers' },
  titleNumbers: { zhTW: '顯示落子手數', en: 'Show move numbers' },
  btnExportSgf: { zhTW: '棋譜', en: 'SGF' },
  titleExportSgf: { zhTW: '下載 SGF 棋譜', en: 'Export SGF file' },
  // Dojo Toolbar
  btnDojoReset: { zhTW: '重設題目', en: 'Reset' },
  btnDojoPrev: { zhTW: '← 上一題', en: '← Prev' },
  btnDojoNext: { zhTW: '下一題 →', en: 'Next →' },
  dojoSolvedPill: { zhTW: '✓ 已通過', en: '✓ Solved' },
  // Scoring Card
  scoringTitle: { zhTW: '點目與死子確認', en: 'Scoring & Dead Stones' },
  scoringTitleDone: { zhTW: '終局結果', en: 'Game Result' },
  ruleChinese: { zhTW: '數子法', en: 'Chinese' },
  ruleJapanese: { zhTW: '數目法', en: 'Japanese' },
  scoringInstrPlaying: {
    zhTW: '雙方皆已虛手。請點擊棋盤上的死子棋串切換狀態，確認無誤後點選「確認勝負」。',
    en: 'Both players passed. Click any dead stone group to toggle its status, then click Confirm Result.',
  },
  scoringInstrResign: {
    zhTW: '{loser}認輸——{winner}中盤勝！可點擊下方關鍵手數重練檢討，或新開一局。',
    en: '{loser} resigned — {winner} wins! Review key mistakes below or start a new game.',
  },
  scoringInstrMargin: {
    zhTW: '{winner}勝 {margin} 目（採用{rules}規則）。',
    en: '{winner} wins by {margin} points ({rules} rules).',
  },
  btnAcceptScore: { zhTW: '確認勝負', en: 'Confirm Result' },
  btnResumePlay: { zhTW: '繼續對弈', en: 'Resume' },
  postgameSubheading: { zhTW: '本局關鍵問題手檢討', en: 'Key Mistakes Review' },
  scoreBlackTotal: { zhTW: '黑棋總計', en: 'Black Total' },
  scoreWhiteTotal: { zhTW: '白棋總計', en: 'White Total' },
  scoreSubBlackChinese: { zhTW: '空 {terr} ＋ 子 {stones}', en: 'Terr {terr} + Stones {stones}' },
  scoreSubBlackJapanese: { zhTW: '空 {terr} ＋ 提子 {caps}', en: 'Terr {terr} + Caps {caps}' },
  scoreSubWhiteChinese: { zhTW: '空 {terr} ＋ 子 {stones} ＋ 貼 {komi}', en: 'Terr {terr} + Stones {stones} + Komi {komi}' },
  scoreSubWhiteJapanese: { zhTW: '空 {terr} ＋ 提子 {caps} ＋ 貼 {komi}', en: 'Terr {terr} + Caps {caps} + Komi {komi}' },
  noMistakesMsg: {
    zhTW: '精彩的一局！本局沒有被師範標記的重大失誤。',
    en: 'Great game! No major mistakes were flagged by Sensei.',
  },
  momentTitle: {
    zhTW: '點擊檢視第 {moveNum} 手局面',
    en: 'Click to inspect Move {moveNum}',
  },
  momentStrong: {
    zhTW: '第 {moveNum} 手（{coord}）· −{dropPct}%',
    en: 'Move {moveNum} ({coord}) · −{dropPct}%',
  },
  momentSenseiRec: {
    zhTW: ' · 師範推薦 {coord}',
    en: ' · Sensei: {coord}',
  },
  btnInspect: { zhTW: '檢討', en: 'Review' },
  btnRetryShort: { zhTW: '重練', en: 'Retry' },
  // Problem Review Card
  problemReviewIcon: { zhTW: '檢', en: 'R' },
  problemReviewTitle: { zhTW: '問題手專題檢討', en: 'Mistake Review' },
  problemReviewSubtitle: {
    zhTW: '第 {cur} / {total} 處問題手',
    en: 'Mistake {cur} / {total}',
  },
  titleExitProblemReview: { zhTW: '退出問題手檢討', en: 'Close mistake review' },
  btnPrevProblem: { zhTW: '← 上一處', en: '← Prev' },
  btnPracticeCurrent: { zhTW: '從此手重練', en: 'Retry Here' },
  btnNextProblem: { zhTW: '下一處 →', en: 'Next →' },
  problemReviewMoveLabel: {
    zhTW: '第 {moveNum} 手（原下在 <span style="color:#f87171">{coord}</span>）',
    en: 'Move {moveNum} (played <span style="color:#f87171">{coord}</span>)',
  },
  problemReviewDrop: {
    zhTW: '勝率 −{dropPct}%',
    en: 'Winrate −{dropPct}%',
  },
  problemReviewRec: {
    zhTW: '🎯 師範建議：{detail}',
    en: '🎯 Sensei recommends: {detail}',
  },
  problemReviewRecTop: {
    zhTW: '首選 {coord}（{reason}）',
    en: 'Top move {coord} ({reason})',
  },
  problemReviewRecBoard: {
    zhTW: '見棋盤選點',
    en: 'See marked board candidates',
  },
  // Coach Card
  coachAvatar: { zhTW: '師', en: 'AI' },
  coachTitle: { zhTW: 'AI 指導教練', en: 'Sensei AI Coach' },
  coachSubtitle: { zhTW: '即時著手評級與選點分析', en: 'Live move grading & suggestions' },
  titleToggleCoach: { zhTW: '切換即時 AI 指導模式', en: 'Toggle live AI coaching' },
  coachReadyUser: {
    zhTW: '準備就緒，請下出您的下一手！',
    en: 'Ready! Play your next move.',
  },
  coachReadyAi: {
    zhTW: '師範 AI 正在佈局開局…',
    en: 'Sensei AI is playing the opening…',
  },
  coachDefaultExp: {
    zhTW: '我會即時評析您的每一手——包含局部急所、棋形效率與佈局方向，遇到問題手時可一鍵重試。',
    en: 'I evaluate every move for urgent tactics, shape efficiency, and whole-board direction, with one-click retry on mistakes.',
  },
  btnAskHint: {
    zhTW: '顯示推薦選點（前三手）',
    en: 'Show Top 3 Moves',
  },
  btnAskHintAnalyzing: {
    zhTW: '分析中…',
    en: 'Analyzing…',
  },
  btnRetryMove: {
    zhTW: '↺ 重下這手',
    en: '↺ Retry Move',
  },
  coachPausedMsg: {
    zhTW: '即時指導目前已暫停，進入純粹對弈模式。隨時可重新開啟以獲得著手評析與選點提示。',
    en: 'Live coaching is paused for pure play. Re-enable anytime for move grading and hints.',
  },
  coachEvaluatingHead: {
    zhTW: '師範正在評析您的這手棋…',
    en: 'Sensei is evaluating your move…',
  },
  coachEvaluatingExp: {
    zhTW: '正在檢視局部急所、棋形效率與更佳選點。',
    en: 'Checking local urgency, shape efficiency, and top alternatives.',
  },
  coachRetryHead: {
    zhTW: '重練第 {moveNum} 手——原落子於 {coord}',
    en: 'Retrying Move {moveNum} — originally {coord}',
  },
  coachRetryExp: {
    zhTW: '棋盤上已用紅色虛線標註您原來的下法（{coord}）。請直接點選更強的選點，或點擊「顯示推薦選點」參考師範建議。',
    en: 'Your original move ({coord}) is marked with a red dashed ring. Play a stronger move to compare, or click Show Top 3 Moves.',
  },
  coachRetryBetterHead: {
    zhTW: '重練成功！{newCoord} 明顯優於原著手 {origCoord}',
    en: 'Great retry! {newCoord} clearly beats original {origCoord}',
  },
  coachRetryBetterExp: {
    zhTW: '此手勝率較原著手提升了約 +{diff}%！{origExp}',
    en: 'Winrate improved by +{diff}% vs. original! {origExp}',
  },
  coachRetryWorseHead: {
    zhTW: '新著手 {newCoord} 比原著手 {origCoord} 稍顯吃力',
    en: 'New move {newCoord} is slightly weaker than {origCoord}',
  },
  coachRetryWorseExp: {
    zhTW: '勝率差距約 {diff}%。{origExp}',
    en: 'Winrate difference: {diff}%. {origExp}',
  },
  coachRetrySimilarHead: {
    zhTW: '重練手 {newCoord} 與原下法 {origCoord} 效果接近',
    en: 'Retry {newCoord} is similar in value to original {origCoord}',
  },
  coachDeltaWr: {
    zhTW: '勝率 {delta}%',
    en: 'Winrate {delta}%',
  },
  coachDeltaMatch: {
    zhTW: '符合推薦',
    en: 'On target',
  },
  coachPassHead: {
    zhTW: '師範建議：虛手',
    en: 'Sensei recommends: Pass',
  },
  coachPassExp: {
    zhTW: '盤面已經定型，現在虛手即可進入點目計分階段。',
    en: 'The board is settled. Passing now moves the game to scoring.',
  },
  candClickTitle: {
    zhTW: '點擊直接下在 {coord}',
    en: 'Click to play at {coord}',
  },
  candWr: {
    zhTW: '勝率 {pct}%',
    en: 'Win {pct}%',
  },
  // Winrate Card
  winrateTitle: { zhTW: '勝率與形勢判斷', en: 'Winrate & Evaluation' },
  leadEven: { zhTW: '勢均力敵', en: 'Even' },
  leadBlack: { zhTW: '黑領先 {lead} 目', en: 'Black +{lead}' },
  leadWhite: { zhTW: '白領先 {lead} 目', en: 'White +{lead}' },
  wrBlackLabel: { zhTW: '黑棋 ', en: 'Black ' },
  wrWhiteLabel: { zhTW: ' 白棋', en: ' White' },
  ariaWinrateGraph: { zhTW: '勝率走勢圖', en: 'Winrate trend graph' },
  graphHint: {
    zhTW: '點擊曲線上任意位置即可回顧該手局面',
    en: 'Click anywhere on the graph to review that move',
  },
  // Neural Network Card
  nnTitle: { zhTW: '神經網路 AI 引擎', en: 'Neural Network Engine' },
  nnSubtitle: { zhTW: '瀏覽器端 ONNX（WebGPU / WASM）', en: 'In-Browser ONNX (WebGPU / WASM)' },
  nnBadgeIdle: { zhTW: '內建引擎', en: 'Built-in' },
  nnBadgeLoading: { zhTW: '載入中…', en: 'Loading…' },
  nnBadgeError: { zhTW: '載入失敗', en: 'Load Failed' },
  ariaNnSelect: { zhTW: '選擇 ONNX 模型來源', en: 'Select ONNX model source' },
  nnOptRepo: {
    zhTW: '專案內建模型（./models/katago.onnx）',
    en: 'Repo Model (./models/katago.onnx)',
  },
  nnOptHf: {
    zhTW: 'KataGo b28c512 FP16（Hugging Face）',
    en: 'KataGo b28c512 FP16 (Hugging Face)',
  },
  nnOptCustom: {
    zhTW: '自訂 HTTPS 模型網址…',
    en: 'Custom HTTPS Model URL…',
  },
  nnCustomPlaceholder: {
    zhTW: '貼上 .onnx 模型網址（https://…）',
    en: 'Paste .onnx model URL (https://…)',
  },
  nnBtnLoad: { zhTW: '載入神經網路', en: 'Load Neural Net' },
  nnBtnFile: { zhTW: '本機 .onnx', en: 'Local .onnx' },
  nnTitleFile: { zhTW: '從本機選擇 .onnx 檔案', en: 'Load a local .onnx model file' },
  nnBtnUnload: { zhTW: '切換回內建', en: 'Use Built-in' },
  nnNoteDefault: {
    zhTW: '初次載入後自動快取於瀏覽器，支援 GitHub Pages 零伺服器部署。',
    en: 'Cached in browser after first load. Works serverless on GitHub Pages.',
  },
  nnProgCache: { zhTW: '從瀏覽器快取讀取模型…', en: 'Loading model from browser cache…' },
  nnProgInit: { zhTW: '正在編譯 WebGPU / WASM 運算圖…', en: 'Compiling WebGPU / WASM graph…' },
  nnProgDownload: { zhTW: '下載並快取模型中{mb}…', en: 'Downloading & caching model{mb}…' },
  nnProgDownloading: { zhTW: '下載中', en: 'Downloading' },
  nnBackendWebgpu: { zhTW: 'WebGPU GPU 加速', en: 'WebGPU Accelerated' },
  nnBackendWasm: { zhTW: 'WASM CPU 運行', en: 'WASM CPU' },
  nnActiveInfo: {
    zhTW: '已啟用：{name}（{backend}）。AI 對手、教練選點與形勢圖均由神經網路驅動！',
    en: 'Active: {name} ({backend}). AI opponent, coach hints & ownership are neural-net powered!',
  },
  nnToastReady: {
    zhTW: '已啟用神經網路 AI（{backend}）',
    en: 'Neural Net AI enabled ({backend})',
  },
  nnErrLoad: {
    zhTW: '無法載入模型：{err}。已自動維持使用內建引擎。',
    en: 'Failed to load model: {err}. Falling back to built-in engine.',
  },
  nnErrUnknown: { zhTW: '未知錯誤', en: 'Unknown error' },
  nnErrInvalidUrl: {
    zhTW: '請先輸入有效的 .onnx 模型網址。',
    en: 'Please enter a valid .onnx model URL first.',
  },
  nnCustomModelName: { zhTW: '自訂 ONNX 模型', en: 'Custom ONNX Model' },
  nnToastUnloaded: {
    zhTW: '已切換回內建輕量引擎',
    en: 'Switched back to built-in engine',
  },
  nnErrOrtLoad: { zhTW: 'ONNX Runtime Web 載入失敗', en: 'Failed to load ONNX Runtime Web' },
  nnErrOrtCdn: {
    zhTW: '無法連線至 ONNX Runtime Web CDN（請確認網路連線）',
    en: 'Cannot reach ONNX Runtime Web CDN (check internet connection)',
  },
  nnErrNotFound: {
    zhTW: '找不到模型檔案（HTTP {status}）',
    en: 'Model file not found (HTTP {status})',
  },
  // Dojo Sidebar
  dojoTitle: { zhTW: '師範專題練習', en: 'Sensei Guided Drill' },
  dojoBlackFirst: { zhTW: '黑先', en: 'Black to play' },
  dojoWhiteFirst: { zhTW: '白先', en: 'White to play' },
  dojoTurnTitle: { zhTW: '輪到您落子', en: 'Your turn' },
  dojoTurnBody: {
    zhTW: '請先在腦中仔細計算變化，再於棋盤上落子。',
    en: 'Read out the sequence in your head, then play on the board.',
  },
  btnDojoTryAgain: { zhTW: '↺ 再試一次', en: '↺ Try Again' },
  dojoHintTag: { zhTW: '教練提示', en: 'Coach Hint' },
  dojoTakeawayTag: { zhTW: '圍棋心法格言', en: 'Go Proverb & Takeaway' },
  dojoCurriculumTitle: { zhTW: '練習課程表', en: 'Curriculum' },
  dojoMasteryText: { zhTW: '已精通 {solved} / {total} 題', en: 'Mastered {solved} / {total}' },
  dojoCatAll: { zhTW: '全部', en: 'All' },
  dojoHintBtn: { zhTW: '提示（{n}/3）', en: 'Hint ({n}/3)' },
  dojoHintDone: { zhTW: '已標示正解急所', en: 'Answer Shown' },
  dojoSolvedTitle: { zhTW: '✓ 挑戰成功！', en: '✓ Solved!' },
  dojoContinueTitle: { zhTW: '好手——請繼續下完後續變化！', en: 'Good move — finish the sequence!' },
  dojoWrongTrapTitle: { zhTW: '遭到反擊（{coord}）', en: 'Refuted ({coord})' },
  dojoWrongOtherTitle: { zhTW: '未能擊中急所（{coord}）', en: 'Missed the vital point ({coord})' },
  dojoWrongOtherBody: {
    zhTW: '這手棋偏離了此題的核心思路。點選「再試一次」重新計算，或按「提示」請師範點撥！',
    en: 'This move misses the key idea of the problem. Click Try Again to recalculate, or use Hint!',
  },
  // Modal New Game
  modalTitle: { zhTW: '開局設定', en: 'New Game Setup' },
  ariaClose: { zhTW: '關閉', en: 'Close' },
  labelBoardSize: { zhTW: '棋盤路數', en: 'Board Size' },
  size9Title: { zhTW: '9 路', en: '9×9' },
  size9Sub: { zhTW: '快棋 · 局部戰鬥', en: 'Fast · Local fights' },
  size13Title: { zhTW: '13 路', en: '13×13' },
  size13Sub: { zhTW: '進階 · 攻防平衡', en: 'Balanced · Midgame' },
  size19Title: { zhTW: '19 路', en: '19×19' },
  size19Sub: { zhTW: '標準完整棋盤', en: 'Full standard board' },
  labelAiStrength: { zhTW: 'AI 對手棋力', en: 'AI Strength' },
  diff15kTitle: { zhTW: '15 級', en: '15 Kyu' },
  diff15kSub: { zhTW: '輕鬆練手', en: 'Relaxed' },
  diff10kTitle: { zhTW: '10 級', en: '10 Kyu' },
  diff10kSub: { zhTW: '棋社水準', en: 'Club level' },
  diff5kTitle: { zhTW: '5 級', en: '5 Kyu' },
  diff5kSub: { zhTW: '進階強手', en: 'Strong' },
  diffDanTitle: { zhTW: '段位 NN', en: 'Dan NN' },
  diffDanSub: { zhTW: '神經網路強化', en: 'Neural Net boosted' },
  labelYourColor: { zhTW: '您的執色', en: 'Your Color' },
  colorBlack: { zhTW: '執黑', en: 'Black' },
  colorWhite: { zhTW: '執白', en: 'White' },
  labelHandicap: { zhTW: '讓子設定（黑讓子）', en: 'Handicap (Black)' },
  handicap0: { zhTW: '分先（貼 6.5 目）', en: 'Even (Komi 6.5)' },
  handicap2: { zhTW: '讓 2 子（貼 0.5 目）', en: '2 Stones (Komi 0.5)' },
  handicap3: { zhTW: '讓 3 子（貼 0.5 目）', en: '3 Stones (Komi 0.5)' },
  handicap4: { zhTW: '讓 4 子（貼 0.5 目）', en: '4 Stones (Komi 0.5)' },
  labelLiveCoach: { zhTW: '即時 AI 指導模式', en: 'Live AI Coaching' },
  descLiveCoach: {
    zhTW: '即時評析每一手的效率與棋形，並在失誤時提供重試機會。',
    en: 'Grades every move for shape & urgency, with instant retry on mistakes.',
  },
  btnCancel: { zhTW: '取消', en: 'Cancel' },
  btnStartGame: { zhTW: '開始對弈', en: 'Start Game' },
  // Toasts
  toastViewingHistory: {
    zhTW: '目前正在檢視歷史手數——點擊 ›| 返回最新局面',
    en: 'Viewing move history — click ›| to return to live board',
  },
  toastIllegalMove: { zhTW: '無效落子', en: 'Illegal move' },
  toastRetryRewound: {
    zhTW: '已倒回第 {moveNum} 手，原落子 {coord} 已在盤面標記！',
    en: 'Rewound to Move {moveNum}. Original move {coord} is marked on board!',
  },
  toastRetryBack: {
    zhTW: '已退回第 {moveNum} 手，原落子 {coord} 已在盤面標記！',
    en: 'Stepped back to Move {moveNum}. Original move {coord} is marked on board!',
  },
  toastRestoredOriginal: {
    zhTW: '已還原原始完整棋譜！',
    en: 'Restored original full game record!',
  },
  toastBothPassed: {
    zhTW: '雙方皆已虛手——請點選死子確認勝負',
    en: 'Both players passed — click dead stones to score',
  },
  toastAiPassed: { zhTW: '師範 AI 選擇虛手', en: 'Sensei AI passed' },
  toastYouPassed: { zhTW: '您已選擇虛手', en: 'You passed' },
  toastYouResigned: { zhTW: '您已投子認輸', en: 'You resigned' },
  toastSgfExported: { zhTW: '已匯出 SGF 棋譜檔案', en: 'SGF game record exported' },
  toastResumed: { zhTW: '已恢復對弈', en: 'Game resumed' },
  // Engine Legal Errors & SGF
  coordPass: { zhTW: '虛手', en: 'Pass' },
  errOutOfBounds: { zhTW: '超出棋盤範圍', en: 'Out of board bounds' },
  errOccupied: { zhTW: '此交叉點已有棋子', en: 'Intersection already occupied' },
  errKo: {
    zhTW: '打劫不可立即提回——請先在別處尋劫',
    en: 'Ko rule: cannot recapture immediately — play a ko threat first',
  },
  errSuicide: {
    zhTW: '禁著點（落子無氣，不可自殺）',
    en: 'Suicide is illegal (zero liberties)',
  },
  errSuperko: {
    zhTW: '違反同形再現規則（全局同形禁著）',
    en: 'Positional superko violation (repeated board state)',
  },
  errNotPlaying: { zhTW: '目前非對弈階段', en: 'Game is not in playing phase' },
  sgfPlayer: { zhTW: '玩家', en: 'Player' },
  sgfAiLabel: { zhTW: '師範 AI（{rank}）', en: 'Sensei AI ({rank})' },
  // AI Coach Evaluation & Reasons
  tagCapture: { zhTW: '提吃對方 {n} 子', en: 'Capture {n} opponent stone(s)' },
  tagSaveAtari: { zhTW: '救出被叫吃的 {n} 子', en: 'Save {n} stone(s) in atari' },
  tagAtari: { zhTW: '叫吃對方棋串', en: 'Put opponent group in atari' },
  tagSelfAtari: { zhTW: '自填打吃', en: 'Self-atari' },
  tagHane: { zhTW: '扳', en: 'Hane' },
  tagTiger: { zhTW: '虎口', en: "Tiger's mouth" },
  tagCut: { zhTW: '切斷／楔入', en: 'Cut / wedge' },
  tagConnect: { zhTW: '厚實連接', en: 'Solid connection' },
  tagOpeningBig: { zhTW: '開局大場', en: 'Big opening point' },
  tagEmptyCorner: { zhTW: '佔據空角', en: 'Occupy empty corner' },
  tagCornerTerritory: { zhTW: '實地佔角', en: 'Corner territory' },
  tagCornerApproach: { zhTW: '掛角／締角', en: 'Corner approach / enclosure' },
  reasonSolid: { zhTW: '穩健的形勢選點', en: 'Solid positional move' },
  reasonCapture: { zhTW: '提吃對方 {n} 子', en: 'Captures {n} opponent stone(s)' },
  reasonSave: { zhTW: '救出被叫吃的 {n} 子', en: 'Saves {n} stone(s) in atari' },
  reasonAtari: { zhTW: '叫吃對方棋串（先手施壓）', en: 'Puts opponent in atari (sente pressure)' },
  reasonCut: { zhTW: '切斷分斷對方棋子', en: 'Cuts and splits opponent stones' },
  reasonConnect: { zhTW: '厚實連接我方棋串', en: 'Solidly connects your groups' },
  reasonTiger: { zhTW: '虎口好形（掛黏護斷）', en: "Strong tiger's mouth protecting the cut" },
  reasonHane: { zhTW: '積極扳出，壓縮對方並擴張實地', en: 'Active hane to press opponent & expand' },
  reasonEmptyCorner: { zhTW: '佔據空角（金角銀邊草肚皮）', en: 'Takes an empty corner (corners first!)' },
  reasonCornerApproach: { zhTW: '掛角或締角（角部大場）', en: 'Corner approach or enclosure' },
  reasonCornerBalanced: { zhTW: '均衡的角部開局選點（{coord}）', en: 'Balanced corner opening ({coord})' },
  reasonLine3: { zhTW: '三路穩健取地', en: '3rd-line move for solid territory' },
  reasonLine4: { zhTW: '四路兼顧外勢與中腹發展', en: '4th-line move balancing influence & center' },
  reasonExpand: { zhTW: '擴張外勢並掌握中腹與邊上要點', en: 'Expands influence across side & center' },
  gradeGoodPass: { zhTW: '合適虛手', en: 'Good Pass' },
  gradeEarlyPass: { zhTW: '虛手過早？', en: 'Early Pass?' },
  evalPassGoodHead: {
    zhTW: '乾淨俐落的虛手——盤面已無價值官子。',
    en: 'Clean pass — no valuable endgame moves remain.',
  },
  evalPassEarlyHead: {
    zhTW: '盤面上似乎還有可收的官子或空地。',
    en: 'There still appear to be valuable endgame points.',
  },
  evalPassGoodExp: {
    zhTW: '此時虛手可保留實地，避免在自己地盤內多填目數。',
    en: 'Passing preserves your territory instead of filling your own points.',
  },
  evalPassEarlyExp: {
    zhTW: '師範認為盤面仍有活躍選點，例如 {coord}。',
    en: 'Sensei still sees active moves on the board, such as {coord}.',
  },
  evalPassEarlyFallback: { zhTW: '邊界官子', en: 'border endgame' },
  gradeBrilliant: { zhTW: '妙手！', en: 'Brilliant!' },
  gradeBest: { zhTW: '首選好手', en: 'Best Move' },
  gradeGreat: { zhTW: '好手', en: 'Great' },
  gradeGood: { zhTW: '穩健', en: 'Solid' },
  gradeInaccuracy: { zhTW: '緩手', en: 'Inaccuracy' },
  gradeMistake: { zhTW: '問題手', en: 'Mistake' },
  gradeBlunder: { zhTW: '惡手', en: 'Blunder' },
  evalFillEyeHead: {
    zhTW: '您在 {coord} 填死了自己的真眼！',
    en: 'You filled your own eye at {coord}!',
  },
  evalFillEyeExp: {
    zhTW: '除非氣緊被迫補棋，否則絕不可填掉自己的真眼，這會縮小眼位並白白浪費一手。{rec}',
    en: 'Avoid filling your own true eye unless forced by shortage of liberties. {rec}',
  },
  evalRecTry: {
    zhTW: '建議改下 {coord}（{reason}）。',
    en: 'Consider {coord} ({reason}).',
  },
  evalSelfAtariHead: {
    zhTW: '在 {coord} 自填打吃！',
    en: 'Self-atari at {coord}!',
  },
  evalSelfAtariExp: {
    zhTW: '把{stones}送入只剩一口氣的叫吃狀態，等於白送對手提子。{rec}',
    en: 'This puts {stones} into atari with one liberty, gifting a capture. {rec}',
  },
  evalStonesMany: { zhTW: '這 {n} 顆棋子', en: 'these {n} stones' },
  evalStonesOne: { zhTW: '這顆子', en: 'this stone' },
  evalRecAlt: {
    zhTW: '不妨考慮 {coord}：{reason}。',
    en: 'Try {coord} instead: {reason}.',
  },
  evalMissedUrgentHead: {
    zhTW: '錯過局部急所 {coord}',
    en: 'Missed urgent local move {coord}',
  },
  evalMissedUrgentExp: {
    zhTW: '{coord} 可「{tag}」，這是眼前最緊急的戰術！圍棋中「急所先於大場」，救子或提子通常遠大於單純圍空。',
    en: '{coord} can "{tag}" — the most urgent tactic right now! Urgent moves come before big moves.',
  },
  evalEmptyTriHead: {
    zhTW: '凝重愚形——{coord} 形成空三角',
    en: 'Heavy shape — empty triangle at {coord}',
  },
  evalEmptyTriExp: {
    zhTW: '此手構成效率偏低的「空三角」愚形，氣數較少且圍空效率差。{rec}',
    en: 'This creates an inefficient empty triangle with fewer liberties. {rec}',
  },
  evalRecPrefer: {
    zhTW: '師範更推薦 {coord}（{reason}）。',
    en: 'Sensei prefers {coord} ({reason}).',
  },
  evalCapHead: { zhTW: '漂亮提子（{coord}）！', en: 'Clean capture ({coord})!' },
  evalCapExp: {
    zhTW: '乾淨提吃對方 {n} 子，既確保實地，也徹底消除了對方的餘味。',
    en: 'Cleanly captures {n} opponent stone(s), securing territory and removing aji.',
  },
  evalSaveHead: { zhTW: '關鍵救子（{coord}）！', en: 'Crucial save ({coord})!' },
  evalSaveExp: {
    zhTW: '及時長出逃離叫吃，成功保住我方 {n} 子並維持聯絡。',
    en: 'Escapes atari in time, saving {n} stone(s) and keeping your group connected.',
  },
  evalTigerHead: { zhTW: '漂亮的虎口好形（{coord}）', en: "Nice tiger's mouth ({coord})" },
  evalTigerExp: {
    zhTW: '虎口（掛黏）既能嚴密防守斷點，又保留最豐富的眼位彈性。',
    en: "A tiger's mouth firmly guards the cutting point while keeping flexible eye shape.",
  },
  evalHaneHead: { zhTW: '強硬的一扳（{coord}）！', en: 'Strong hane ({coord})!' },
  evalHaneExp: {
    zhTW: '繞到對方棋子頭上扳出，有效緊縮對手氣數並對棋形施壓。',
    en: 'Bending around the opponent reduces their liberties and applies pressure.',
  },
  evalCutHead: { zhTW: '果斷切斷（{coord}）！', en: 'Decisive cut ({coord})!' },
  evalCutExp: {
    zhTW: '將對手分斷成兩塊孤棋，迫使對手兩面受敵、難以兼顧。',
    en: 'Splits the opponent into two weak groups, forcing them to defend both.',
  },
  evalAtariHead: { zhTW: '犀利叫吃（{coord}）！', en: 'Sharp atari ({coord})!' },
  evalAtariExp: {
    zhTW: '叫吃對手搶佔先手（主動權），迫使對方必須應手防守。',
    en: 'Puts the opponent in atari with sente (initiative), forcing a response.',
  },
  evalDirHead: { zhTW: '大局方向極佳（{coord}）', en: 'Great direction of play ({coord})' },
  evalDirExp: {
    zhTW: '與師範的首選非常一致——在實地與外勢之間取得極佳平衡。',
    en: "Matches Sensei's top choice — a great balance of territory and influence.",
  },
  evalGoodHead: { zhTW: '紮實可下的一手（{coord}）', en: 'Solid, playable move ({coord})' },
  evalGoodExpAlt: {
    zhTW: '步調穩健。師範略微偏好 {coord}（{reason}），勝率差距約 {drop}%。',
    en: 'Steady pace. Sensei slightly prefers {coord} ({reason}), about {drop}% difference.',
  },
  evalGoodExpSame: {
    zhTW: '維持了良好的棋形與全盤平衡。',
    en: 'Maintains good shape and whole-board balance.',
  },
  evalLine1Head: { zhTW: '過早落子一路（{coord}）', en: 'Too early on the 1st line ({coord})' },
  evalLine1Exp: {
    zhTW: '未到官子階段前，一路落子能圍到的目數極少。應優先考慮三、四路或更大之處，例如 {coord}（{reason}）。',
    en: 'Before endgame, 1st-line moves score very little. Aim for 3rd/4th-line points like {coord} ({reason}).',
  },
  evalLine2Head: { zhTW: '開局過早走二路（{coord}）', en: 'Early 2nd-line move ({coord})' },
  evalLine2Exp: {
    zhTW: '開局階段二路被稱為「敗北之線」，過於低位被動。建議瞄準三路（實地）或四路（外勢），例如 {coord}。',
    en: 'In the opening, the 2nd line is too low and passive. Aim for the 3rd or 4th line, such as {coord}.',
  },
  evalBiggerHead: { zhTW: '盤面有更大之處：{coord}', en: 'Bigger point available: {coord}' },
  evalSlowHead: { zhTW: '{coord} 方向略緩', en: '{coord} is a bit slow' },
  evalSlowExp: {
    zhTW: '這手估計損失約 {drop}% 勝率。建議考慮 {coord}：{reason}。',
    en: 'This loses roughly {drop}% winrate. Consider {coord}: {reason}.',
  },
  evalSlowFallback: {
    zhTW: '試著尋找能壓迫弱棋，或在開闊三、四路擴張實地的大場。',
    en: 'Look for moves that pressure weak groups or expand on open 3rd/4th-line sides.',
  },
};

export function t(key, params = {}) {
  const entry = STRINGS[key];
  if (!entry) return key;
  let str;
  if (currentLang === 'en') {
    str = entry.en ?? entry.zhTW;
  } else if (currentLang === 'zh-CN') {
    str = entry.zhCN !== undefined ? entry.zhCN : toSimplified(entry.zhTW);
  } else {
    str = entry.zhTW;
  }
  for (const [k, v] of Object.entries(params)) {
    str = str.split(`{${k}}`).join(String(v));
  }
  return str;
}

export function localizeRank(rankStr) {
  if (!rankStr) return '';
  if (currentLang === 'en') {
    const m = rankStr.match(/(\d+)\s*級/);
    if (m) return `${m[1]} Kyu`;
    if (rankStr.includes('段位')) return 'Dan NN';
    return rankStr;
  }
  if (currentLang === 'zh-CN') {
    return toSimplified(rankStr);
  }
  return rankStr;
}

export function localizeChinese(zhTW) {
  if (currentLang === 'zh-CN') return toSimplified(zhTW);
  return zhTW;
}

// ============================================================================
// English Translations for Dojo Categories & All 15 Puzzles
// ============================================================================

const CATEGORY_EN = {
  tesuji: { name: 'Tesuji Tactics', jp: 'Tesuji', description: 'Sharp local tactics: nets, snapbacks, and wedges.' },
  tsumego: { name: 'Life & Death', jp: 'Tsumego', description: 'Vital eye points, making two eyes, and nakade kills.' },
  shape: { name: 'Good Shape', jp: 'Shape', description: "Bamboo joints, tiger's mouths, and hane at the head of two stones." },
  opening: { name: 'Opening & Joseki', jp: 'Opening', description: 'Corners-first strategy, corner enclosures, and modern 3-3 joseki.' },
  yose: { name: 'Endgame', jp: 'Yose', description: 'Defending the monkey jump, 1st-line hane-connect, and liberty tesuji.' },
};

const PUZZLE_EN = {
  'tesuji-net': {
    title: 'The Net (Geta)',
    goal: 'Black to play and capture the cutting White stone at E5.',
    briefing: 'White has ladder breakers at G7 and H5, so a direct ladder fails. Instead of atari, step back diagonally to loosely capture E5 in a net.',
    hints: [
      'Direct atari (E6 or F5) lets White run toward G7 or H5. Try stepping diagonally to cover both exits at once.',
      'Look at the diagonal intersection northeast of E5.',
      'Play F6 (the net) to seal all of White\'s escape routes at once.',
    ],
    treeMessages: {
      F6: 'Beautiful F6 net! White pushes out at E6 — block immediately from above!',
      'F6>E7': 'Clean block at E7! White tries one last push at F5 — close the net.',
      'F6>E7>G5': 'Clean capture! All three White stones are trapped in the net.',
    },
    trapMessages: {
      E6: 'Direct atari at E6 fails: White extends to F5 and connects toward H5 and G7. Use the looser net instead!',
      F5: 'Atari from below at F5 lets White break out at E6 toward G7. Cover diagonally to seal both exits.',
    },
    takeaway: 'When a ladder is broken, always check for a net (geta) — a loose diagonal surround that captures regardless of which way the opponent pushes.',
  },
  'tesuji-snapback': {
    title: 'Snapback Tesuji',
    goal: 'Black to play and capture the four White stones (D6–E6–E5–E4).',
    briefing: 'The four White stones have only two liberties (D5 and D4) and want to connect to C5. Sacrifice a stone by throwing in to create a snapback.',
    hints: [
      'Do not play atari from outside (D4), or White connects at D5. Can you sacrifice a stone inside White\'s connection point?',
      'Focus on the cutting point between D6, E5, and C5.',
      'Throw in at D5! After White captures at D4, immediately recapture at D5 for a snapback.',
    ],
    treeMessages: {
      D5: 'Sharp throw-in at D5! White is forced to capture at D4 — now look at White\'s liberties!',
      'D5>D5': 'Beautiful snapback! Since White\'s five stones have only one liberty (not a single-stone ko), Black recaptures immediately at D5!',
    },
    trapMessages: {
      D4: 'Atari from outside at D4 lets White connect solidly at D5 to C5 with plenty of liberties. Throw in first!',
    },
    takeaway: 'A snapback sacrifices one stone so the opponent\'s capture leaves a multi-stone group in atari. Because multiple stones are captured back, ko does not apply.',
  },
  'tesuji-wedge': {
    title: 'Wedge & Shortage of Liberties',
    goal: 'Black to play, separate and capture the two White stones (E7–E8).',
    briefing: 'White\'s left group (A7–C7) is already alive and ready to link up with E7–E8. Use a sharp wedge to exploit White\'s shortage of liberties.',
    hints: [
      'Blocking on top (D8 or C8) lets White connect easily underneath at D7. Wedge straight between the two stones first!',
      'Wedge directly into the intersection between C7 and E7.',
      'Wedge at D7 in atari! If White tries to connect at D8, capture from the outside at C8!',
    ],
    treeMessages: {
      D7: 'Brilliant D7 wedge! White extends to D8 trying to reach B8 — deliver the finishing blow!',
      'D7>C8': 'Tesuji capture! C8 takes the last liberty of the three White stones — capture comes before suicide check!',
    },
    trapMessages: {
      D8: 'Playing D8 first lets White connect comfortably at D7 to the living group on the left.',
      C8: 'C8 is too slow; White simply connects at D7 and saves E7–E8.',
    },
    takeaway: 'Wedging between two stones exploits a shortage of liberties, cutting off the opponent before they can connect.',
  },
  'tsumego-two-eyes': {
    title: 'Vital Point of Straight Three',
    goal: 'Black to play and live unconditionally on the top edge.',
    briefing: 'Black\'s group is completely surrounded with three empty spaces in a row (C9–D9–E9, a "straight three"). Find the sole vital point to make two true eyes.',
    hints: [
      'Go proverb: "My opponent\'s vital point is my vital point."',
      'Split the three adjacent empty intersections right down the middle into two separate eyes.',
      'Play the center point D9 to create two true eyes at C9 and E9.',
    ],
    treeMessages: {
      D9: 'Unconditionally alive! D9 splits the eye space into two independent eyes at C9 and E9.',
    },
    trapMessages: {
      C9: 'Playing on the side lets White take the vital center D9! Even after capturing White, only one eye remains.',
      E9: 'Playing E9 hands over the center vital point D9, leaving Black with only one eye.',
    },
    takeaway: 'Straight three is the foundational life-and-death shape: whoever plays the center point wins the fight.',
  },
  'tsumego-nakade': {
    title: 'Bulky Five Nakade Kill',
    goal: 'Black to play and kill White in the top-right corner.',
    briefing: 'White has five spaces in the corner shaped like a "bulky five" (a 2×2 square plus G9). Place a stone on the unique vital point (nakade) to prevent two eyes.',
    hints: [
      'Find the intersection touching both the "handle" (G9) and the 2×2 square.',
      'Look on the top 1st line, directly to the right of G9.',
      'Play H9 first! If White resists at H8, follow up at J9 to kill cleanly.',
    ],
    treeMessages: {
      H9: 'Bullseye! H9 is the sole vital point of the bulky five. White plays H8 to separate G9 — stop the second eye!',
      'H9>J9': 'White is dead! Even if White later captures the two Black stones, the remaining space forms only one eye.',
    },
    trapMessages: {
      H8: 'White happily takes the vital point H9! Now G9 is one eye and J8/J9 makes a second eye.',
      J9: 'J9 misses the vital point; after White takes H9, G9 and H8/J8 easily form two eyes.',
      G9: 'G9 is too shallow; White defends at H8 and lives effortlessly.',
    },
    takeaway: 'Straight three, bent four, bulky five, and rabbity six each have one unique nakade vital point — for bulky five, it is where the handle meets the square.',
  },
  'tsumego-2-1-point': {
    title: 'The Corner 2-1 Vital Point',
    goal: 'Black to play and kill White in the top-left corner.',
    briefing: 'White already has one eye at A7 and plans to make a second eye on the top edge (A9–B9–C9). Using Black\'s outside helper at D9, destroy White\'s eye with the famous 2-1 point.',
    hints: [
      'Reducing from outside at C9 lets White block at B9 and make a second eye at A9. Drop directly onto the vital point!',
      'Look at the classic corner "2-1" point (2nd intersection along the 1st line).',
      'Play B9! White cannot play C9 (suicide), and if White plays A9, Black connects back at C9!',
    ],
    treeMessages: {
      B9: 'Classic 2-1 placement (B9)! White cannot play C9 (illegal) and must play A9 — connect your stone home!',
      'B9>C9': 'Clean kill! Black connects at C9 to D9, wiping out the top eye so White dies with only A7.',
    },
    trapMessages: {
      C9: 'Approaching from outside at C9 is too slow — White blocks at B9 and A9 becomes a second true eye!',
      A9: 'Throwing in at A9 first lets White capture at B9 and immediately form a second eye at A9.',
    },
    takeaway: 'The corner 2-1 point is one of the most frequent vital points in tsumego — always test placing directly on 2-1 when attacking corners!',
  },
  'shape-bamboo': {
    title: 'Bamboo Joint Connection',
    goal: 'Choose the strongest, most efficient shape to connect Black.',
    briefing: 'White peeps from above and below (E6 and E3) trying to cut F5 from D4–D5. Avoid heavy shape and build Go\'s most resilient connection!',
    hints: [
      'Instead of filling E5 and leaving F4 wide open, pair up on the right to mirror D4–D5.',
      'Add a stone directly beneath F5 to form a 2×3 parallel pillar structure.',
      'Play F4 to form an unbreakable bamboo joint.',
    ],
    treeMessages: {
      F4: 'Textbook bamboo joint! Even though E5 and E4 are empty, White can never cut — if White pushes one, Black blocks the other.',
    },
    trapMessages: {
      E5: 'Solidly connecting at E5 is heavy and lets White slide underneath at F4. The F4 bamboo joint is far more efficient!',
      E4: 'E4 makes a heavy empty triangle (D5–D4–E4) and lets White cut off F5 at F4!',
    },
    takeaway: 'The bamboo joint (two parallel pairs one space apart) is virtually uncuttable, rich in liberties, and flexible for making eyes.',
  },
  'shape-hane-head': {
    title: 'Hane at the Head of Two Stones',
    goal: 'Play the classic shape move to seize control of the center fight.',
    briefing: 'Two parallel walls march side by side in the center (Black D4–D5 vs White E4–E5). Apply one of Go\'s oldest proverbs to seize the initiative!',
    hints: [
      'Go proverb: "Hane at the head of two stones."',
      'Bend directly over the top of White\'s E5 stone.',
      'Play the hane at E6 first, then protect your cut after White pulls back.',
    ],
    treeMessages: {
      E6: 'Powerful hane at the head of two stones (E6)! White pulls back to F5 — now defend your cut to complete the thick shape.',
      'E6>D6': 'Commanding thickness! Because White is at E5, D6 is not an empty triangle — it forms a rock-solid wall controlling the upper board.',
      'E6>C6': "Light tiger's mouth at C6 defending the cut! Another high-level flexible shape.",
    },
    trapMessages: {
      D6: 'Passively extending at D6 lets White hane at the head of YOUR two stones (E6)! Strike first at E6.',
      F6: 'Too loose! White pushes straight through at E6 and shatters your shape.',
    },
    takeaway: '"Hane at the head of two stones": when two stones stand side by side, bending around the opponent\'s head restricts their liberties and builds outer thickness.',
  },
  'shape-tigers-mouth': {
    title: "Tiger's Mouth Over Empty Triangle",
    goal: 'Connect F5 with light shape while avoiding a heavy empty triangle.',
    briefing: 'White\'s D5–E5 and G5 eye the cutting point at F4 to isolate F5. Find the move that saves the connection while forming an elegant tiger\'s mouth.',
    hints: [
      'Playing E4 makes an empty triangle (D4–E3–E4) AND lets White cut at F4. Form a tiger\'s mouth around E4 instead!',
      'Look at the intersection directly beneath Black\'s F5.',
      "Play F4 to form a textbook tiger's mouth around E4 with D4 and E3!",
    ],
    treeMessages: {
      F4: "Beautiful tiger's mouth! D4, E3, and F4 firmly guard E4 with zero empty triangles, connecting F5 with rich eye potential.",
    },
    trapMessages: {
      E4: 'E4 creates a heavy empty triangle (D4–E3–E4) and lets White slice right through at F4 to cut off F5!',
      F3: 'F3 is too loose — White wedges at F4 to sever your connection.',
    },
    takeaway: "Before playing a move that forms an empty triangle, always check whether a tiger's mouth (hanging connection) is lighter and more flexible.",
  },
  'opening-corners-first': {
    title: 'Corners, Sides, Then Center',
    goal: 'Choose the highest-value opening move on the 13×13 board.',
    briefing: 'White played on the top side (G10) before all corners were claimed. Apply the golden principle of the opening to seize the biggest point on the board!',
    hints: [
      'Corners give you two edges as free walls, making territory with the fewest stones.',
      'Turn your attention to the completely open top-left corner!',
      'Claim the top-left star point (D10) or 3-4 point (C10 / D11).',
    ],
    treeMessages: {
      D10: 'Great whole-board sense! Taking the top-left star point (D10) claims the last golden corner with balanced territory and influence.',
      C10: 'Solid 3-4 corner enclosure (C10)! Secures corner territory while facing the left side.',
      D11: 'Active 3-4 corner move (D11)! Immediately limits White\'s expansion along the top side.',
      C11: 'Direct 3-3 corner claim (C11)! Secures solid corner territory right away.',
    },
    trapMessages: {
      G7: 'Playing tengen (center) so early is inefficient and hands White the huge empty corner at D10!',
      G4: 'Extending on the bottom side is okay, but an open corner (D10) is worth far more!',
    },
    takeaway: 'Opening priority: (1) Empty corners → (2) Corner approaches & enclosures → (3) Side extensions → (4) Center framework.',
  },
  'joseki-sansan': {
    title: 'Modern 3-3 Invasion Joseki',
    goal: 'Respond properly to White\'s 3-3 invasion (R17) under your star point (Q16).',
    briefing: 'In modern Go, the 3-3 invasion appears in almost every game. Don\'t panic trying to kill the corner — block from one side, give White the corner, and build a mighty outer wall!',
    hints: [
      'Block directly adjacent to R17 (at Q17 or R16), choosing which side your wall will face.',
      'Block at Q17 (or symmetrically R16), and keep pressing as White crawls on the 3rd line.',
      'Standard joseki: B Q17 → W R16 → B Q15 → W R15 → B Q14 (or hane R14).',
    ],
    treeMessages: {
      Q17: 'Standard block at Q17! White extends along the right at R16 — keep pressing to seal White inside!',
      'Q17>Q15': 'Solid extension at Q15! White crawls again at R15 — finish your thick wall (Q14 or double hane R14).',
      'Q17>Q15>Q14': 'Classic modern 3-3 joseki complete! White takes corner territory; Black gets a flawless outer wall.',
      'Q17>Q15>R14': 'Active hane at R14! A favorite modern continuation that presses White even lower.',
      R16: 'Standard block at R16! White extends along the top at Q17 — keep pressing to seal White in!',
      'R16>P16': 'Solid block at P16! White crawls to P17 — finish your top-side wall (O16 or hane O17).',
      'R16>P16>O16': 'Classic 3-3 joseki complete! Trading small corner territory for commanding thickness.',
      'R16>P16>O17': 'Sharp hane at O17! Presses White down while building a grand top-side framework.',
    },
    trapMessages: {
      R18: 'Trying to block on the 2nd line (R18) lets White cut out at R16, stranding your Q16 stone outside!',
      S17: 'Blocking on the 2nd line (S17) lets White counter-atari at Q17 and collapse Black\'s shape.',
    },
    takeaway: 'When invaded at 3-3 under a star point, never block on the 2nd line — trade the corner cleanly for thick outer influence.',
  },
  'opening-shimari': {
    title: "Knight's Move Enclosure (Shimari)",
    goal: 'Complete an efficient corner enclosure (shimari) for your 3-4 stone at C4.',
    briefing: 'All four corners are occupied. Your bottom-left stone is at 3-4 (C4), harmonizing with your K4 star point. Use a classic knight\'s-move enclosure to fortify the corner and build a bottom framework!',
    hints: [
      'A shimari extends a knight\'s move from the 3-4 stone onto the 3rd line to lock down the corner.',
      'Look at the 3rd-line knight\'s move to the lower-right of C4, facing K4!',
      'Play E3 (knight\'s move enclosure) to secure the corner and link naturally with K4.',
    ],
    treeMessages: {
      E3: "Standard knight's move enclosure (E3)! Secures ~15 points of corner territory and builds a grand bottom moyo with K4.",
      F3: "Large knight's move enclosure (F3)! Slightly looser but reaches further toward K4 with great spirit.",
      D6: "Knight's move enclosure facing left (D6) is also solid! E3 harmonizes even better with K4 on the bottom.",
    },
    trapMessages: {
      C3: 'C3 is overly concentrated; White easily approaches at F3 and shuts down your entire bottom side!',
      D4: 'Sticking next to your own stone (D4) is inefficient — E3 is just as solid while claiming nearly twice the space.',
    },
    takeaway: "A 3-4 stone paired with a knight's move enclosure is one of the biggest moves in the opening; face it toward another friendly corner to build a natural moyo.",
  },
  'yose-monkey-jump': {
    title: 'Defending the Monkey Jump',
    goal: 'Stop White\'s E1 monkey jump with the tightest endgame tesuji.',
    briefing: 'White just leaped from B2 to E1 with the classic 1st-line "monkey jump" to raid your bottom-right territory. Don\'t passively retreat — use the textbook attachment defense!',
    hints: [
      'Passively blocking at F1 or E2 lets White push into D2 and scoop out extra points. Strike directly under D3!',
      'Attach directly beneath D3 to sever E1\'s link back to B2.',
      'Play D2 to cut off the return! After White crawls back at D1, seal tightly at E2.',
    ],
    treeMessages: {
      D2: 'Textbook D2 monkey-jump defense! White must crawl humbly back at D1 — now seal solidly!',
      'D2>E2': 'Watertight defense! You minimized White\'s reduction while keeping sente follow-up at F1.',
    },
    trapMessages: {
      F1: 'Passively blocking at F1 lets White barge straight into D2 and scoop out several extra points!',
      E2: 'Playing E2 first still lets White push into D2 to connect, losing 3+ endgame points.',
    },
    takeaway: 'Against a 1st-line monkey jump, never block passively in front — cut behind it (D2) to force the opponent to crawl home.',
  },
  'yose-sente-hane': {
    title: '1st-Line Hane & Connect (Sente Yose)',
    goal: 'Play the highest-value endgame sequence on the bottom edge.',
    briefing: 'The boundary is settled down to the 2nd line (Black D2 vs White E2). Endgame games are often won by 1–2 points — don\'t just drop down; squeeze out extra points with a 1st-line hane!',
    hints: [
      'Dropping straight down at D1 leaves 2 points on the table. Boldly hane underneath White\'s E2!',
      'Aim for the 1st-line intersection directly beneath White\'s E2.',
      'Hane on the 1st line at E1! After White blocks at F1, connect calmly at D1.',
    ],
    treeMessages: {
      E1: 'Sharp 1st-line hane at E1! White must block at F1 to stop you from sliding in — now connect safely!',
      'E1>D1': 'Textbook 1st-line hane and connect! This single sequence gains 2 full points over a passive D1 descent.',
    },
    trapMessages: {
      D1: 'Descending passively at D1 lets White block at E1, costing you 2 full endgame points!',
    },
    takeaway: 'Along the edge in endgame, a 1st-line hane-and-connect almost always gains 2 points over a simple descent — and often in sente!',
  },
  'yose-clamp-tesuji': {
    title: '1st-Line Atari Endgame Tesuji',
    goal: 'Exploit White\'s shortage of liberties on the right to carve out extra endgame points.',
    briefing: 'Notice White\'s H6 stone leaning against your H7–G6 wall — it has only two liberties (J6 and H5). Find the crisp 1st-line tesuji to punish White\'s thinness!',
    hints: [
      'Pushing at H5 first lets White block calmly at J6 and save the 1st line. Put H6 in atari from the 1st line first!',
      'Look at the 1st-line intersection directly to the right of H6.',
      'Play J6 in atari! When White connects at H5, slide home at J7.',
    ],
    treeMessages: {
      J6: 'Clever 1st-line atari at J6! White is forced to connect at H5 to save H6 — now connect J6 home!',
      'J6>J7': 'High-level endgame tesuji! Carving out J6–J7–J8 right under White\'s nose gains 4+ extra points!',
    },
    trapMessages: {
      H5: 'Pushing H5 first lets White block safely at J6, protecting J7–J8 and neutralizing the tesuji.',
      J7: 'Descending at J7 is too gentle — White blocks at J6 and seals everything cleanly.',
    },
    takeaway: 'In endgame, always watch for 2nd-line opponent stones with only two liberties — a 1st-line atari tesuji often steals several extra points!',
  },
};

export function getLocalizedCategory(cat) {
  if (currentLang === 'en') {
    const en = CATEGORY_EN[cat.id];
    if (en) return { ...cat, ...en };
  }
  if (currentLang === 'zh-CN') {
    return {
      ...cat,
      name: toSimplified(cat.name),
      jp: toSimplified(cat.jp),
      description: toSimplified(cat.description),
    };
  }
  return cat;
}

export function getLocalizedPuzzle(puzzle) {
  if (currentLang === 'en') {
    const en = PUZZLE_EN[puzzle.id];
    if (en) {
      return {
        ...puzzle,
        title: en.title,
        rank: localizeRank(puzzle.rank),
        goal: en.goal,
        briefing: en.briefing,
        hints: puzzle.hints.map((h, i) => {
          const text = en.hints[i] || (typeof h === 'string' ? h : h.text);
          return typeof h === 'string' ? text : { ...h, text };
        }),
        takeaway: en.takeaway,
        _enTreeMessages: en.treeMessages,
        _enTrapMessages: en.trapMessages,
      };
    }
  }
  if (currentLang === 'zh-CN') {
    return {
      ...puzzle,
      title: toSimplified(puzzle.title),
      rank: toSimplified(puzzle.rank),
      goal: toSimplified(puzzle.goal),
      briefing: toSimplified(puzzle.briefing),
      hints: puzzle.hints.map((h) =>
        typeof h === 'string' ? toSimplified(h) : { ...h, text: toSimplified(h.text) }
      ),
      takeaway: toSimplified(puzzle.takeaway),
    };
  }
  return puzzle;
}

export function getLocalizedBranchMessage(puzzle, pathCoords, fallbackMsg) {
  if (currentLang === 'en') {
    const en = PUZZLE_EN[puzzle.id];
    const key = pathCoords.join('>');
    if (en?.treeMessages?.[key]) return en.treeMessages[key];
  }
  if (currentLang === 'zh-CN') {
    return toSimplified(fallbackMsg);
  }
  return fallbackMsg;
}

export function getLocalizedTrapMessage(puzzle, coord, fallbackMsg) {
  if (currentLang === 'en') {
    const en = PUZZLE_EN[puzzle.id];
    if (en?.trapMessages?.[coord]) return en.trapMessages[coord];
  }
  if (currentLang === 'zh-CN') {
    return toSimplified(fallbackMsg);
  }
  return fallbackMsg;
}

// ============================================================================
// Apply Translations to DOM via data-i18n attributes
// ============================================================================

export function applyDomTranslations(root = document) {
  const htmlLang = currentLang === 'zh-CN' ? 'zh-Hans' : currentLang === 'en' ? 'en' : 'zh-Hant';
  if (document.documentElement) {
    document.documentElement.lang = htmlLang;
  }
  document.title = t('pageTitle');

  root.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n');
    if (key) node.textContent = t(key);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((node) => {
    const key = node.getAttribute('data-i18n-title');
    if (key) node.title = t(key);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    const key = node.getAttribute('data-i18n-placeholder');
    if (key) node.placeholder = t(key);
  });
  root.querySelectorAll('[data-i18n-aria]').forEach((node) => {
    const key = node.getAttribute('data-i18n-aria');
    if (key) node.setAttribute('aria-label', t(key));
  });
}
