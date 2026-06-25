"use strict";
(() => {
  // ============================================================
  //  埋蔵金ディガー  -  dig deep, fight, loot, escape.
  // ============================================================

  const COLS = 7;
  const CAMP_INTERVAL = 8; // 脱出ポイント every N floors
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
    btnResume: $("btn-resume"), resumeFloor: $("resume-floor"), btnSuspend: $("btn-suspend"),
    ovDex: $("ov-dex"), dexGrid: $("dex-grid"), dexCount: $("dex-count"), btnDexClose: $("btn-dex-close"),
    rsRank: $("rs-rank"), rsNewtitle: $("rs-newtitle"), rsNewtitleName: $("rs-newtitle-name"),
    ovCombat: $("ov-combat"), enemyEmoji: $("enemy-emoji"), enemyName: $("enemy-name"),
    enemyHpBar: $("enemy-hp-bar"), enemyHpText: $("enemy-hp-text"), combatLog: $("combat-log"),
    btnAttack: $("btn-attack"), btnFlee: $("btn-flee"),
    ovCamp: $("ov-camp"), campSub: $("camp-sub"), shop: $("shop"),
    btnEscape: $("btn-escape"), btnContinue: $("btn-continue"),
    bankBanked: $("bank-banked"), bankCarry: $("bank-carry"), bankWdAvail: $("bank-wd-avail"),
    depAmt: $("dep-amt"), btnDeposit: $("btn-deposit"),
    wdAmt: $("wd-amt"), btnWithdraw: $("btn-withdraw"),
    ovResult: $("ov-result"), resultTitle: $("result-title"), resultEmoji: $("result-emoji"),
    rsDepth: $("rs-depth"), rsScore: $("rs-score"), rsBest: $("rs-best"), btnRetry: $("btn-retry"),
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
  ];

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

  // ---- Enemy pools by depth tier (やさしい見た目のマイルドな魔物) ----
  const ENEMY_TIERS = [
    { until: 8,  list: [["スライム","🟢"],["ぷちうさぎ","🐰"],["おおねずみ","🐭"],["ひよこどり","🐤"]] },
    { until: 16, list: [["スライムベス","🔵"],["かえる兵","🐸"],["こねこマージ","🐱"],["ことり","🐦"]] },
    { until: 28, list: [["おばけ","👻"],["きつねび","🦊"],["ホイミん","🐡"],["ぺんぎん兵","🐧"]] },
    { until: 44, list: [["ゴーレム","🤖"],["くまナイト","🐻"],["ふくろう卿","🦉"],["ぶたメイジ","🐷"]] },
    { until: 64, list: [["こりゅう","🐲"],["ゆきだるま","⛄"],["かぼちゃ魔人","🎃"],["インベーダー","👾"]] },
    { until: Infinity, list: [["りゅうおう","🐉"],["まおうさま","🦹"],["ユニコーン","🦄"],["ぬし","🐳"]] },
  ];

  // ---- Tile types ----
  // dirt, empty, rock, gold, gem, heart, enemy, surface
  function pickEnemy(depth) {
    const tier = ENEMY_TIERS.find((t) => depth < t.until);
    const e = tier.list[(Math.random() * tier.list.length) | 0];
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
  let pendingMove = null;
  let profile = loadProfile();

  // ---- persistent profile ----
  // お金(貯金)は常に持ち越し。装備は「脱出（クリア）」したときだけ持ち越す。図鑑は常に蓄積。
  function baseGear() {
    return { weapon: 0, owned: [true], armor: 0, ownedArmor: [true], maxHp: 30,
             weaponPlus: [], armorPlus: [] };
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
             depthMax: 0 };
  }

  // ---- effective stats with + enhancement ----
  function wStep(i) { return Math.max(2, Math.round(WEAPONS[i].power * 0.12)); }
  function aStep(i) { return Math.max(1, Math.round((ARMOR[i].def || 1) * 0.18)); }
  function weaponPower() {
    const i = player.weapon;
    return WEAPONS[i].power + (player.weaponPlus[i] || 0) * wStep(i);
  }
  function armorDef() {
    const i = player.armor;
    return ARMOR[i].def + (player.armorPlus[i] || 0) * aStep(i);
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

  function dirtColor(r) {
    const l = Math.max(11, 30 - r * 0.45);
    return `hsl(26, 42%, ${l}%)`;
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
    if (t === "empty" || t === "camp" || t === "enemy" || t === "gold" || t === "gem" || t === "heart") {
      // dug-out / cave background
      ctx.fillStyle = `hsl(26, 35%, ${Math.max(7, 18 - r * 0.3)}%)`;
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
    }
  }

  // deterministic-ish enemy appearance per cell (so it doesn't flicker)
  const enemyCache = {};
  function enemyDataFor(r, c) {
    const k = r + "," + c;
    if (!enemyCache[k]) enemyCache[k] = pickEnemy(r);
    return enemyCache[k];
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
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
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
    if (t === "enemy") { startCombat(nr, nc); return; }
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
    updateHUD();
    sfx("dig");
    if (rows[nr] && rows[nr].isCamp && campOpenedAt !== nr) {
      campOpenedAt = nr;
      setTimeout(openCamp, 160);
    }
  }

  // ============================================================
  //  Combat
  // ============================================================
  function startCombat(r, c) {
    const ed = enemyDataFor(r, c);
    const depth = r;
    const hp = Math.round((6 + depth * 2.4) * (0.9 + Math.random() * 0.25));
    combat = {
      r, c, name: ed.name, emoji: ed.emoji,
      hp, maxHp: hp,
      atk: Math.max(1, Math.round((1.5 + depth * 0.7) * (0.9 + Math.random() * 0.25))),
      reward: 30 + depth * 12 + ((Math.random() * (20 + depth * 5)) | 0),
      busy: false,
    };
    state = "combat";
    el.enemyEmoji.textContent = ed.emoji;
    el.enemyName.textContent = ed.name + `  (B${depth}F)`;
    el.combatLog.innerHTML = `<div>${ed.name} があらわれた！</div>`;
    updateEnemyHp();
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
    const dmg = Math.max(1, Math.round(weaponPower() * (0.8 + Math.random() * 0.4)));
    combat.hp -= dmg;
    el.enemyEmoji.classList.remove("hit"); void el.enemyEmoji.offsetWidth; el.enemyEmoji.classList.add("hit");
    logCombat(`${combat.name} に <span class="dmg">${dmg}</span> のダメージ！`);
    updateEnemyHp();
    sfx("hit");

    if (combat.hp <= 0) {
      setTimeout(() => winCombat(), 450);
      return;
    }
    // enemy retaliates
    setTimeout(() => enemyAttack(() => { combat.busy = false; setCombatButtons(true); }), 480);
  }

  function enemyAttack(done) {
    const raw = Math.max(1, Math.round(combat.atk * (0.8 + Math.random() * 0.4)));
    const def = armorDef();
    const dmg = Math.max(1, raw - def);
    player.hp -= dmg;
    shakeT = 0.6;
    const reduced = def > 0 && raw > dmg ? `（${ARMOR[player.armor].name}で-${raw - dmg}）` : "";
    logCombat(`${combat.name} の こうげき！ <span class="hurt">${dmg}</span> ダメージ${reduced}`);
    updateHUD();
    sfx("hurt");
    if (player.hp <= 0) { player.hp = 0; updateHUD(); setTimeout(gameOver, 500); return; }
    done && done();
  }

  function winCombat() {
    const reward = combat.reward;
    player.gold += reward;
    if (!profile.dex.includes(combat.name)) { profile.dex.push(combat.name); persistProfile(); }
    el.enemyHpBar.style.width = "0%";
    el.enemyHpText.textContent = "0/" + combat.maxHp;
    logCombat(`${combat.name} をたおした！ <span class="dmg">💰+${reward}G</span> を手に入れた！`);
    addFloater(combat.r, combat.c, "+" + reward + "G", "#f6c453");
    setTile(combat.r, combat.c, "empty");
    delete enemyCache[combat.r + "," + combat.c];
    updateHUD();
    sfx("coin");
    const tr = combat.r, tc = combat.c;
    // keep the panel up briefly so the reward is clearly seen
    setTimeout(() => {
      show(el.ovCombat, false);
      state = "explore";
      combat = null;
      doMoveTo(tr, tc);
    }, 850);
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
      (w) => `攻撃力 ${w.power}`);

    // --- armor ---
    el.shop.appendChild(shopHeader("🛡️ 防具（被ダメージ軽減）"));
    equipSection(ARMOR,
      (i) => player.ownedArmor[i], () => player.armor,
      (i) => { player.ownedArmor[i] = true; player.armor = i; },
      (i) => { player.armor = i; },
      (a) => `防御力 ${a.def}`);

    // --- enhancement (無限の金の使い道) ---
    el.shop.appendChild(shopHeader("🔨 強化（装備中のものを+強化）"));
    const wi = player.weapon, wlv = player.weaponPlus[wi] || 0, wcost = enhanceCostW(wi), wp = weaponPower();
    el.shop.appendChild(shopRow("⚔️", `${WEAPONS[wi].name} +${wlv}`, `攻撃力 ${wp} → ${wp + wStep(wi)}`, wcost,
      canAfford(wcost), false, () => { pay(wcost); player.weaponPlus[wi] = wlv + 1; afterPurchase(); }));
    const ai = player.armor, alv = player.armorPlus[ai] || 0, acost = enhanceCostA(ai), ap = armorDef();
    el.shop.appendChild(shopRow("🛡️", `${ARMOR[ai].name} +${alv}`, `防御力 ${ap} → ${ap + aStep(ai)}`, acost,
      canAfford(acost), false, () => { pay(acost); player.armorPlus[ai] = alv + 1; afterPurchase(); }));
  }

  // Generic weapon/armor list renderer
  function equipSection(list, isOwned, getEquipped, buyEquip, justEquip, descFn) {
    list.forEach((it, i) => {
      if (i === 0) return; // index 0 = starting gear, not for sale
      const owned = isOwned(i);
      const equipped = getEquipped() === i;
      const row = shopRow(it.emoji, it.name, descFn(it), it.cost,
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
    el.weaponPlus.textContent = wlv ? "+" + wlv : "";
    el.armorPlus.textContent = alv ? "+" + alv : "";
  }

  // ============================================================
  //  Start / restart
  // ============================================================
  function startGame() {
    clearRun(); // 新規プレイは中断データを破棄
    rows = {};
    for (const k in enemyCache) delete enemyCache[k];
    player = freshPlayer();
    ensureRow(0);
    // open up a starting hole below
    setTile(1, player.c, "dirt");
    campOpenedAt = -1;
    floaters = [];
    anim = { fromR: 0, fromC: player.c, t: 1, dur: 0.13 };
    camRow = 0;
    state = "explore";
    show(el.ovTitle, false);
    show(el.ovResult, false);
    show(el.ovCombat, false);
    show(el.ovCamp, false);
    updateHUD();
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
    ensureRow(player.r);
    campOpenedAt = -1;
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
  el.btnRetry.addEventListener("click", startGame);
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
  }

  // ---- まもの図鑑 ----
  const ALL_ENEMIES = ENEMY_TIERS.flatMap((t) => t.list); // [[name,emoji],...]
  function openDex() {
    const seen = new Set(profile.dex);
    el.dexCount.textContent = seen.size + "/" + ALL_ENEMIES.length;
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
