"use strict";
(() => {
  // ============================================================
  //  埋蔵金ディガー  -  dig deep, fight, loot, escape.
  // ============================================================

  const COLS = 7;
  const CAMP_INTERVAL = 8; // 脱出ポイント every N floors
  const BOSS_INTERVAL = 10; // ボス出現の間隔（脱出ポイント階とは重ねない）
  const SAVE_KEY = "buriedtreasure_save";
  const RUN_KEY = "buriedtreasure_run"; // 中断データ

  // ---- DOM ----
  const $ = (id) => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d");

  const el = {
    hpBar: $("hp-bar"), hpText: $("hp-text"),
    gold: $("gold-text"), depth: $("depth-text"), weaponIcon: $("weapon-icon"), armorIcon: $("armor-icon"), bank: $("bank-text"),
    weaponPlus: $("weapon-plus"), armorPlus: $("armor-plus"),
    ovTitle: $("ov-title"), bestTitle: $("best-title"), deepestTitle: $("deepest-title"), rankTitle: $("rank-title"),
    btnStart: $("btn-start"), btnReset: $("btn-reset"), btnDex: $("btn-dex"),
    btnResume: $("btn-resume"), resumeFloor: $("resume-floor"), btnSuspend: $("btn-suspend"), btnWarp: $("btn-warp"),
    ovWarp: $("ov-warp"), warpList: $("warp-list"), btnWarpClose: $("btn-warp-close"),
    ovDex: $("ov-dex"), dexGrid: $("dex-grid"), dexCount: $("dex-count"), btnDexClose: $("btn-dex-close"),
    rsRank: $("rs-rank"), rsNewtitle: $("rs-newtitle"), rsNewtitleName: $("rs-newtitle-name"),
    ovCombat: $("ov-combat"), enemyEmoji: $("enemy-emoji"), enemyName: $("enemy-name"),
    enemyHpBar: $("enemy-hp-bar"), enemyHpText: $("enemy-hp-text"), combatLog: $("combat-log"), combatPets: $("combat-pets"),
    btnAttack: $("btn-attack"), btnFlee: $("btn-flee"),
    ovCamp: $("ov-camp"), campSub: $("camp-sub"), shop: $("shop"), awakenNotice: $("awaken-notice"),
    btnEscape: $("btn-escape"), btnContinue: $("btn-continue"),
    bankBanked: $("bank-banked"), bankCarry: $("bank-carry"), bankWdAvail: $("bank-wd-avail"),
    depAmt: $("dep-amt"), btnDeposit: $("btn-deposit"),
    wdAmt: $("wd-amt"), btnWithdraw: $("btn-withdraw"),
    ovResult: $("ov-result"), resultTitle: $("result-title"), resultEmoji: $("result-emoji"),
    rsDepth: $("rs-depth"), rsScore: $("rs-score"), rsBest: $("rs-best"), btnRetry: $("btn-retry"), btnHome: $("btn-home"),
    rsLostRow: $("rs-lost-row"), rsLost: $("rs-lost"),
  };

  // ---- Weapons ----
  const WEAPONS = [
    { name: "こん棒",        emoji: "🏏", power: 5,  cost: 0 },
    { name: "銅の剣",        emoji: "🗡️", power: 10, cost: 90 },
    { name: "鉄の剣",        emoji: "⚔️", power: 17, cost: 260 },
    { name: "鋼の戦斧",      emoji: "🪓", power: 27, cost: 620 },
    { name: "ミスリルブレード", emoji: "🔱", power: 42, cost: 1500 },
    { name: "ドラゴンソード",  emoji: "🗡️", power: 64, cost: 3600 },
    { name: "エクスカリバー",  emoji: "⚜️", power: 98, cost: 8500 },
    { name: "ホーリーランス",   emoji: "🔆", power: 140, cost: 18000 },
    { name: "ゴッドアクス",     emoji: "⚡", power: 195, cost: 38000 },
    { name: "天空の剣",        emoji: "🌟", power: 270, cost: 80000 },
    // ボス専用ドロップ武器（店では買えない）
    { name: "獣王の牙",     emoji: "🦷", power: 150, cost: 0, boss: true },
    { name: "覇王の剣",     emoji: "🗡️", power: 240, cost: 0, boss: true },
    { name: "滅びの竜剣",   emoji: "🐉", power: 360, cost: 0, boss: true },
  ];
  const BOSS_WEAPON_BASE = 10; // WEAPONS内のボス武器の開始index（獣王の牙）

  // ---- Armor (ダメージ軽減) ----
  const ARMOR = [
    { name: "はだ着",         emoji: "👕", def: 0,  cost: 0 },
    { name: "革のよろい",     emoji: "🧥", def: 2,  cost: 70 },
    { name: "鎖かたびら",     emoji: "⛓️", def: 4,  cost: 200 },
    { name: "鉄のよろい",     emoji: "🛡️", def: 7,  cost: 480 },
    { name: "ハガネのよろい", emoji: "🪖", def: 11, cost: 1100 },
    { name: "ミスリルメイル", emoji: "🦺", def: 16, cost: 2600 },
    { name: "竜鱗のよろい",   emoji: "🐲", def: 23, cost: 6000 },
    { name: "神々のよろい",   emoji: "✨", def: 32, cost: 14000 },
    { name: "聖なる法衣",     emoji: "🥋", def: 44, cost: 32000 },
  ];

  // ---- 覚醒の特殊効果 ----
  const EFFECTS = {
    instakill: { name: "即死", emoji: "⚡", desc: "8%の確率で敵を即死させる" },
    crit:      { name: "会心", emoji: "✨", desc: "20%の確率でダメージ2倍" },
    lifesteal: { name: "吸収", emoji: "💞", desc: "攻撃するたびにHP回復" },
    regen:     { name: "再生", emoji: "🌿", desc: "1歩進むたびにHP回復" },
    goldx2:    { name: "金運", emoji: "💰", desc: "敵を倒した報酬が2倍" },
    burn:      { name: "火傷", emoji: "🔥", desc: "敵の攻撃後にダメージを与え続ける" },
    freeze:    { name: "凍結", emoji: "❄️", desc: "一定確率で敵を数ターン凍結させる" },
    revive:    { name: "生命の神秘", emoji: "💚", desc: "力尽きても一度だけ復活する" },
  };
  const EFFECT_KEYS = Object.keys(EFFECTS);

  // ---- 防具の覚醒効果 ----
  const ARMOR_EFFECTS = {
    reflect:  { name: "反射", emoji: "🪞", desc: "受けたダメージの一部を敵に返す" },
    evade:    { name: "回避", emoji: "💨", desc: "20%の確率でダメージを無効化" },
    ironwall: { name: "鉄壁", emoji: "🧱", desc: "被ダメージをさらに4割軽減" },
    blessing: { name: "加護", emoji: "😇", desc: "敵の攻撃のたびHP回復" },
  };
  const ARMOR_EFFECT_KEYS = Object.keys(ARMOR_EFFECTS);

  // ---- ボス ----
  const BOSS_TIERS = [
    { until: 20, list: [["がんせき魔神", "🪨"], ["マッシュ大王", "🍄"]] },
    { until: 40, list: [["だいりゅう", "🐲"], ["ティラノ", "🦖"]] },
    { until: Infinity, list: [["あんこくりゅう", "🐉"], ["ベヒーモス", "🦏"]] },
  ];
  function bossWeaponIndex(depth) {
    if (depth < 20) return BOSS_WEAPON_BASE;     // 獣王の牙
    if (depth < 40) return BOSS_WEAPON_BASE + 1; // 覇王の剣
    return BOSS_WEAPON_BASE + 2;                 // 滅びの竜剣
  }

  // ---- お供（なかま）：戦闘で一緒に攻撃／支援する ----
  // power=追加攻撃, heal=毎攻撃の回復, buff=自分の攻撃倍率, guard=戦闘ごと1回みがわり
  const COMPANIONS = [
    { name: "こいぬ",       emoji: "🐶", power: 5,  cost: 300,   desc: "攻撃 +5" },
    { name: "いやしねこ",   emoji: "🐱", power: 0,  cost: 800,   heal: 4,    desc: "攻撃のたびHP +4" },
    { name: "たか",         emoji: "🦅", power: 14, cost: 1800,  desc: "攻撃 +14" },
    { name: "かぜおおかみ", emoji: "🐺", power: 6,  cost: 4200,  buff: 0.2,  desc: "攻撃 +6・自分の攻撃力 +20%" },
    { name: "まもりぐま",   emoji: "🐻", power: 12, cost: 9000,  guard: true, desc: "攻撃 +12・戦闘ごと1回みがわり" },
    { name: "りゅうの子",   emoji: "🐲", power: 45, cost: 21000, heal: 3,    desc: "攻撃 +45・攻撃のたびHP +3" },
  ];

  // ---- Enemy pools by depth tier (やさしい見た目のマイルドな魔物) ----
  const ENEMY_TIERS = [
    { until: 8,  list: [["スライム","🟢"],["ぷちうさぎ","🐰"],["おおねずみ","🐭"],["ひよこどり","🐤"]] },
    { until: 16, list: [["スライムベス","🔵"],["かえる兵","🐸"],["こねこマージ","🐱"],["ことり","🐦"]] },
    { until: 28, list: [["おばけ","👻"],["きつねび","🦊"],["いわトカゲ","🦎"],["どうくつコウモリ","🦇"]] },
    { until: 44, list: [["ゴーレム","🤖"],["くまナイト","🐻"],["ふくろう卿","🦉"],["ぶたメイジ","🐷"]] },
    { until: 64, list: [["こりゅう","🐲"],["ゆきだるま","⛄"],["かぼちゃ魔人","🎃"],["インベーダー","👾"]] },
    { until: Infinity, list: [["りゅうおう","🐉"],["まおうさま","🦹"],["ユニコーン","🦄"],["ぬし","🐳"],
                        ["きょうりゅう","🦕"],["だいまじん","👹"],["かいおう","🐋"],
                        ["だいあくま","😈"],["じごくの使い","👿"],["てんぐ大将","👺"],["トロール","🧌"],
                        ["ランプの魔神","🧞"],["だいまどう","🧙"],["どくろ王","💀"],["いし神像","🗿"]] },
  ];

  // ---- 魔境バイオーム(B200+)の層ごとの専用敵（BIOMESと並び順を対応） ----
  const BIOME_ENEMIES = [
    // 🌿 みどりの楽園
    [["マンドラゴラ","🌱"],["どくチョウ","🦋"],["かぶとオーガ","🪲"],["サボテンマン","🌵"],["フラワーレイス","🌹"]],
    // ☁️ あおぞらの底
    [["てんしどり","🦢"],["ハーピー","🦜"],["くじゃく将","🦚"],["フラミンゴ兵","🦩"],["らいちょう","🐓"]],
    // 🔮 むらさきの霧
    [["ファントム","🦠"],["うずまきのぬし","🌀"],["しんかいイカ","🦑"],["エイリアン","👽"],["まようピエロ","🤡"]],
    // 🌟 こがねの花園
    [["おうごんアリ","🐜"],["ひまわり魔","🌻"],["こがねバッタ","🦗"],["はなのせい","🌼"],["つぼマミック","🏺"]],
    // 🔥 あかい奈落
    [["マグマゴーレム","🌋"],["ボムへい","🧨"],["サラマンダー","🦎"],["かえんバード","🦃"]],
    // ✨ ほしぞらの間
    [["せいざのぬし","🪐"],["つきのこ","🌙"],["ながれぼし","🌠"],["スターラビ","⭐"],["UFOへい","🛸"]],
  ];

  // ---- Tile types ----
  // dirt, empty, rock, gold, gem, heart, enemy, surface
  function pickEnemy(depth) {
    const b = biomeFor(depth);
    const list = b ? BIOME_ENEMIES[BIOMES.indexOf(b)] : ENEMY_TIERS.find((t) => depth < t.until).list;
    const e = list[(Math.random() * list.length) | 0];
    return { name: e[0], emoji: e[1] };
  }

  // ============================================================
  //  State
  // ============================================================
  let state = "title"; // title | explore | combat | camp | result
  let rows = {};       // rowIndex -> [tiles]
  let player = null;
  let combat = null;
  let campOpenedAt = -1;
  let lastBiomeName = null;
  let pendingMove = null;
  let profile = loadProfile();

  // ---- persistent profile ----
  // お金(貯金)は常に持ち越し。装備は「脱出（クリア）」したときだけ持ち越す。図鑑は常に蓄積。
  function baseGear() {
    return { weapon: 0, owned: [true], armor: 0, ownedArmor: [true], maxHp: 30,
             weaponPlus: [], armorPlus: [], awaken: {}, armorAwaken: {}, efx: {}, comp: [], bossPow: {} };
  }
  function defaultProfile() {
    return Object.assign({ bank: 0, deepest: 0, dex: [] }, baseGear());
  }
  function loadProfile() {
    try {
      const p = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!p || typeof p !== "object") return defaultProfile();
      const d = defaultProfile();
      return {
        bank: p.bank | 0,
        deepest: p.deepest | 0,
        dex: Array.isArray(p.dex) ? p.dex : [],
        weapon: p.weapon | 0,
        owned: Array.isArray(p.owned) ? p.owned : d.owned,
        armor: p.armor | 0,
        ownedArmor: Array.isArray(p.ownedArmor) ? p.ownedArmor : d.ownedArmor,
        maxHp: p.maxHp ? (p.maxHp | 0) : d.maxHp,
        weaponPlus: Array.isArray(p.weaponPlus) ? p.weaponPlus : [],
        armorPlus: Array.isArray(p.armorPlus) ? p.armorPlus : [],
        awaken: (p.awaken && typeof p.awaken === "object") ? p.awaken : {},
        armorAwaken: (p.armorAwaken && typeof p.armorAwaken === "object") ? p.armorAwaken : {},
        efx: (p.efx && typeof p.efx === "object") ? p.efx : {},
        comp: Array.isArray(p.comp) ? p.comp : [],
        bossPow: (p.bossPow && typeof p.bossPow === "object") ? p.bossPow : {},
      };
    } catch (_) { return defaultProfile(); }
  }
  function persistProfile() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile)); } catch (_) {}
  }
  // お金と最高到達のみ更新（装備はそのまま）
  function saveMoney() {
    profile.bank = player.banked;
    profile.deepest = Math.max(profile.deepest | 0, player.depthMax | 0);
    persistProfile();
  }
  // 脱出成功時：現在の装備（強化値含む）を持ち越し用に保存
  function saveGear() {
    profile.weapon = player.weapon;
    profile.owned = player.owned.slice();
    profile.armor = player.armor;
    profile.ownedArmor = player.ownedArmor.slice();
    profile.maxHp = player.maxHp;
    profile.weaponPlus = player.weaponPlus.slice();
    profile.armorPlus = player.armorPlus.slice();
    profile.awaken = Object.assign({}, player.awaken);
    profile.armorAwaken = Object.assign({}, player.armorAwaken);
    profile.efx = JSON.parse(JSON.stringify(player.efx || {}));
    profile.comp = player.comp.slice();
    profile.bossPow = Object.assign({}, player.bossPow);
  }
  // 死亡時：持ち越し装備をリセット（図鑑・貯金は残す）
  function resetGear() {
    Object.assign(profile, baseGear());
  }

  // animation
  let anim = { fromR: 0, fromC: 0, t: 1, dur: 0.13 };
  let camRow = 0;
  let floaters = []; // {r,c,text,color,t}
  let shakeT = 0;

  // お金は常に持ち越し。装備は前回「脱出」していれば profile から引き継ぐ。
  // withdrawable = 前回までの繰り越し貯金のみ。今回預けた分は次回ゲームまで引き出せない。
  function freshPlayer() {
    const owned = profile.owned.slice(); owned[0] = true;
    const ownedArmor = profile.ownedArmor.slice(); ownedArmor[0] = true;
    return { r: 0, c: (COLS / 2) | 0, hp: profile.maxHp, maxHp: profile.maxHp,
             gold: 0, banked: profile.bank, withdrawable: profile.bank,
             weapon: profile.weapon, owned: owned,
             armor: profile.armor, ownedArmor: ownedArmor,
             weaponPlus: profile.weaponPlus.slice(), armorPlus: profile.armorPlus.slice(),
             awaken: Object.assign({}, profile.awaken), armorAwaken: Object.assign({}, profile.armorAwaken),
             efx: JSON.parse(JSON.stringify(profile.efx || {})),
             comp: profile.comp.slice(), bossPow: Object.assign({}, profile.bossPow),
             reviveUsed: {}, campCount: 0, depthMax: 0 };
  }

  // ---- effective stats with + enhancement / 覚醒 ----
  function wStep(i) { return Math.max(2, Math.round(WEAPONS[i].power * 0.12)); }
  function aStep(i) { return Math.max(1, Math.round((ARMOR[i].def || 1) * 0.18)); }
  // ボス武器はドロップ時に決まる威力(player.bossPow)を持つ
  function rawPower(i) {
    return WEAPONS[i].boss ? ((player.bossPow && player.bossPow[i]) || WEAPONS[i].power) : WEAPONS[i].power;
  }
  function strongestOwnedPower() {
    let m = 0;
    for (let i = 0; i < WEAPONS.length; i++) if (player.owned[i]) m = Math.max(m, rawPower(i));
    return m;
  }
  function weaponEffect(i) { return (player.awaken && player.awaken[i]) || null; } // 覚醒(0.8倍化)の印
  // 武器が持つ特殊効果すべて（覚醒 + 強化10ごとに付与）
  function weaponFx(i) {
    const arr = [];
    if (player.awaken && player.awaken[i]) arr.push(player.awaken[i]);
    if (player.efx && player.efx[i]) for (const e of player.efx[i]) if (!arr.includes(e)) arr.push(e);
    return arr;
  }
  function hasFx(key) { return weaponFx(player.weapon).includes(key); }
  // 覚醒した武器は「所持最強武器の0.8倍」の威力になる。ボス武器は固有威力
  function weaponBase(i) {
    if (WEAPONS[i].boss) return rawPower(i);
    if (weaponEffect(i)) return Math.max(WEAPONS[i].power, Math.round(0.8 * strongestOwnedPower()));
    return WEAPONS[i].power;
  }
  function weaponPower() {
    const i = player.weapon;
    const base = weaponBase(i) + (player.weaponPlus[i] || 0) * wStep(i);
    return Math.max(1, Math.round(base * (1 + companionBuff())));
  }
  // ボス武器の威力 = そのフロアまで敵を全員倒した想定の金で買える店武器 ×1.5
  function affordableWeaponPower(depth) {
    let g = 0;
    for (let d = 1; d <= depth; d++) g += COLS * Math.min(0.28, 0.06 + d * 0.012) * (40 + 14.5 * d);
    let pow = WEAPONS[0].power;
    for (let i = 0; i < WEAPONS.length; i++) if (!WEAPONS[i].boss && WEAPONS[i].cost <= g) pow = Math.max(pow, WEAPONS[i].power);
    return pow;
  }
  function bossDropPower(depth) { return Math.round(affordableWeaponPower(depth) * 1.5); }
  function armorEffect(i) { return (player.armorAwaken && player.armorAwaken[i]) || null; }
  function strongestOwnedArmorDef() {
    let m = 0;
    for (let i = 0; i < ARMOR.length; i++) if (player.ownedArmor[i]) m = Math.max(m, ARMOR[i].def);
    return m;
  }
  // 覚醒した防具は「所持最強防具の0.8倍」の防御力になる
  function armorBase(i) {
    if (armorEffect(i)) return Math.max(ARMOR[i].def, Math.round(0.8 * strongestOwnedArmorDef()));
    return ARMOR[i].def;
  }
  function armorDef() {
    const i = player.armor;
    return armorBase(i) + (player.armorPlus[i] || 0) * aStep(i);
  }
  function enhanceCostW(i) {
    const lv = player.weaponPlus[i] || 0;
    return Math.round(WEAPONS[i].power * 22 * Math.pow(lv + 1, 1.6));
  }
  function enhanceCostA(i) {
    const lv = player.armorPlus[i] || 0;
    return Math.round((ARMOR[i].def + 2) * 55 * Math.pow(lv + 1, 1.6));
  }

  // ---- 称号 (titles by deepest depth) ----
  const TITLES = [
    [0, "みならい発掘者"], [5, "穴掘り見習い"], [10, "トレジャーハンター"],
    [18, "地底の探検家"], [28, "洞窟のぬし"], [40, "深淵の踏破者"],
    [55, "奈落の征服者"], [75, "伝説の発掘王"], [100, "神話の到達者"],
  ];
  function titleFor(depth) {
    let t = TITLES[0][1];
    for (const [d, name] of TITLES) if (depth >= d) t = name;
    return t;
  }
  function nextTitle(depth) {
    for (const [d, name] of TITLES) if (depth < d) return [d, name];
    return null;
  }

  // ============================================================
  //  Map generation
  // ============================================================
  function ensureRow(r) {
    if (rows[r]) return rows[r];
    let tiles;
    if (r <= 0) {
      tiles = new Array(COLS).fill("surface");
    } else if (r % CAMP_INTERVAL === 0) {
      // 脱出ポイント row: open cave, camp marker in the middle
      tiles = new Array(COLS).fill("empty");
      tiles[(COLS / 2) | 0] = "camp";
      rows[r] = tiles;
      rows[r].isCamp = true;
      return rows[r];
    } else {
      tiles = [];
      const enemyP = Math.min(0.28, 0.06 + r * 0.012);
      for (let c = 0; c < COLS; c++) {
        const x = Math.random();
        let t = "dirt";
        if (x < 0.09) t = "rock";
        else if (x < 0.09 + enemyP) t = "enemy";
        else if (x < 0.09 + enemyP + 0.20) t = "gold";
        else if (x < 0.09 + enemyP + 0.24) t = "gem";
        else if (x < 0.09 + enemyP + 0.29) t = "heart";
        tiles.push(t);
      }
      // guarantee at least one non-rock so the floor is always passable
      if (tiles.every((t) => t === "rock")) tiles[(Math.random() * COLS) | 0] = "dirt";
      // ボスは端寄りの列に配置（中央を通れば回避できる）。B64までは出現を半分に
      if (r % BOSS_INTERVAL === 0 && (r > 64 || Math.random() < 0.5)) {
        const edges = [0, 1, COLS - 2, COLS - 1];
        tiles[edges[(Math.random() * edges.length) | 0]] = "boss";
      }
    }
    rows[r] = tiles;
    return tiles;
  }

  function tileAt(r, c) { return ensureRow(r)[c]; }
  function setTile(r, c, v) { ensureRow(r)[c] = v; }

  // ============================================================
  //  Canvas sizing
  // ============================================================
  let DPR = 1, W = 0, H = 0, TS = 0;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    TS = W / COLS;
  }
  window.addEventListener("resize", resize);

  // ============================================================
  //  Rendering
  // ============================================================
  const PLAYER_SCREEN_FRAC = 0.34;

  // B200以降は「魔境」バイオームへ。30階ごとに景観が変化（メイドインアビス風）
  const BIOME_START = 200;
  const BIOME_SPAN = 30;
  const BIOMES = [
    { name: "みどりの楽園", emoji: "🌿", wall: [115, 45, 26], cave: [125, 42, 13] },
    { name: "あおぞらの底", emoji: "☁️", wall: [205, 50, 58], cave: [200, 65, 74], bright: true },
    { name: "むらさきの霧", emoji: "🔮", wall: [282, 44, 30], cave: [276, 42, 15] },
    { name: "こがねの花園", emoji: "🌟", wall: [44, 68, 42], cave: [40, 58, 22] },
    { name: "あかい奈落",   emoji: "🔥", wall: [4, 58, 32], cave: [2, 55, 15] },
    { name: "ほしぞらの間", emoji: "✨", wall: [230, 40, 24], cave: [235, 55, 10] },
  ];
  function biomeFor(r) {
    if (r < BIOME_START) return null;
    return BIOMES[Math.floor((r - BIOME_START) / BIOME_SPAN) % BIOMES.length];
  }
  function dirtColor(r) {
    const b = biomeFor(r);
    if (b) return `hsl(${b.wall[0]}, ${b.wall[1]}%, ${b.wall[2]}%)`;
    const l = Math.max(11, 30 - r * 0.45);
    return `hsl(26, 42%, ${l}%)`;
  }
  function caveColor(r) {
    const b = biomeFor(r);
    if (b) return `hsl(${b.cave[0]}, ${b.cave[1]}%, ${b.cave[2]}%)`;
    return `hsl(26, 35%, ${Math.max(7, 18 - r * 0.3)}%)`;
  }

  function draw() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);

    // player animated position
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const e = ease(Math.min(1, anim.t));
    const pr = anim.fromR + (player.r - anim.fromR) * e;
    const pc = anim.fromC + (player.c - anim.fromC) * e;

    // camera follows
    camRow += (pr - camRow) * 0.18;
    const originY = H * PLAYER_SCREEN_FRAC;
    const sx0 = (shakeT > 0) ? (Math.random() - 0.5) * shakeT * 10 : 0;
    const sy0 = (shakeT > 0) ? (Math.random() - 0.5) * shakeT * 10 : 0;

    const rowTop = Math.floor(camRow - originY / TS) - 1;
    const rowBot = Math.ceil(camRow + (H - originY) / TS) + 1;

    for (let r = rowTop; r <= rowBot; r++) {
      const sy = (r - camRow) * TS + originY + sy0;
      for (let c = 0; c < COLS; c++) {
        drawTile(r, c, c * TS + sx0, sy);
      }
    }

    // floaters
    for (const f of floaters) {
      const sy = (f.r - camRow) * TS + originY - f.t * 38 + sy0;
      const sx = f.c * TS + TS / 2 + sx0;
      ctx.globalAlpha = Math.max(0, 1 - f.t);
      ctx.fillStyle = f.color;
      ctx.font = `bold ${TS * 0.34}px DotGothic16, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.text, sx, sy);
      ctx.globalAlpha = 1;
    }

    // player
    drawPlayer(pc * TS + sx0, (pr - camRow) * TS + originY + sy0);
  }

  function drawTile(r, c, x, y) {
    const t = (r < 0) ? "sky" : tileAt(r, c);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (t === "sky") {
      const g = ctx.createLinearGradient(0, y, 0, y + TS);
      g.addColorStop(0, "#7ec8e8"); g.addColorStop(1, "#bfe6f2");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, TS + 1, TS + 1);
      return;
    }
    if (t === "surface") {
      ctx.fillStyle = "#6a8f3a";
      ctx.fillRect(x, y, TS + 1, TS + 1);
      ctx.fillStyle = "#86b04a";
      ctx.fillRect(x, y, TS + 1, TS * 0.28);
      return;
    }

    // base earth
    if (t === "empty" || t === "camp" || t === "enemy" || t === "gold" || t === "gem" || t === "heart" || t === "boss") {
      // dug-out / cave background
      ctx.fillStyle = caveColor(r);
      ctx.fillRect(x, y, TS + 1, TS + 1);
    } else if (t === "rock") {
      ctx.fillStyle = dirtColor(r);
      ctx.fillRect(x, y, TS + 1, TS + 1);
    } else { // dirt
      ctx.fillStyle = dirtColor(r);
      ctx.fillRect(x, y, TS + 1, TS + 1);
      // texture speckles
      ctx.fillStyle = "rgba(0,0,0,0.10)";
      ctx.fillRect(x + TS * 0.18, y + TS * 0.22, 3, 3);
      ctx.fillRect(x + TS * 0.62, y + TS * 0.55, 3, 3);
      ctx.fillRect(x + TS * 0.4, y + TS * 0.78, 2, 2);
    }

    // subtle cell border
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, TS, TS);

    const cx = x + TS / 2, cy = y + TS / 2;
    if (t === "rock") {
      ctx.fillStyle = "#8a8378";
      roundRect(x + TS * 0.16, y + TS * 0.2, TS * 0.68, TS * 0.62, 7);
      ctx.fill();
      ctx.fillStyle = "#a8a196";
      roundRect(x + TS * 0.22, y + TS * 0.26, TS * 0.4, TS * 0.28, 5);
      ctx.fill();
    } else if (t === "gold") {
      emoji("💰", cx, cy);
    } else if (t === "gem") {
      emoji("💎", cx, cy);
    } else if (t === "heart") {
      emoji("💗", cx, cy);
    } else if (t === "camp") {
      emoji("🪜", cx, cy);
    } else if (t === "enemy") {
      const ed = enemyDataFor(r, c);
      emoji(ed.emoji, cx, cy);
    } else if (t === "boss") {
      drawBossAura(cx, cy, tAnim);
      const bd = bossDataFor(r, c);
      ctx.font = `${TS * 0.68}px serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(bd.emoji, cx, cy);
    }
  }

  // たなびくオーラ
  function drawBossAura(cx, cy, t) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    const R = TS * (0.52 + 0.14 * pulse);
    const g = ctx.createRadialGradient(cx, cy, TS * 0.08, cx, cy, R);
    g.addColorStop(0, "rgba(255,180,60,0.55)");
    g.addColorStop(0.55, "rgba(220,60,160,0.30)");
    g.addColorStop(1, "rgba(220,60,160,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    // 揺らめく炎のオーラ
    for (let k = 0; k < 6; k++) {
      const a = t * 1.6 + k * (Math.PI * 2 / 6);
      const rad = TS * (0.4 + 0.08 * Math.sin(t * 4 + k));
      const wx = cx + Math.cos(a) * rad;
      const wy = cy + Math.sin(a) * rad * 0.7;
      ctx.fillStyle = `rgba(255,${110 + ((k * 30) % 120)},40,0.35)`;
      ctx.save();
      ctx.translate(wx, wy); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(0, 0, TS * 0.05, TS * 0.13, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  // deterministic-ish enemy appearance per cell (so it doesn't flicker)
  const enemyCache = {};
  function enemyDataFor(r, c) {
    const k = r + "," + c;
    if (!enemyCache[k]) enemyCache[k] = pickEnemy(r);
    return enemyCache[k];
  }
  const bossCache = {};
  function bossDataFor(r, c) {
    const k = r + "," + c;
    if (!bossCache[k]) {
      const tier = BOSS_TIERS.find((tt) => r < tt.until);
      const e = tier.list[(Math.random() * tier.list.length) | 0];
      bossCache[k] = { name: e[0], emoji: e[1] };
    }
    return bossCache[k];
  }

  function drawPlayer(x, y) {
    const cx = x + TS / 2, cy = y + TS / 2;
    // body
    ctx.fillStyle = "#f6c453";
    roundRect(x + TS * 0.2, y + TS * 0.18, TS * 0.6, TS * 0.64, 10);
    ctx.fill();
    ctx.strokeStyle = "#7a4a16"; ctx.lineWidth = 2; ctx.stroke();
    // helmet light
    ctx.fillStyle = "#fff2cf";
    roundRect(x + TS * 0.28, y + TS * 0.24, TS * 0.44, TS * 0.16, 6);
    ctx.fill();
    // eyes
    ctx.fillStyle = "#2a1606";
    ctx.beginPath(); ctx.arc(cx - TS * 0.1, cy + TS * 0.02, TS * 0.045, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + TS * 0.1, cy + TS * 0.02, TS * 0.045, 0, 7); ctx.fill();
    // pick emoji badge
    ctx.font = `${TS * 0.32}px serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("⛏️", cx + TS * 0.22, cy + TS * 0.26);
  }

  function emoji(ch, cx, cy) {
    ctx.font = `${TS * 0.58}px serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(ch, cx, cy);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ============================================================
  //  Game loop
  // ============================================================
  let last = performance.now();
  let tAnim = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tAnim += dt;
    if (anim.t < 1) anim.t = Math.min(1, anim.t + dt / anim.dur);
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt * 4);
    for (const f of floaters) f.t += dt * 1.1;
    floaters = floaters.filter((f) => f.t < 1);
    draw();
    requestAnimationFrame(loop);
  }

  function addFloater(r, c, text, color) {
    floaters.push({ r, c, text, color, t: 0 });
  }

  // ============================================================
  //  Player actions
  // ============================================================
  function tryMove(dir) {
    if (state !== "explore" || anim.t < 1) return;
    let dr = 0, dc = 0;
    if (dir === "up") dr = -1;
    else if (dir === "down") dr = 1;
    else if (dir === "left") dc = -1;
    else if (dir === "right") dc = 1;

    const nr = player.r + dr, nc = player.c + dc;
    if (nc < 0 || nc >= COLS) return;
    if (nr < 0) return; // can't climb above surface
    if (dr < 0) {
      // climbing up only into already cleared space
      const tu = tileAt(nr, nc);
      if (tu !== "empty" && tu !== "surface" && tu !== "camp") { bump(); return; }
      doMoveTo(nr, nc);
      return;
    }

    const t = tileAt(nr, nc);
    if (t === "rock") { bump(); return; }
    if (t === "enemy") { startCombat(nr, nc, false); return; }
    if (t === "boss") { startCombat(nr, nc, true); return; }
    // collectible / dirt / empty
    collect(nr, nc, t);
    doMoveTo(nr, nc);
  }

  function bump() { shakeT = 0.5; sfx("bump"); }

  function collect(r, c, t) {
    if (t === "gold") {
      const g = 8 + (r * 4) + ((Math.random() * (8 + r * 2)) | 0);
      player.gold += g; addFloater(r, c, "+" + g + "G", "#f6c453"); sfx("coin");
    } else if (t === "gem") {
      const g = 40 + (r * 12) + ((Math.random() * 40) | 0);
      player.gold += g; addFloater(r, c, "+" + g + "G", "#7ee0ff"); sfx("coin");
    } else if (t === "heart") {
      const h = 8 + (Math.random() * 6 | 0);
      player.hp = Math.min(player.maxHp, player.hp + h);
      addFloater(r, c, "+" + h + "HP", "#7be08a"); sfx("heal");
    }
    if (t === "dirt" || t === "gold" || t === "gem" || t === "heart") setTile(r, c, "empty");
  }

  function doMoveTo(nr, nc) {
    anim.fromR = player.r; anim.fromC = player.c; anim.t = 0;
    player.r = nr; player.c = nc;
    if (nr > player.depthMax) player.depthMax = nr;
    // 覚醒「再生」：1歩ごとにHP回復
    if (hasFx("regen") && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + 1);
    }
    updateHUD();
    sfx("dig");
    // 魔境バイオームに入ったら告知
    const b = biomeFor(nr);
    const bn = b ? b.name : null;
    if (bn !== lastBiomeName) {
      lastBiomeName = bn;
      if (b) { addFloater(nr, nc, `${b.emoji} ${b.name}`, "#ffe9b0"); sfx("heal"); }
    }
    if (rows[nr] && rows[nr].isCamp && campOpenedAt !== nr) {
      campOpenedAt = nr;
      player.campCount = (player.campCount | 0) + 1;
      // 5回目の脱出ポイント以降、弱い武器のひとつが覚醒する
      pendingAwaken = (player.campCount >= 5) ? tryAwaken() : null;
      setTimeout(openCamp, 160);
    }
  }

  // 武器と防具を同時に覚醒させる（「最も高価な所持品より安いもの」のひとつ）
  let pendingAwaken = null;
  function tryAwaken() {
    const w = awakenOne(WEAPONS, player.owned, player.awaken, EFFECT_KEYS);
    const a = awakenOne(ARMOR, player.ownedArmor, player.armorAwaken, ARMOR_EFFECT_KEYS);
    if (!w && !a) return null;
    return { weapon: w, armor: a };
  }
  function awakenOne(list, owned, awakenMap, effectKeys) {
    let maxCost = -1;
    for (let i = 0; i < list.length; i++) if (owned[i] && !list[i].boss) maxCost = Math.max(maxCost, list[i].cost);
    const eligible = [];
    for (let i = 0; i < list.length; i++) if (owned[i] && !list[i].boss && list[i].cost < maxCost) eligible.push(i);
    if (eligible.length === 0) return null;
    const fresh = eligible.filter((i) => !awakenMap[i]);
    const pool = fresh.length ? fresh : eligible;
    const idx = pool[(Math.random() * pool.length) | 0];
    const effect = effectKeys[(Math.random() * effectKeys.length) | 0];
    awakenMap[idx] = effect;
    return { idx, effect };
  }

  // 強化10回ごと：武器に未所持の特殊効果をひとつ付与
  function grantEnhanceFx(i) {
    player.efx = player.efx || {};
    player.efx[i] = player.efx[i] || [];
    const have = weaponFx(i);
    const avail = EFFECT_KEYS.filter((k) => !have.includes(k));
    if (avail.length === 0) {
      el.awakenNotice.innerHTML = `🔨 <b>${WEAPONS[i].name}</b> +${player.weaponPlus[i]}：すでに全効果を習得！`;
      show(el.awakenNotice, true);
      return;
    }
    const key = avail[(Math.random() * avail.length) | 0];
    player.efx[i].push(key);
    const ef = EFFECTS[key];
    el.awakenNotice.innerHTML = `🔨 <b>${WEAPONS[i].name}</b> +${player.weaponPlus[i]}！ 特殊効果 ${ef.emoji}${ef.name}（${ef.desc}）が付与された`;
    show(el.awakenNotice, true);
    sfx("win");
  }

  // ============================================================
  //  Combat
  // ============================================================
  function startCombat(r, c, isBoss) {
    const depth = r;
    const ed = isBoss ? bossDataFor(r, c) : enemyDataFor(r, c);
    const baseHp = (6 + depth * 2.4);
    const hp = Math.round(baseHp * (isBoss ? 3 : 1) * (0.9 + Math.random() * 0.25));
    const baseAtk = (1.5 + depth * 0.7);
    combat = {
      r, c, name: ed.name, emoji: ed.emoji, isBoss: !!isBoss,
      hp, maxHp: hp,
      atk: Math.max(1, Math.round(baseAtk * (isBoss ? 1.6 : 1) * (0.9 + Math.random() * 0.25))),
      reward: isBoss
        ? (300 + depth * 80 + ((Math.random() * (200 + depth * 40)) | 0))
        : (30 + depth * 12 + ((Math.random() * (20 + depth * 5)) | 0)),
      drop: isBoss ? bossWeaponIndex(depth) : -1,
      burn: 0, freeze: 0, guardUsed: false,
      busy: false,
    };
    state = "combat";
    el.enemyEmoji.textContent = ed.emoji;
    el.enemyEmoji.classList.toggle("boss", !!isBoss);
    el.enemyName.textContent = (isBoss ? "👑【ボス】" : "") + ed.name + `  (B${depth}F)`;
    el.combatLog.innerHTML = `<div>${isBoss ? "強大なオーラ…！ " : ""}${ed.name} があらわれた！</div>`;
    updateEnemyHp();
    renderCombatPets();
    show(el.ovCombat, true);
    setCombatButtons(true);
  }

  function updateEnemyHp() {
    const pct = Math.max(0, combat.hp / combat.maxHp) * 100;
    el.enemyHpBar.style.width = pct + "%";
    el.enemyHpText.textContent = Math.max(0, combat.hp) + "/" + combat.maxHp;
  }

  function setCombatButtons(on) {
    el.btnAttack.disabled = !on;
    el.btnFlee.disabled = !on;
  }

  function playerAttack() {
    if (state !== "combat" || combat.busy) return;
    combat.busy = true; setCombatButtons(false);
    const fx = weaponFx(player.weapon);
    let dmg = Math.max(1, Math.round(weaponPower() * (0.8 + Math.random() * 0.4)));
    let note = "";
    if (fx.includes("instakill") && Math.random() < 0.08) {
      combat.hp = 0;
      logCombat(`<span class="awk">⚡ 即死！</span> ${combat.name} を一撃で葬った！`);
    } else {
      if (fx.includes("crit") && Math.random() < 0.2) { dmg *= 2; note = ` <span class="awk">✨会心!</span>`; }
      combat.hp -= dmg;
      logCombat(`${combat.name} に <span class="dmg">${dmg}</span> のダメージ！${note}`);
    }
    el.enemyEmoji.classList.remove("hit"); void el.enemyEmoji.offsetWidth; el.enemyEmoji.classList.add("hit");
    // 「吸収」：攻撃ごとにHP回復
    if (fx.includes("lifesteal") && player.hp < player.maxHp) {
      const heal = Math.max(2, Math.round(player.maxHp * 0.05));
      player.hp = Math.min(player.maxHp, player.hp + heal);
      logCombat(`<span class="awk">💞 吸収</span> HP+${heal}`);
      updateHUD();
    }
    // 「火傷」：以後、敵の攻撃後にダメージ
    if (fx.includes("burn") && combat.hp > 0) {
      const wasBurning = combat.burn > 0;
      combat.burn = Math.max(3, Math.round(weaponPower() * 0.25));
      if (!wasBurning) logCombat(`<span class="awk">🔥 火傷</span> を負わせた！`);
    }
    // 「凍結」：一定確率で数ターン凍結
    if (fx.includes("freeze") && combat.hp > 0 && Math.random() < 0.3) {
      combat.freeze = Math.max(combat.freeze, 2);
      logCombat(`<span class="awk">❄️ 凍結</span>！ ${combat.name} は動けない`);
    }
    // お供（なかま）も一緒に攻撃
    if (combat.hp > 0) {
      const ct = companionDamage();
      if (ct > 0) {
        combat.hp -= ct;
        logCombat(`🐾 なかまの攻撃！ <span class="dmg">${ct}</span> のダメージ！`);
      }
    }
    // お供の回復
    const ch = companionHeal();
    if (ch > 0 && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + ch);
      logCombat(`🐾 なかまの回復 <span class="awk">HP+${ch}</span>`);
      updateHUD();
    }
    updateEnemyHp();
    sfx("hit");

    if (combat.hp <= 0) {
      setTimeout(() => winCombat(), 450);
      return;
    }
    // enemy retaliates
    setTimeout(() => enemyAttack(() => { combat.busy = false; setCombatButtons(true); }), 480);
  }

  function companionDamage() {
    let total = 0;
    for (let i = 0; i < COMPANIONS.length; i++) {
      if (player.comp[i] && COMPANIONS[i].power) total += Math.max(1, Math.round(COMPANIONS[i].power * (0.8 + Math.random() * 0.4)));
    }
    return total;
  }
  function companionHeal() {
    let h = 0;
    for (let i = 0; i < COMPANIONS.length; i++) if (player.comp[i]) h += COMPANIONS[i].heal || 0;
    return h;
  }
  function companionBuff() {
    let b = 0;
    for (let i = 0; i < COMPANIONS.length; i++) if (player.comp[i]) b += COMPANIONS[i].buff || 0;
    return b;
  }
  function hasGuard() {
    for (let i = 0; i < COMPANIONS.length; i++) if (player.comp[i] && COMPANIONS[i].guard) return true;
    return false;
  }
  function renderCombatPets() {
    const owned = COMPANIONS.filter((c, i) => player.comp[i]);
    if (owned.length) {
      el.combatPets.innerHTML = "なかま " + owned.map((c) => c.emoji).join("");
      show(el.combatPets, true);
    } else {
      show(el.combatPets, false);
    }
  }

  function enemyAttack(done) {
    // 凍結中は攻撃できない
    if (combat.freeze > 0) {
      combat.freeze--;
      logCombat(`<span class="awk">❄️</span> ${combat.name} は凍結して動けない！（残り${combat.freeze}）`);
      done && done();
      return;
    }
    const aeff = armorEffect(player.armor);
    const raw = Math.max(1, Math.round(combat.atk * (0.8 + Math.random() * 0.4)));
    const def = armorDef();
    let dmg = Math.max(1, raw - def);
    let evaded = false;
    if (aeff === "evade" && Math.random() < 0.2) { dmg = 0; evaded = true; }
    else if (aeff === "ironwall") { dmg = Math.max(1, Math.round(dmg * 0.6)); }
    player.hp -= dmg;
    shakeT = 0.6;
    if (evaded) {
      logCombat(`${combat.name} の こうげき！ <span class="awk">💨 回避！</span>`);
    } else {
      const reduced = def > 0 && raw > dmg ? `（${ARMOR[player.armor].name}で-${raw - dmg}）` : "";
      logCombat(`${combat.name} の こうげき！ <span class="hurt">${dmg}</span> ダメージ${reduced}`);
    }
    updateHUD();
    sfx("hurt");
    if (player.hp <= 0) {
      player.hp = 0; updateHUD();
      if (!tryGuard() && !tryRevive()) { setTimeout(gameOver, 500); return; }
    }
    // 防具「加護」：敵の攻撃のたびHP回復
    if (aeff === "blessing" && player.hp > 0 && player.hp < player.maxHp) {
      const h = Math.max(2, Math.round(player.maxHp * 0.05));
      player.hp = Math.min(player.maxHp, player.hp + h);
      logCombat(`<span class="awk">😇 加護</span> HP+${h}`); updateHUD();
    }
    // 防具「反射」：受けたダメージの一部を敵に返す
    if (aeff === "reflect" && dmg > 0 && combat.hp > 0) {
      const rf = Math.max(1, Math.round(dmg * 0.3));
      combat.hp -= rf;
      logCombat(`<span class="awk">🪞 反射</span> ${combat.name} に <span class="dmg">${rf}</span>`);
      updateEnemyHp();
      if (combat.hp <= 0) { setTimeout(() => winCombat(), 450); return; }
    }
    // 火傷：敵の攻撃後にダメージ
    if (combat.burn > 0) {
      combat.hp -= combat.burn;
      logCombat(`<span class="awk">🔥 火傷</span> ${combat.name} に <span class="dmg">${combat.burn}</span> のダメージ`);
      updateEnemyHp();
      if (combat.hp <= 0) { setTimeout(() => winCombat(), 450); return; }
    }
    done && done();
  }

  // 生命の神秘：装備中の武器ごとに一回だけ復活
  function tryRevive() {
    if (!weaponFx(player.weapon).includes("revive")) return false;
    if (player.reviveUsed[player.weapon]) return false;
    player.reviveUsed[player.weapon] = true;
    player.hp = Math.max(1, Math.round(player.maxHp * 0.5));
    updateHUD();
    logCombat(`<span class="awk">💚 生命の神秘！</span> ${WEAPONS[player.weapon].name} の力で復活した！`);
    sfx("heal");
    return true;
  }

  // お供「まもりぐま」：戦闘ごとに1回みがわり
  function tryGuard() {
    if (!hasGuard() || combat.guardUsed) return false;
    combat.guardUsed = true;
    player.hp = Math.max(1, Math.round(player.maxHp * 0.3));
    updateHUD();
    logCombat(`<span class="awk">🐻 まもりぐま</span> がみがわりになった！`);
    sfx("heal");
    return true;
  }

  function winCombat() {
    let reward = combat.reward;
    const x2 = weaponFx(player.weapon).includes("goldx2");
    if (x2) reward *= 2;
    player.gold += reward;
    if (!combat.isBoss && !profile.dex.includes(combat.name)) { profile.dex.push(combat.name); persistProfile(); }
    el.enemyHpBar.style.width = "0%";
    el.enemyHpText.textContent = "0/" + combat.maxHp;
    logCombat(`${combat.name} をたおした！ <span class="dmg">💰+${reward}G</span>${x2 ? ' <span class="awk">金運2倍!</span>' : ""} を手に入れた！`);
    // ボスは専用武器をドロップ（威力はフロアに応じて決定／自動装備はしない）
    if (combat.isBoss && combat.drop >= 0) {
      const di = combat.drop;
      const pow = bossDropPower(combat.r);
      player.bossPow = player.bossPow || {};
      const upgraded = pow > (player.bossPow[di] || 0);
      player.bossPow[di] = Math.max(player.bossPow[di] || 0, pow);
      player.owned[di] = true; // 装備は変更しない（脱出ポイントで付け替え可）
      logCombat(`<span class="awk">⚔️ ${WEAPONS[di].name}（攻撃${player.bossPow[di]}）</span> を手に入れた！${upgraded ? "" : "（威力は据え置き）"}`);
      el.enemyEmoji.classList.remove("boss");
    }
    addFloater(combat.r, combat.c, "+" + reward + "G", "#f6c453");
    setTile(combat.r, combat.c, "empty");
    delete enemyCache[combat.r + "," + combat.c];
    delete bossCache[combat.r + "," + combat.c];
    updateHUD();
    sfx(combat.isBoss ? "win" : "coin");
    const tr = combat.r, tc = combat.c, wasBoss = combat.isBoss;
    // keep the panel up briefly so the reward is clearly seen
    setTimeout(() => {
      show(el.ovCombat, false);
      state = "explore";
      combat = null;
      doMoveTo(tr, tc);
    }, wasBoss ? 1300 : 850);
  }

  function flee() {
    if (state !== "combat" || combat.busy) return;
    combat.busy = true; setCombatButtons(false);
    if (Math.random() < 0.6) {
      logCombat("うまく にげられた！");
      sfx("dig");
      setTimeout(() => {
        show(el.ovCombat, false);
        state = "explore";
        combat = null;
        // retreat upward if possible
        const ur = player.r - 1;
        if (ur >= 0) {
          const t = tileAt(ur, player.c);
          if (t === "empty" || t === "surface" || t === "camp") doMoveTo(ur, player.c);
        }
      }, 450);
    } else {
      logCombat("にげられなかった！");
      setTimeout(() => enemyAttack(() => { combat.busy = false; setCombatButtons(true); }), 400);
    }
  }

  function logCombat(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    el.combatLog.appendChild(div);
    while (el.combatLog.children.length > 3) el.combatLog.removeChild(el.combatLog.firstChild);
  }

  // ============================================================
  //  Camp / shop
  // ============================================================
  function openCamp() {
    state = "camp";
    el.campSub.textContent = `B${player.r}F の脱出ポイント。預けて確保、引き出して装備購入。`;
    if (pendingAwaken) {
      const p = pendingAwaken; pendingAwaken = null;
      const lines = [];
      if (p.weapon) { const ef = EFFECTS[p.weapon.effect]; lines.push(`⭐ <b>${WEAPONS[p.weapon.idx].name}</b> 覚醒！ ${ef.emoji}${ef.name}（${ef.desc}）`); }
      if (p.armor) { const ef = ARMOR_EFFECTS[p.armor.effect]; lines.push(`⭐ <b>${ARMOR[p.armor.idx].name}</b> 覚醒！ ${ef.emoji}${ef.name}（${ef.desc}）`); }
      el.awakenNotice.innerHTML = lines.join("<br>");
      show(el.awakenNotice, true);
    } else {
      show(el.awakenNotice, false);
    }
    renderBank();
    renderShop();
    show(el.ovCamp, true);
    sfx("heal");
  }

  // Custom pointer-driven slider (native range inputs are unreliable on touch).
  let depSlider = null, wdSlider = null;
  function makeSlider(id, onChange) {
    const root = $(id);
    const fill = root.querySelector(".slider-fill");
    const thumb = root.querySelector(".slider-thumb");
    let max = 0, val = 0, dragging = false;
    function update() {
      const p = max > 0 ? val / max : 0;
      fill.style.width = (p * 100) + "%";
      thumb.style.left = (p * 100) + "%";
      root.classList.toggle("disabled", max <= 0);
      onChange && onChange(val);
    }
    function setFromX(clientX) {
      const r = root.getBoundingClientRect();
      let p = r.width > 0 ? (clientX - r.left) / r.width : 0;
      p = Math.max(0, Math.min(1, p));
      val = Math.round(p * max);
      update();
    }
    root.addEventListener("pointerdown", (e) => {
      if (max <= 0) return;
      dragging = true;
      try { root.setPointerCapture(e.pointerId); } catch (_) {}
      setFromX(e.clientX);
      e.preventDefault();
    });
    root.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      setFromX(e.clientX);
      e.preventDefault();
    });
    const end = () => { dragging = false; };
    root.addEventListener("pointerup", end);
    root.addEventListener("pointercancel", end);
    return {
      setMax(m) { max = Math.max(0, m | 0); if (val > max) val = max; update(); },
      setVal(v) { val = Math.max(0, Math.min(max, v | 0)); update(); },
      getVal() { return val; },
    };
  }

  function renderBank() {
    el.bankBanked.textContent = player.banked;
    el.bankCarry.textContent = player.gold;
    el.bankWdAvail.textContent = player.withdrawable;
    depSlider.setMax(player.gold);
    wdSlider.setMax(player.withdrawable); // 今回預けた分はロック
  }

  // 預ける：手持ち→貯金。今回預けた分は withdrawable に加えない（次回まで引き出せない）
  function deposit() {
    const amt = Math.min(player.gold, depSlider.getVal());
    if (amt <= 0) return;
    player.gold -= amt;
    player.banked += amt;
    afterBankMove();
  }

  // 引き出す：繰り越し貯金(withdrawable)の範囲でのみ 貯金→手持ち
  function withdraw() {
    const amt = Math.min(player.withdrawable, wdSlider.getVal());
    if (amt <= 0) return;
    player.banked -= amt;
    player.gold += amt;
    player.withdrawable -= amt;
    afterBankMove();
  }

  function afterBankMove() {
    saveMoney();
    updateHUD();
    depSlider.setVal(0);
    wdSlider.setVal(0);
    renderBank();
    renderShop(); // affordability changed
    sfx("coin");
  }

  // Purchases are paid from 手持ち only. 貯金 must be withdrawn first to spend it.
  function canAfford(cost) { return player.gold >= cost; }
  function pay(cost) { player.gold -= cost; }
  function afterPurchase() {
    saveMoney();
    updateHUD();
    renderBank();
    renderShop();
  }

  function renderShop() {
    el.shop.innerHTML = "";
    // --- restock ---
    el.shop.appendChild(shopHeader("🛏️ 休息"));
    if (player.hp < player.maxHp) {
      const healCost = Math.max(10, (player.maxHp - player.hp) * 4);
      el.shop.appendChild(shopRow("💊", "HP全回復", `HPを ${player.maxHp} まで回復`, healCost,
        canAfford(healCost), false, () => {
          pay(healCost); player.hp = player.maxHp; afterPurchase();
        }));
    }
    const hpUpCost = 60 + player.maxHp * 5;
    el.shop.appendChild(shopRow("💗", "最大HPアップ", `最大HP +10（現在 ${player.maxHp}）`, hpUpCost,
      canAfford(hpUpCost), false, () => {
        pay(hpUpCost); player.maxHp += 10; player.hp += 10; afterPurchase();
      }));

    // --- weapons ---
    el.shop.appendChild(shopHeader("⚔️ 武器（攻撃力アップ）"));
    equipSection(WEAPONS,
      (i) => player.owned[i], () => player.weapon,
      (i) => { player.owned[i] = true; player.weapon = i; },
      (i) => { player.weapon = i; },
      (w, i) => {
        const tag = w.boss ? "👑" : "";
        const star = weaponEffect(i) ? "⭐" : "";
        const fx = weaponFx(i);
        const fxs = fx.length ? "・" + fx.map((k) => EFFECTS[k].emoji + EFFECTS[k].name).join(" ") : "";
        return `${tag}${star}攻撃力 ${weaponBase(i)}${fxs}`;
      },
      (i, owned) => {
        const w = WEAPONS[i];
        if (w.boss) return owned;              // ボス専用武器は入手時のみ表示
        if (i === 0) return owned && weaponFx(0).length > 0; // こん棒は効果がある時のみ
        return true;
      });

    // --- armor ---
    el.shop.appendChild(shopHeader("🛡️ 防具（被ダメージ軽減）"));
    equipSection(ARMOR,
      (i) => player.ownedArmor[i], () => player.armor,
      (i) => { player.ownedArmor[i] = true; player.armor = i; },
      (i) => { player.armor = i; },
      (a, i) => {
        const eff = armorEffect(i);
        if (eff) return `⭐防御力 ${armorBase(i)}・${ARMOR_EFFECTS[eff].emoji}${ARMOR_EFFECTS[eff].name}`;
        return `防御力 ${a.def}`;
      },
      (i, owned) => i !== 0 || (owned && !!armorEffect(0))); // 覚醒したはだ着は装備可能に

    // --- enhancement (無限の金の使い道) ---
    el.shop.appendChild(shopHeader("🔨 強化（装備中のものを+強化）"));
    const wi = player.weapon, wlv = player.weaponPlus[wi] || 0, wcost = enhanceCostW(wi), wp = weaponPower();
    const nextFx = (wlv + 1) % 10 === 0 ? "（+" + (wlv + 1) + "で特殊効果！）" : "";
    el.shop.appendChild(shopRow("⚔️", `${WEAPONS[wi].name} +${wlv}`, `攻撃力 ${wp} → ${wp + wStep(wi)}${nextFx}`, wcost,
      canAfford(wcost), false, () => {
        pay(wcost); player.weaponPlus[wi] = wlv + 1;
        if (player.weaponPlus[wi] % 10 === 0) grantEnhanceFx(wi);
        afterPurchase();
      }));
    const ai = player.armor, alv = player.armorPlus[ai] || 0, acost = enhanceCostA(ai), ap = armorDef();
    el.shop.appendChild(shopRow("🛡️", `${ARMOR[ai].name} +${alv}`, `防御力 ${ap} → ${ap + aStep(ai)}`, acost,
      canAfford(acost), false, () => { pay(acost); player.armorPlus[ai] = alv + 1; afterPurchase(); }));

    // --- companions (なかま) ---
    el.shop.appendChild(shopHeader("🐾 なかま（戦闘で攻撃・回復・支援）"));
    COMPANIONS.forEach((c, i) => {
      const owned = !!player.comp[i];
      const row = shopRow(c.emoji, c.name, c.desc, c.cost,
        !owned && canAfford(c.cost), owned, () => {
          if (player.comp[i]) return;
          pay(c.cost); player.comp[i] = true; afterPurchase();
        });
      if (owned) {
        const buy = row.querySelector(".si-buy");
        row.classList.add("owned");
        buy.textContent = "なかま"; buy.classList.add("equipped"); buy.disabled = true;
      }
      el.shop.appendChild(row);
    });
  }

  // Generic weapon/armor list renderer. visibleFn(i, owned): その行を表示するか
  function equipSection(list, isOwned, getEquipped, buyEquip, justEquip, descFn, visibleFn) {
    list.forEach((it, i) => {
      const owned = isOwned(i);
      const vis = visibleFn ? visibleFn(i, owned) : (i !== 0);
      if (!vis) return;
      const equipped = getEquipped() === i;
      const row = shopRow(it.emoji, it.name, descFn(it, i), it.cost,
        !owned && canAfford(it.cost), owned, () => {
          if (isOwned(i)) return;
          pay(it.cost); buyEquip(i); afterPurchase();
        });
      if (owned) {
        const buy = row.querySelector(".si-buy");
        if (equipped) {
          row.classList.add("owned");
          buy.textContent = "装備中"; buy.classList.add("equipped"); buy.disabled = true;
        } else {
          buy.textContent = "装備する"; buy.disabled = false;
          buy.onclick = () => { justEquip(i); updateHUD(); renderShop(); };
        }
      }
      el.shop.appendChild(row);
    });
  }

  function shopHeader(text) {
    const d = document.createElement("div");
    d.className = "shop-head";
    d.textContent = text;
    return d;
  }

  function shopRow(icon, name, desc, cost, canBuy, owned, onBuy) {
    const div = document.createElement("div");
    div.className = "shop-item";
    div.innerHTML =
      `<div class="si-icon">${icon}</div>` +
      `<div class="si-info"><div class="si-name">${name}</div><div class="si-desc">${desc}</div></div>` +
      `<button class="si-buy">${cost}G</button>`;
    const buy = div.querySelector(".si-buy");
    buy.disabled = !canBuy;
    buy.onclick = () => { onBuy(); sfx("coin"); };
    return div;
  }

  function escapeGame() {
    show(el.ovCamp, false);
    finish(true);
  }
  function continueDig() {
    show(el.ovCamp, false);
    state = "explore";
  }

  // ============================================================
  //  End states
  // ============================================================
  function gameOver() {
    show(el.ovCombat, false);
    finish(false);
  }

  function finish(cleared) {
    state = "result";
    const prevDeepest = profile.deepest | 0;
    let lost = 0;
    if (cleared) {
      // 脱出成功：手持ちも全部持ち帰り、装備も次回へ持ち越す
      player.banked += player.gold;
      player.gold = 0;
      saveGear();
    } else {
      // 死亡：手持ちは失い、持ち越し装備もリセット。貯金のみ残る
      lost = player.gold;
      player.gold = 0;
      resetGear();
    }
    saveMoney(); // 貯金・最高到達を保存（装備は上で確定済み）
    clearRun(); // ランが終了したので中断データは破棄
    el.resultTitle.textContent = cleared ? "脱出成功！" : "ちからつきた…";
    el.resultTitle.classList.toggle("clear", cleared);
    el.resultEmoji.textContent = cleared ? "🎉" : "💀";
    el.rsDepth.textContent = "B" + player.depthMax + "F";
    if (!cleared && lost > 0) {
      el.rsLost.textContent = lost + " G";
      show(el.rsLostRow, true);
    } else {
      show(el.rsLostRow, false);
    }
    el.rsScore.textContent = player.banked + " G";
    el.rsBest.textContent = "B" + profile.deepest + "F";
    el.rsRank.textContent = titleFor(profile.deepest);
    // 新しい称号を獲得したか
    const newRank = titleFor(player.depthMax);
    if (newRank !== titleFor(prevDeepest)) {
      el.rsNewtitleName.textContent = newRank;
      show(el.rsNewtitle, true);
    } else {
      show(el.rsNewtitle, false);
    }
    updateHUD();
    show(el.ovResult, true);
    sfx(cleared ? "win" : "lose");
  }

  // ============================================================
  //  UI helpers
  // ============================================================
  function show(node, on) { node.hidden = !on; }

  function updateHUD() {
    const pct = Math.max(0, player.hp / player.maxHp) * 100;
    el.hpBar.style.width = pct + "%";
    el.hpBar.style.background = pct < 30 ? "var(--hp-low)" : "var(--hp)";
    el.hpText.textContent = player.hp + "/" + player.maxHp;
    el.gold.textContent = player.gold;
    el.bank.textContent = player.banked;
    el.depth.textContent = "B" + player.r + "F";
    el.weaponIcon.textContent = WEAPONS[player.weapon].emoji;
    el.armorIcon.textContent = ARMOR[player.armor].emoji;
    const wlv = player.weaponPlus[player.weapon] || 0;
    const alv = player.armorPlus[player.armor] || 0;
    const fxEmo = weaponFx(player.weapon).map((k) => EFFECTS[k].emoji).join("");
    const aeff = armorEffect(player.armor);
    el.weaponPlus.textContent = fxEmo + (wlv ? "+" + wlv : "");
    el.armorPlus.textContent = (aeff ? ARMOR_EFFECTS[aeff].emoji : "") + (alv ? "+" + alv : "");
  }

  // ============================================================
  //  Start / restart
  // ============================================================
  function startGame(warpDepth) {
    clearRun(); // 新規プレイは中断データを破棄
    rows = {};
    for (const k in enemyCache) delete enemyCache[k];
    for (const k in bossCache) delete bossCache[k];
    player = freshPlayer();
    pendingAwaken = null;
    const d = warpDepth | 0;
    if (d > 0) { player.r = d; player.depthMax = d; }
    ensureRow(d > 0 ? d : 0);
    if (d === 0) setTile(1, player.c, "dirt"); // 地表に掘る穴
    campOpenedAt = (d > 0 ? d : -1);
    lastBiomeName = biomeFor(player.r) ? biomeFor(player.r).name : null;
    floaters = [];
    anim = { fromR: player.r, fromC: player.c, t: 1, dur: 0.13 };
    camRow = player.r;
    state = "explore";
    show(el.ovTitle, false);
    show(el.ovResult, false);
    show(el.ovCombat, false);
    show(el.ovCamp, false);
    updateHUD();
    if (d > 0) setTimeout(openCamp, 200); // ワープ先の脱出ポイントを開く
  }

  // ---- ワープ ----
  function warpTarget() { return Math.floor((profile.deepest | 0) / CAMP_INTERVAL) * CAMP_INTERVAL; }
  function warpCost(d) { return d * 15; }
  function canWarp() { return warpTarget() >= 16; }
  function warpStart(target) {
    target = target | 0;
    const cost = warpCost(target);
    if (target < CAMP_INTERVAL || profile.bank < cost) return;
    profile.bank -= cost;
    persistProfile();
    startGame(target);
  }
  function openWarp() {
    const maxD = warpTarget();
    el.warpList.innerHTML = "";
    for (let d = maxD; d >= CAMP_INTERVAL; d -= CAMP_INTERVAL) {
      const cost = warpCost(d);
      const ok = profile.bank >= cost;
      const b = document.createElement("button");
      b.className = "btn warp-item";
      b.innerHTML = `<span>B${d}F</span><span>${cost}G</span>`;
      b.disabled = !ok;
      const dd = d;
      b.onclick = () => {
        if (confirm(`貯金 ${cost}G を払って B${dd}F へワープしますか？\n（着いたら金庫から引き出して装備を整えよう）`)) {
          closeWarp(); warpStart(dd);
        }
      };
      el.warpList.appendChild(b);
    }
    show(el.ovWarp, true);
  }
  function closeWarp() { show(el.ovWarp, false); }

  // 結果画面からタイトルへ戻る
  function goHome() {
    show(el.ovResult, false);
    show(el.ovCombat, false);
    show(el.ovCamp, false);
    state = "title";
    updateTitle();
    show(el.ovTitle, true);
  }

  // ---- 中断 / 再開 ----
  function hasRun() { return !!localStorage.getItem(RUN_KEY); }
  function clearRun() { try { localStorage.removeItem(RUN_KEY); } catch (_) {} }

  // 脱出ポイントで中断：ラン状態を保存してタイトルへ
  function suspendGame() {
    try { localStorage.setItem(RUN_KEY, JSON.stringify(player)); } catch (_) {}
    saveMoney();
    show(el.ovCamp, false);
    show(el.ovResult, false);
    show(el.ovCombat, false);
    state = "title";
    updateTitle();
    show(el.ovTitle, true);
  }

  // タイトルから中断データで再開：中断した階層（脱出ポイント）から
  function resumeRun() {
    let snap;
    try { snap = JSON.parse(localStorage.getItem(RUN_KEY)); } catch (_) { snap = null; }
    if (!snap) { updateTitle(); return; }
    clearRun(); // 一度きり（消費）
    player = snap;
    if (!Array.isArray(player.weaponPlus)) player.weaponPlus = [];
    if (!Array.isArray(player.armorPlus)) player.armorPlus = [];
    rows = {};
    for (const k in enemyCache) delete enemyCache[k];
    for (const k in bossCache) delete bossCache[k];
    ensureRow(player.r);
    campOpenedAt = -1;
    lastBiomeName = biomeFor(player.r) ? biomeFor(player.r).name : null;
    floaters = [];
    anim = { fromR: player.r, fromC: player.c, t: 1, dur: 0.13 };
    camRow = player.r;
    state = "explore";
    show(el.ovTitle, false);
    show(el.ovResult, false);
    show(el.ovCombat, false);
    updateHUD();
    openCamp(); // 中断した脱出ポイントを再表示
  }

  // ============================================================
  //  Input
  // ============================================================
  function bindHold(node, fn) {
    let active = false;
    const on = (e) => { e.preventDefault(); if (active) return; active = true; node.classList.add("pressed"); fn(); };
    const off = (e) => { if (e) e.preventDefault(); active = false; node.classList.remove("pressed"); };
    node.addEventListener("pointerdown", on);
    node.addEventListener("pointerup", off);
    node.addEventListener("pointerleave", off);
    node.addEventListener("pointercancel", off);
  }

  document.querySelectorAll(".dbtn").forEach((b) => {
    bindHold(b, () => tryMove(b.dataset.dir));
  });

  // keyboard (desktop testing)
  window.addEventListener("keydown", (e) => {
    const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
    if (state === "explore" && map[e.key]) { e.preventDefault(); tryMove(map[e.key]); }
    else if (state === "combat") { if (e.key === " " || e.key === "Enter") playerAttack(); if (e.key === "Escape") flee(); }
  });

  el.btnStart.addEventListener("click", () => {
    if (hasRun() && !confirm("中断データがあります。新しく始めると中断データは消えます。よろしいですか？")) return;
    startGame();
  });
  el.btnRetry.addEventListener("click", () => startGame());
  el.btnHome.addEventListener("click", goHome);
  el.btnReset.addEventListener("click", () => {
    if (!confirm("貯金と記録をすべて消してリセットしますか？（図鑑は残ります）")) return;
    const keepDex = profile.dex; // 図鑑コレクションは残す
    profile = defaultProfile();
    profile.dex = keepDex;
    persistProfile();
    player = freshPlayer();
    updateTitle();
    updateHUD();
  });
  el.btnDex.addEventListener("click", openDex);
  el.btnDexClose.addEventListener("click", closeDex);
  el.btnResume.addEventListener("click", resumeRun);
  el.btnSuspend.addEventListener("click", suspendGame);
  el.btnWarp.addEventListener("click", openWarp);
  el.btnWarpClose.addEventListener("click", closeWarp);
  el.btnAttack.addEventListener("click", playerAttack);
  el.btnFlee.addEventListener("click", flee);
  el.btnEscape.addEventListener("click", escapeGame);
  el.btnContinue.addEventListener("click", continueDig);
  depSlider = makeSlider("dep-slider", (v) => { el.depAmt.textContent = v; el.btnDeposit.disabled = v <= 0; });
  wdSlider = makeSlider("wd-slider", (v) => { el.wdAmt.textContent = v; el.btnWithdraw.disabled = v <= 0; });
  el.btnDeposit.addEventListener("click", deposit);
  el.btnWithdraw.addEventListener("click", withdraw);

  // prevent gesture scroll/zoom — but allow scrolling inside scroll areas (shop list)
  document.addEventListener("touchmove", (e) => {
    if (e.target.closest && e.target.closest(".scroll-area")) return;
    e.preventDefault();
  }, { passive: false });
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("dblclick", (e) => e.preventDefault());

  // ============================================================
  //  Tiny WebAudio SFX
  // ============================================================
  let actx = null;
  function sfx(kind) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      const o = actx.createOscillator(), g = actx.createGain();
      o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime;
      const set = (type, f0, f1, dur, vol) => {
        o.type = type; o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.start(t); o.stop(t + dur);
      };
      switch (kind) {
        case "dig": set("square", 180, 90, 0.08, 0.05); break;
        case "coin": set("square", 880, 1320, 0.12, 0.06); break;
        case "heal": set("sine", 520, 880, 0.18, 0.06); break;
        case "hit": set("square", 320, 120, 0.1, 0.07); break;
        case "hurt": set("sawtooth", 200, 70, 0.18, 0.07); break;
        case "bump": set("square", 110, 70, 0.07, 0.05); break;
        case "win": set("square", 660, 1320, 0.4, 0.07); break;
        case "lose": set("sawtooth", 300, 60, 0.5, 0.07); break;
        default: set("square", 300, 200, 0.06, 0.04);
      }
    } catch (_) { /* ignore */ }
  }

  // ============================================================
  //  Boot
  // ============================================================
  function updateTitle() {
    el.bestTitle.textContent = profile.bank;
    el.deepestTitle.textContent = "B" + profile.deepest + "F";
    el.rankTitle.textContent = titleFor(profile.deepest);
    // 中断データがあれば再開ボタンを表示
    let floor = 0;
    if (hasRun()) {
      try { floor = (JSON.parse(localStorage.getItem(RUN_KEY)) || {}).r | 0; } catch (_) {}
      el.resumeFloor.textContent = "B" + floor + "F";
      show(el.btnResume, true);
    } else {
      show(el.btnResume, false);
    }
    // ワープボタン（到達済みの脱出ポイントを選んで開始）
    if (canWarp()) {
      el.btnWarp.innerHTML = `🌀 ワープ（〜B${warpTarget()}F）`;
      el.btnWarp.disabled = profile.bank < warpCost(CAMP_INTERVAL);
      show(el.btnWarp, true);
    } else {
      show(el.btnWarp, false);
    }
  }

  // ---- まもの図鑑 ----
  const ALL_ENEMIES = ENEMY_TIERS.flatMap((t) => t.list).concat(BIOME_ENEMIES.flat()); // [[name,emoji],...]
  function openDex() {
    const seen = new Set(profile.dex);
    const got = ALL_ENEMIES.filter(([name]) => seen.has(name)).length; // 削除済みの名前は数えない
    el.dexCount.textContent = got + "/" + ALL_ENEMIES.length;
    el.dexGrid.innerHTML = "";
    ALL_ENEMIES.forEach(([name, emoji]) => {
      const got = seen.has(name);
      const cell = document.createElement("div");
      cell.className = "dex-cell" + (got ? "" : " unknown");
      cell.innerHTML = `<div class="dex-emoji">${got ? emoji : "❓"}</div><div class="dex-name">${got ? name : "？？？"}</div>`;
      el.dexGrid.appendChild(cell);
    });
    show(el.ovDex, true);
  }
  function closeDex() { show(el.ovDex, false); }

  updateTitle();
  player = freshPlayer();
  ensureRow(0);
  resize();
  requestAnimationFrame(loop);
})();
