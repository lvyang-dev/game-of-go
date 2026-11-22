// ============================================================================
// 實戰道場 — 15 題精選驗證圍棋專題練習（14 級 → 8 級）
// 專為已懂基本規則、想提升實戰棋力的棋友設計
// ============================================================================

import { BLACK, WHITE } from './engine.js';

export const PUZZLE_CATEGORIES = [
  {
    id: 'tesuji',
    name: '實戰手筋',
    jp: '手筋',
    description: '犀利局部戰術：枷吃、倒撲與切斷挖子。',
  },
  {
    id: 'tsumego',
    name: '死活詰碁',
    jp: '死活',
    description: '眼位急所、做活兩眼與聚殺點眼（中手）。',
  },
  {
    id: 'shape',
    name: '棋形效率',
    jp: '棋形',
    description: '竹節、虎口與二子頭必扳，避開凝重空三角。',
  },
  {
    id: 'opening',
    name: '佈局定石',
    jp: '佈局',
    description: '金角銀邊大局觀、締角守角與現代點三三定石。',
  },
  {
    id: 'yose',
    name: '官子收束',
    jp: '官子',
    description: '防禦猴滑、一路先手扳黏與二路氣緊手筋。',
  },
];

export const PUZZLES = [
  // ==========================================================================
  // 1. 實戰手筋
  // ==========================================================================
  {
    id: 'tesuji-net',
    category: 'tesuji',
    title: '枷吃（罩吃）',
    rank: '14 級',
    size: 9,
    playerColor: BLACK,
    goal: '黑先，吃掉白棋 E5 切斷子。',
    briefing:
      '白棋在 G7 與 H5 有引征援軍，直接征子會失敗。別急著緊氣叫吃，試著斜退一步用「枷吃」鬆鬆罩住 E5。',
    setup: {
      black: ['D5', 'E4', 'D6', 'F4'],
      white: ['E5', 'G7', 'H5'],
    },
    hints: [
      '直接叫吃（E6 或 F5）會讓白棋往 G7 或 H5 的援軍衝出。試著往斜上方退一步罩住兩條出路。',
      { text: '觀察 E5 東北側的斜角交叉點。', region: { coord: 'F6', radius: 1 } },
      { text: '下在 F6 枷吃，一次封死白棋所有逃路。', coord: 'F6' },
    ],
    tree: {
      F6: {
        status: 'continue',
        reply: 'E6',
        message: '漂亮的 F6 枷吃！白棋衝出 E6 掙扎——立刻從上方壓住封口！',
        next: {
          E7: {
            status: 'continue',
            reply: 'F5',
            message: '乾淨擋住 E7！白棋只剩 F5 最後掙扎——直接收網提子。',
            next: {
              G5: {
                status: 'solved',
                message: '完美淨吃！白棋三子全部落入枷吃的口袋中。',
              },
            },
          },
        },
      },
    },
    traps: {
      E6: {
        reply: 'F5',
        message: '直接叫吃 E6 失敗：白棋順勢從 F5 衝出，朝 H5 與 G7 的援軍會合。請改用鬆一格的枷吃！',
      },
      F5: {
        reply: 'E6',
        message: '從下方叫吃 F5 會讓白棋由 E6 突圍奔向 G7。往斜角罩住才能同時封鎖兩條逃路。',
      },
    },
    takeaway: '當征子不利（對方有引征子）時，優先檢查「枷吃」——以斜角鬆鬆罩住對方，無論對手往哪邊衝都能淨吃。',
  },

  {
    id: 'tesuji-snapback',
    category: 'tesuji',
    title: '倒撲手筋',
    rank: '13 級',
    size: 9,
    playerColor: BLACK,
    goal: '黑先，吃掉白棋四子（D6–E6–E5–E4）。',
    briefing:
      '白棋四子目前只剩兩口氣（D5 與 D4），且意圖與左邊的 C5 聯絡。利用棄子「撲入」製造倒撲，將白棋一網打盡。',
    setup: {
      black: ['C6', 'D7', 'E7', 'F6', 'F5', 'F4', 'E3', 'D3', 'C4'],
      white: ['D6', 'E6', 'E5', 'E4', 'C5', 'B5', 'B6'],
    },
    hints: [
      '不要從外側叫吃（D4），白棋會直接黏在 D5 連回家。能不能先送一子撲入白棋的連接點？',
      { text: '看準 D6、E5 與 C5 之間的切斷要點。', region: { coord: 'D5', radius: 1 } },
      { text: '果斷撲入 D5！待白棋提子於 D4 後，立刻回提 D5 形成倒撲。', coord: 'D5' },
    ],
    tree: {
      D5: {
        status: 'continue',
        reply: 'D4',
        message: '犀利的 D5 撲入！白棋被迫於 D4 提子——現在看看白棋整串剩幾口氣！',
        next: {
          D5: {
            status: 'solved',
            message: '漂亮倒撲！由於白棋五子只剩一口氣（並非單子打劫），黑棋可立刻再下 D5 全數提光！',
          },
        },
      },
    },
    traps: {
      D4: {
        reply: 'D5',
        message: '從外叫吃 D4 會讓白棋穩穩黏在 D5 與 C5 連成一片，氣數大增。應先撲入切斷點！',
      },
    },
    takeaway: '「倒撲」透過棄掉一子，迫使對手提子後反陷入多子只剩一口氣的絕境；因提回的是多子而非單子，不受打劫限制。',
  },

  {
    id: 'tesuji-wedge',
    category: 'tesuji',
    title: '挖斷緊氣（楔入）',
    rank: '11 級',
    size: 9,
    playerColor: BLACK,
    goal: '黑先，分斷並吃掉白棋兩子（E7–E8）。',
    briefing:
      '白棋左方棋塊（A7–C7）已經活棋，正準備跨過空隙救回 E7–E8。運用犀利的「挖」手筋，趁白棋氣緊將其一舉分斷殲滅。',
    setup: {
      black: ['C6', 'D6', 'E6', 'F7', 'F8', 'E9', 'D9', 'C9'],
      white: ['A7', 'B7', 'C7', 'B8', 'A8', 'A9', 'E7', 'E8'],
    },
    hints: [
      '若先從上邊（D8 或 C8）阻擋，白棋會直接從下方 D7 輕鬆渡過。必須先從兩子中間硬生生「挖」進去！',
      { text: '直接楔入 C7 與 E7 之間的交叉點。', region: { coord: 'D7', radius: 1 } },
      { text: '先在 D7 挖斷叫吃，白棋若在 D8 掙扎連接，立刻由外側 C8 提子！', coord: 'D7' },
    ],
    tree: {
      D7: {
        status: 'continue',
        reply: 'D8',
        message: '精彩的 D7 挖斷！白棋伸出 D8 企圖接回 B8——給予最後一擊！',
        next: {
          C8: {
            status: 'solved',
            message: '妙手提吃！C8 緊掉白棋三子最後一口氣，先提子後算氣，完全合法且漂亮淨吃！',
          },
        },
      },
    },
    traps: {
      D8: {
        reply: 'D7',
        message: '先下 D8 會讓白棋舒舒服服在 D7 連回左方活棋。',
      },
      C8: {
        reply: 'D7',
        message: 'C8 過緩，白棋直接於 D7 聯絡，輕鬆救回 E7–E8。',
      },
    },
    takeaway: '在對手兩子間「挖入」能有效利用對方的氣緊（不入子），讓對手在來得及聯絡前便氣盡被吃。',
  },

  // ==========================================================================
  // 2. 死活詰碁
  // ==========================================================================
  {
    id: 'tsumego-two-eyes',
    category: 'tsumego',
    title: '直三的急所做活',
    rank: '14 級',
    size: 9,
    playerColor: BLACK,
    goal: '黑先，於上邊無條件淨活。',
    briefing:
      '黑棋大龍已被白棋完全包圍，內部僅剩三個一字排開的空點（C9–D9–E9，稱為「直三」）。找出唯一能立刻做出兩隻真眼的急所。',
    setup: {
      black: ['B9', 'B8', 'C8', 'D8', 'E8', 'F8', 'F9'],
      white: ['A9', 'A8', 'B7', 'C7', 'D7', 'E7', 'F7', 'G8', 'G9'],
    },
    hints: [
      '圍棋格言：「敵之要點即我之要點」。',
      { text: '把三個相連空點從正中央一分為二，化成兩隻獨立的眼。', region: { coord: 'D9', radius: 1 } },
      { text: '落子於正中央 D9，即可在 C9 與 E9 形成兩隻真眼淨活。', coord: 'D9' },
    ],
    tree: {
      D9: {
        status: 'solved',
        message: '淨活！D9 將眼位分成 C9 與 E9 兩隻獨立真眼，白棋再也無法殺棋。',
      },
    },
    traps: {
      C9: {
        reply: 'D9',
        message: '下在邊側會被白棋搶先點入急所 D9！之後就算提掉白子，也只剩一隻眼而慘遭聚殺。',
      },
      E9: {
        reply: 'D9',
        message: '下在 E9 等於拱手讓出中央急所 D9，黑棋縮成單眼而死。',
      },
    },
    takeaway: '「直三」是死活最核心的基本棋形：守方先佔中點即活，攻方先點中點即死。',
  },

  {
    id: 'tsumego-nakade',
    category: 'tsumego',
    title: '刀把五點殺（中手）',
    rank: '11 級',
    size: 9,
    playerColor: BLACK,
    goal: '黑先，殺死右上角白棋。',
    briefing:
      '白棋在右上角圍出五目空間，形狀宛如「刀把五」（2×2 方塊加上左側一格 G9）。精準點入唯一的急所（中手），讓白棋無法做出兩眼。',
    setup: {
      white: ['F9', 'F8', 'G8', 'G7', 'H7', 'J7'],
      black: ['E9', 'E8', 'E7', 'F7', 'F6', 'G6', 'H6', 'J6'],
    },
    hints: [
      '找出那個同時緊鄰「刀柄」（G9）與 2×2 方塊的交叉點。',
      { text: '看準上邊一路、緊挨著 G9 右側的點位。', region: { coord: 'H9', radius: 1 } },
      { text: '先點 H9！白棋若在 H8 抵抗，再補一手 J9 即可徹底淨殺。', coord: 'H9' },
    ],
    tree: {
      H9: {
        status: 'continue',
        reply: 'H8',
        message: '正中紅心！H9 正是刀把五的唯一急所。白棋下 H8 試圖隔出 G9 一眼——阻止它做第二眼！',
        next: {
          J9: {
            status: 'solved',
            message: '白棋淨死！即使白棋之後提掉黑棋兩子，剩下的兩格空間也只有一隻眼。',
          },
        },
      },
    },
    traps: {
      H8: {
        reply: 'H9',
        message: '白棋開心地搶佔急所 H9！如此 G9 成為一隻真眼，右下 J8/J9 又輕鬆做出第二眼，白活！',
      },
      J9: {
        reply: 'H9',
        message: 'J9 錯過急所，白棋佔領 H9 後，G9 與 H8/J8 輕鬆兩眼做活。',
      },
      G9: {
        reply: 'H8',
        message: 'G9 過於淺薄，白棋在 H8 一守便輕鬆活棋。',
      },
    },
    takeaway: '直三、曲四、刀把五、葡萄六都有唯一的中手急所——「刀把五」的急所就在刀柄與方塊的交界處。',
  },

  {
    id: 'tsumego-2-1-point',
    category: 'tsumego',
    title: '角部二之一急所',
    rank: '9 級',
    size: 9,
    playerColor: BLACK,
    goal: '黑先，擊殺左上角白棋。',
    briefing:
      '白棋在 A7 已有確定的第一隻眼，正準備在上邊（A9–B9–C9）做出第二眼。善用黑棋 D9 的外援，以著名的「二之一」急所破掉白棋眼位。',
    setup: {
      white: ['A6', 'B6', 'B7', 'A8', 'B8', 'C8', 'D8'],
      black: ['A5', 'B5', 'C6', 'C7', 'D7', 'E8', 'E9', 'D9'],
    },
    hints: [
      '從外邊 C9 直接縮小，會讓白棋在 B9 擋住、於 A9 做出第二隻真眼。直接空降點入急所！',
      { text: '觀察左上角「二之一」（一路第二格）的經典點位。', region: { coord: 'B9', radius: 1 } },
      { text: '點入 B9！白棋不能下 C9（自殺禁著），若白棋下 A9 掙扎，黑棋順勢黏在 C9 渡回即可！', coord: 'B9' },
    ],
    tree: {
      B9: {
        status: 'continue',
        reply: 'A9',
        message: '經典的二之一點殺（B9）！白棋無法下 C9（禁著點），只能下 A9——快將黑子接回！',
        next: {
          C9: {
            status: 'solved',
            message: '淨殺成功！黑棋於 C9 穩穩接回 D9，上邊眼位全滅，白棋僅剩 A7 單眼而死。',
          },
        },
      },
    },
    traps: {
      C9: {
        reply: 'B9',
        message: '從外側 C9 逼近過緩，白棋在 B9 一擋，A9 立刻成為第二隻真眼，白棋淨活！',
      },
      A9: {
        reply: 'B9',
        message: '先撲 A9 會被白棋在 B9 提掉，同時在 A9 形成第二隻眼做活。',
      },
    },
    takeaway: '「角部二之一」是死活題中出現頻率最高的急所之一；攻殺角部時，務必先試算直接點在二之一的效果！',
  },

  // ==========================================================================
  // 3. 棋形效率
  // ==========================================================================
  {
    id: 'shape-bamboo',
    category: 'shape',
    title: '竹節連接（雙黏）',
    rank: '13 級',
    size: 9,
    playerColor: BLACK,
    goal: '選出最堅實且最具效率的棋形連接黑棋。',
    briefing:
      '白棋從上下兩側（E6 與 E3）刺入窺視，企圖切斷 F5 與您 D4–D5 的聯繫。別走出凝重的愚形，築起圍棋中最強韌的聯絡棋形！',
    setup: {
      black: ['D5', 'D4', 'F5', 'C4'],
      white: ['E6', 'E3', 'G5', 'C6'],
    },
    hints: [
      '與其填在中間 E5 而讓 F4 門戶大開，不如在右側與 D4–D5 成雙成對呼應。',
      { text: '在 F5 正下方補上一子，形成 2×3 的平行雙柱結構。', region: { coord: 'F4', radius: 1 } },
      { text: '落子 F4 構成牢不可破的「竹節」（雙黏）。', coord: 'F4' },
    ],
    tree: {
      F4: {
        status: 'solved',
        message: '教科書般的竹節好形！雖然 E5 與 E4 看似留空，但白棋永遠無法切斷——白衝其一，黑擋另一即可安然聯絡。',
      },
    },
    traps: {
      E5: {
        reply: 'F4',
        message: '實黏 E5 不但顯得凝重，更讓白棋順勢從 F4 鑽入下方。改走 F4 竹節效率高得多！',
      },
      E4: {
        reply: 'F4',
        message: 'E4 形成笨重的空三角（D5–D4–E4），反而被白棋下在 F4 切斷孤立 F5！',
      },
    },
    takeaway: '「竹節」（兩對平行棋子相隔一路）幾乎無法被切斷，且氣長、彈性大、極容易做眼，是高段棋手最愛的好形。',
  },

  {
    id: 'shape-hane-head',
    category: 'shape',
    title: '二子頭必扳',
    rank: '11 級',
    size: 9,
    playerColor: BLACK,
    goal: '下出經典棋形要點，奪取中腹攻防主導權。',
    briefing:
      '中腹雙方兩列棋子並肩推進（黑 D4–D5 對白 E4–E5）。運用圍棋流傳千年的棋形格言，一口氣壓制對手並掌握主動權！',
    setup: {
      black: ['D4', 'D5', 'C3'],
      white: ['E4', 'E5', 'F3'],
    },
    hints: [
      '圍棋格言：「二子頭必扳」。',
      { text: '直接扳在白棋 E5 的頭頂上。', region: { coord: 'E6', radius: 1 } },
      { text: '先在 E6 扳頭，白棋退讓後再穩健補好自身斷點。', coord: 'E6' },
    ],
    tree: {
      E6: {
        status: 'continue',
        reply: 'F5',
        message: '強勁的 E6 二子頭扳！白棋被迫退在 F5——現在補好自己的斷點完成厚形。',
        next: {
          D6: {
            status: 'solved',
            message: '厚實霸氣的好形！注意因白子在 E5，D6 並非空三角，而是紮實的厚壁，黑棋已牢牢掌控上半盤。',
          },
          C6: {
            status: 'solved',
            message: '輕靈的 C6 虎口護斷！同樣是高水準的靈活好形。',
          },
        },
      },
    },
    traps: {
      D6: {
        reply: 'E6',
        message: '消極在 D6 長出，反而被白棋搶先扳在您的二子頭（E6）！務必先發制人搶佔 E6。',
      },
      F6: {
        reply: 'E6',
        message: '下得太鬆！白棋直接從 E6 衝出，反將您的棋形衝得支離破碎。',
      },
    },
    takeaway: '「二子頭必扳」：兩顆棋子並排時，搶先扳住對方二子頭能瞬間壓縮對方氣數，同時築起厚實的外勢。',
  },

  {
    id: 'shape-tigers-mouth',
    category: 'shape',
    title: '虎口護斷勝於空三角',
    rank: '10 級',
    size: 9,
    playerColor: BLACK,
    goal: '以輕靈棋形聯絡 F5，避免走出笨重的空三角。',
    briefing:
      '白棋在 D5–E5 與 G5 虎視眈眈，隨時想從 F4 切斷您的 F5。找出既能救回聯絡、又能形成優美虎口的最佳選點。',
    setup: {
      black: ['D4', 'E3', 'F5'],
      white: ['D5', 'E5', 'G5'],
    },
    hints: [
      '若下 E4，既會形成愚形空三角（D4–E3–E4），又會被白棋下在 F4 切斷 F5。試著圍繞 E4 構成「虎口」！',
      { text: '觀察黑棋 F5 正下方的交叉點。', region: { coord: 'F4', radius: 1 } },
      { text: '下在 F4，與 D4、E3 圍繞 E4 構成教科書般的虎口（掛黏）！', coord: 'F4' },
    ],
    tree: {
      F4: {
        status: 'solved',
        message: '極美的虎口好形（掛黏）！D4、E3、F4 三子嚴密守護 E4，零空三角，同時連回 F5 並自帶豐富眼形。',
      },
    },
    traps: {
      E4: {
        reply: 'F4',
        message: 'E4 不但走出凝重的空三角（D4–E3–E4），更讓白棋一刀切在 F4，把 F5 活活分斷！',
      },
      F3: {
        reply: 'F4',
        message: 'F3 過鬆，白棋直接楔入 F4 切斷您的聯絡。',
      },
    },
    takeaway: '落子前若發現會形成「空三角」，先停下來檢查改用「虎口（掛黏）」是否更輕靈、更有眼位彈性。',
  },

  // ==========================================================================
  // 4. 佈局定石
  // ==========================================================================
  {
    id: 'opening-corners-first',
    category: 'opening',
    title: '金角銀邊草肚皮',
    rank: '14 級',
    size: 13,
    playerColor: BLACK,
    goal: '在 13 路棋盤上選出最具大局價值的開局大場。',
    briefing:
      '白棋在角部尚未佔完時，就過早拆邊到上邊（G10）。請運用佈局最核心的黃金原則，搶佔盤面最大之處！',
    setup: {
      black: ['D4', 'K4'],
      white: ['K10', 'G10'],
    },
    hints: [
      '角部有兩條邊線當免費圍牆，用最少棋子就能圍最多實地。',
      { text: '將目光轉向完全空曠的左上角！', region: { coord: 'D10', radius: 1 } },
      { text: '搶佔左上空角的星位（D10）或小目（C10／D11）。', coord: 'D10' },
    ],
    tree: {
      D10: {
        status: 'solved',
        message: '大局觀滿分！搶佔左上星位（D10）兼顧實地與外勢，把握住最後一個黃金空角。',
      },
      C10: {
        status: 'solved',
        message: '紮實的小目佔角（C10）！穩取角部實地並朝左邊發展。',
      },
      D11: {
        status: 'solved',
        message: '積極的小目佔角（D11）！同時直接牽制白棋上邊的發展空間。',
      },
      C11: {
        status: 'solved',
        message: '直接點三三佔角（C11）！立刻將角部實地收入囊中。',
      },
    },
    traps: {
      G7: {
        reply: 'D10',
        message: '開局過早落子天元（中腹）效率偏低，讓白棋白白撿走左上角 D10 的巨大實地！',
      },
      G4: {
        reply: 'D10',
        message: '下邊拆邊雖不算差，但空角（D10）的價值遠大於邊上！',
      },
    },
    takeaway: '佈局優先順序：（一）搶佔空角 →（二）掛角與締角（守角）→（三）邊上拆邊 →（四）經營中腹。',
  },

  {
    id: 'joseki-sansan',
    category: 'opening',
    title: '現代點三三定石',
    rank: '10 級',
    size: 19,
    viewport: { x0: 10, y0: 0, x1: 18, y1: 8 },
    playerColor: BLACK,
    goal: '正確應對白棋在您星位（Q16）下的點三三入侵（R17）。',
    briefing:
      '現代 AI 時代的圍棋中，星位下「點三三」幾乎每盤都會遇到。千萬別驚慌想去吃死角部——果斷從一側擋住，大方把角讓給白棋，換取銅牆鐵壁般的外勢！',
    setup: {
      black: ['Q16'],
      white: ['R17'],
    },
    hints: [
      '直接緊貼 R17 從一側擋住（Q17 或 R16），決定外勢面向哪條邊。',
      { text: '先於 Q17（或對稱的 R16）擋住，白棋沿三路爬時持續壓迫築牆。', region: { coord: 'Q17', radius: 1 } },
      { text: '標準定石次序：黑 Q17 → 白 R16 → 黑 Q15 → 白 R15 → 黑 Q14（或扳 R14）。', coord: 'Q17' },
    ],
    tree: {
      Q17: {
        status: 'continue',
        reply: 'R16',
        message: '標準擋住 Q17！白棋沿右邊長出 R16——繼續壓迫把白棋封在角裡！',
        next: {
          Q15: {
            status: 'continue',
            reply: 'R15',
            message: '紮實長擋 Q15！白棋再爬一手 R15——完成您的厚實外勢（長 Q14 或連扳 R14）。',
            next: {
              Q14: {
                status: 'solved',
                message: '經典現代點三三定石完成！白得角地、黑得無瑕厚勢，雙方各得其所。',
              },
              R14: {
                status: 'solved',
                message: '積極的 R14 連扳！現代高手十分喜愛的進取變化，將白棋壓得更低。',
              },
            },
          },
        },
      },
      R16: {
        status: 'continue',
        reply: 'Q17',
        message: '標準擋住 R16！白棋沿上邊長出 Q17——繼續壓迫封鎖！',
        next: {
          P16: {
            status: 'continue',
            reply: 'P17',
            message: '紮實擋住 P16！白棋再長 P17——完成上方的厚實外勢（O16 或扳 O17）。',
            next: {
              O16: {
                status: 'solved',
                message: '經典點三三定石完成！以小角實地換取雄厚外勢，全局步調極佳。',
              },
              O17: {
                status: 'solved',
                message: '犀利的 O17 連扳！既緊壓白棋又為上方築起宏偉模樣。',
              },
            },
          },
        },
      },
    },
    traps: {
      R18: {
        reply: 'R16',
        message: '企圖從二路（R18）硬擋保角會被白棋於 R16 切斷衝出，導致您的 Q16 孤零零飄在外面！',
      },
      S17: {
        reply: 'Q17',
        message: '二路擋住（S17）讓白棋從 Q17 輕鬆反打衝出，黑棋棋形徹底崩潰。',
      },
    },
    takeaway: '星位被點三三時，切忌在二路硬擋想守角——乾脆讓角取外勢，形成「實地對厚勢」的均衡交易。',
  },

  {
    id: 'opening-shimari',
    category: 'opening',
    title: '小飛守角（締角）',
    rank: '9 級',
    size: 13,
    playerColor: BLACK,
    goal: '為左下角的小目（C4）補上一手高效率的「締角」。',
    briefing:
      '四個角都已被雙方佔領。您左下角的棋子落在小目（C4），且與右下星位 K4 遙相呼應。請用經典的「小飛締角」把左下角化為鐵桶陣地，同時在下邊張開大模樣！',
    setup: {
      black: ['C4', 'K4'],
      white: ['D10', 'K10'],
    },
    hints: [
      '「締角」是由小目往外走一手小飛（日字步）在三路上，把角部完全圍實。',
      { text: '看準 C4 右下方三路、朝向 K4 呼應的飛位！', region: { coord: 'E3', radius: 1 } },
      { text: '下在 E3（小飛守角），既鞏固角地又與 K4 連成宏大的下邊陣勢。', coord: 'E3' },
    ],
    tree: {
      E3: {
        status: 'solved',
        message: '標準小飛締角（E3）！一口氣確保約 15 目堅實角地，並與 K4 形成絕佳的下邊大模樣。',
      },
      F3: {
        status: 'solved',
        message: '大飛締角（F3）！略微寬鬆但延伸更遠，與 K4 的呼應極具氣勢。',
      },
      D6: {
        status: 'solved',
        message: '朝左邊發展的小飛締角（D6）同樣穩健！若想配合 K4 經營下邊，E3 會更加協調。',
      },
    },
    traps: {
      C3: {
        reply: 'F3',
        message: 'C3 貼得太近屬於「重複凝形」，白棋輕鬆在 F3 掛角便限制住您的整個下邊！',
      },
      D4: {
        reply: 'E3',
        message: '緊黏自己棋子（D4）效率太低——改用小飛（E3）一樣穩固，卻多圍了將近一倍空間。',
      },
    },
    takeaway: '小目配「小飛締角」是佈局中價值最高的大場之一；若讓締角方向朝向己方另一角，更能自然張開大模樣。',
  },

  // ==========================================================================
  // 5. 官子收束
  // ==========================================================================
  {
    id: 'yose-monkey-jump',
    category: 'yose',
    title: '防禦猴滑官子',
    rank: '11 級',
    size: 9,
    playerColor: BLACK,
    goal: '以最緊湊的官子手筋擋住白棋 E1 的「猴滑」。',
    briefing:
      '白棋剛從 B2 飛出經典的一路大飛「猴滑」（E1），企圖大幅搜刮您的右下角實地。別只會退縮阻擋，使出教科書級的防禦靠壓手筋！',
    setup: {
      white: ['A3', 'B3', 'C3', 'B2', 'E1', 'D4', 'E4', 'F4', 'G4', 'H4', 'J4'],
      black: ['D3', 'E3', 'F3', 'G3', 'H3', 'J3', 'F2'],
    },
    hints: [
      '若消極在 F1 或 E2 阻擋，白棋反而能鑽入 D2 多刮走好幾目。試著在 D3 正下方迎頭痛擊！',
      { text: '緊靠 D3 正下方切斷 E1 與 B2 的歸路。', region: { coord: 'D2', radius: 1 } },
      { text: '下在 D2 擋斷！白棋被迫於 D1 爬回後，再從 E2 嚴密封鎖。', coord: 'D2' },
    ],
    tree: {
      D2: {
        status: 'continue',
        reply: 'D1',
        message: '教科書級的 D2 猴滑防禦！白棋只好委屈爬回 D1 聯絡——立刻補厚封死！',
        next: {
          E2: {
            status: 'solved',
            message: '滴水不漏的防守！您把白棋的侵消壓縮到最小限度，並保留了先手收束 F1 的餘味。',
          },
        },
      },
    },
    traps: {
      F1: {
        reply: 'D2',
        message: '消極擋在 F1 會讓白棋長驅直入 D2，把您的下邊實地活生生刮掉好幾目！',
      },
      E2: {
        reply: 'D2',
        message: '先下 E2 仍讓白棋從 D2 輕鬆鑽入聯絡，官子白白損失 3 目以上。',
      },
    },
    takeaway: '面對對手一路「猴滑」侵消時，切忌在前方消極擋住——應從其背後（D2）靠斷歸路，逼對手老實爬回家！',
  },

  {
    id: 'yose-sente-hane',
    category: 'yose',
    title: '一路扳黏（先手官子）',
    rank: '10 級',
    size: 9,
    playerColor: BLACK,
    goal: '在下邊收出目數最大的官子次序。',
    briefing:
      '黑白雙方的邊界已定型至二路（黑 D2 對白 E2）。官子勝負往往就在一兩目之間，別下保守的立下——用一路扳黏擠出最大利益！',
    setup: {
      black: ['D5', 'D4', 'D3', 'D2', 'C2', 'B2'],
      white: ['E5', 'E4', 'E3', 'E2', 'F2', 'G2'],
    },
    hints: [
      '直接立在 D1 會白白少賺 2 目實地。大膽扳到白棋 E2 腳下！',
      { text: '瞄準白棋 E2 正下方的一路交叉點。', region: { coord: 'E1', radius: 1 } },
      { text: '一路扳在 E1！白棋被迫在 F1 擋住後，黑棋再從容黏在 D1。', coord: 'E1' },
    ],
    tree: {
      E1: {
        status: 'continue',
        reply: 'F1',
        message: '犀利的 E1 一路扳！白棋必須擋在 F1 防止您鑽入——現在安心補黏！',
        next: {
          D1: {
            status: 'solved',
            message: '標準一路扳黏！光這一處就比消極立在 D1 多賺整整 2 目！',
          },
        },
      },
    },
    traps: {
      D1: {
        reply: 'E1',
        message: '保守立在 D1 讓白棋輕鬆擋在 E1，這一手官子就平白少收了 2 目！',
      },
    },
    takeaway: '邊線收官時，「一路扳黏」幾乎永遠比單純「立下」多賺 2 目，而且常常能以先手收完！',
  },

  {
    id: 'yose-clamp-tesuji',
    category: 'yose',
    title: '一路叫吃官子手筋',
    rank: '8 級',
    size: 9,
    playerColor: BLACK,
    goal: '利用右邊白子氣緊的弱點，硬生生刮出額外官子目數。',
    briefing:
      '仔細觀察白棋 H6 緊貼著您的 H7–G6 厚壁，目前只剩兩口氣（J6 與 H5）。找出一記俐落的一路手筋，懲罰白棋的薄味！',
    setup: {
      black: ['G8', 'H8', 'G7', 'H7', 'G6', 'G5', 'G4', 'G3'],
      white: ['H6', 'H4', 'H3', 'H2', 'G2'],
    },
    hints: [
      '先衝 H5 會讓白棋冷靜擋在 J6 保住整條一路。反過來先從一路直接叫吃 H6！',
      { text: '看準緊挨著 H6 右側的一路交叉點。', region: { coord: 'J6', radius: 1 } },
      { text: '直接下在 J6 叫吃！白棋被迫黏回 H5 時，黑棋順勢於 J7 連回家。', coord: 'J6' },
    ],
    tree: {
      J6: {
        status: 'continue',
        reply: 'H5',
        message: '精妙的 J6 一路叫吃！白棋為救 H6 被迫黏在 H5——立刻把 J6 接回家！',
        next: {
          J7: {
            status: 'solved',
            message: '高水準官子手筋！硬是在白棋眼皮底下剜出 J6–J7–J8，比普通衝擋足足多賺 4 目以上！',
          },
        },
      },
    },
    traps: {
      H5: {
        reply: 'J6',
        message: '先衝 H5 會讓白棋安穩擋在 J6，不但保住 J7–J8，也完全化解了一路手筋。',
      },
      J7: {
        reply: 'J6',
        message: 'J7 立下過於溫柔，白棋在 J6 一擋就守得密不透風。',
      },
    },
    takeaway: '官子階段要特別留意對手二路上「只剩兩口氣」的孤子——往往藏著一路叫吃的妙手，能瞬間多賺好幾目！',
  },
];
