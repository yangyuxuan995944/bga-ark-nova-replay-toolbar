// ==UserScript==
// @name         BGA 回放快捷栏
// @namespace    ark-nova-three-seat-replay
// @version      1.4.0
// @description  在 BGA 已结束对局的原版回放底部添加前后步、跳步及键盘控制。
// @match        https://*.boardgamearena.com/archive/replay/*
// @match        https://*.boardgamearena.com/tablereplay*
// @match        https://*.boardgamearena.com/archive/archive/frame.html*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  const demo = document.currentScript?.dataset.demo === 'true';
  const bundled = null; // Local installer may include a replay preview index.
  const isBga = (host) => host === 'boardgamearena.com' || host.endsWith('.boardgamearena.com');
  const isReplay = (url) => isBga(url.hostname) && (/^\/archive\/replay\//.test(url.pathname) || url.pathname === '/tablereplay')
    && /^\d+$/.test(url.searchParams.get('table') || '');
  let shell = window;
  try { if (isReplay(new URL(window.top.location.href))) shell = window.top; } catch { /* isolated frame */ }
  const doc = shell.document;
  if (!demo && !isReplay(new URL(shell.location.href))) return;
  if (doc.getElementById('ark-replay-quickbar')) return;

  // The native buttons can be in the replay page itself or inside its game frame.
  const controller = () => {
    const find = (d) => {
      const next = d.getElementById('archive_next');
      return next ? { next, move: d.getElementById('move_nbr') } : null;
    };
    const direct = find(doc);
    if (direct) return direct;
    for (const frame of doc.querySelectorAll('iframe')) {
      try { if (frame.contentDocument) { const result = find(frame.contentDocument); if (result) return result; } }
      catch { /* cross-origin iframe */ }
    }
    return null;
  };

  const host = doc.createElement('div');
  host.id = 'ark-replay-quickbar';
  const root = host.attachShadow({mode:'open'});
  root.innerHTML = `<style>
  :host{all:initial;position:fixed!important;left:0;right:0;bottom:0;z-index:2147483000;display:block;pointer-events:none;color-scheme:light}
  *{box-sizing:border-box} .bar{position:relative;margin:0 auto 8px;width:min(540px,calc(100% - 16px));padding:8px 10px calc(8px + env(safe-area-inset-bottom,0px));pointer-events:auto;background:#16352b;color:#fff;border:1px solid #598070;border-radius:16px;box-shadow:0 5px 24px #081a1390;font:14px/1.25 -apple-system,BlinkMacSystemFont,system-ui,sans-serif}
  .head{display:flex;align-items:center;justify-content:space-between;margin:0 0 5px;min-height:24px} .head strong{font-size:13px;letter-spacing:.03em}
  .row{display:grid;grid-template-columns:minmax(60px,1fr) minmax(60px,1fr) minmax(62px,100px) 48px;gap:6px} .row[hidden]{display:none}
  button,input{font:inherit;border:0;border-radius:9px;height:46px;min-width:0}
  button{cursor:pointer;touch-action:manipulation;font-weight:700} button:disabled{opacity:.5;cursor:default}
  .prev{background:#d3e5db;color:#19392e}.next{background:#e1f3a5;color:#183628;font-size:17px}.jump{background:#d3e5db;color:#19392e}
  input{width:100%;padding:0 7px;text-align:center;background:#fff;color:#16352b;font-size:16px}
  .fold{color:#fff;background:transparent;height:28px;padding:0 4px;font-weight:500}.status{margin:5px 0 0;font-size:12px;color:#ffe5a9}.status:empty{display:none}
.keys{margin:6px 0 0;font-size:11px;color:#c7dfcf}.bar[data-folded] .keys{display:none}@media(pointer:coarse){.keys{display:none}}
  .bar[data-folded]{width:max-content;max-width:calc(100% - 16px);margin-right:8px}.bar[data-folded] .head{margin:0;gap:12px}
  .preview{margin:4px 0 8px;padding:8px 9px;background:#f2f7e9;color:#19392e;border-radius:10px}
  .preview[hidden]{display:none}.preview h3{margin:0 0 5px;font-size:13px}.preview ol{list-style:none;margin:0;padding:0;max-height:min(32vh,240px);overflow:auto;overscroll-behavior:contain}
  .preview li{padding:5px 4px;border-top:1px solid #d8e4d5;font-size:12px;line-height:1.35;overflow-wrap:anywhere}.preview li[data-target]{background:#e0edbc;border-radius:5px}.preview li strong{display:block}
  .preview-actions{display:flex;gap:6px;justify-content:flex-end;align-items:center;margin-top:6px}.preview-actions button{height:34px;padding:0 10px;background:#d7e4da;color:#19392e}.preview-actions .confirm{background:#1d573e;color:white}
  .import{margin:4px 0 0;font-size:12px}.import[hidden]{display:none}.import input{font-size:12px;height:auto;width:100%;padding:4px 0;text-align:left;background:transparent}
  :focus-visible{outline:2px solid #ffe6a9;outline-offset:2px}
  </style>
  <section class="bar" aria-label="BGA 回放快捷栏">
    <div class="head"><strong id="current" tabindex="-1">BGA 回放</strong><button class="fold" type="button" aria-expanded="true">收起 ▾</button></div>
    <section class="preview" hidden aria-label="跳转预览">
      <h3>跳转预览</h3><ol></ol>
      <div class="import" hidden><label>导入这局的 BGA 日志 JSON <input type="file" accept=".json,application/json" aria-label="导入 BGA 日志"></label></div>
      <div class="preview-actions"><button type="button" class="cancel">取消</button><button type="button" class="confirm">确认跳转</button></div>
    </section>
    <form class="row"><button type="button" class="prev">← 上一步</button><button type="button" class="next">下一步 →</button><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" placeholder="输入步数" aria-label="目标步数"><button class="jump" type="submit">预览</button></form>
    <p class="keys">← 上一步 · → 下一步 · Enter 下一位玩家</p>
    <p class="status" role="status"></p>
  </section>`;
  const get = (s) => root.querySelector(s);
  const prev = get('.prev'), next = get('.next'), input = get('.row input'), fold = get('.fold'), status = get('.status');
  let busyUntil = 0;
  let lastSingle = null;
  let activeSeek = null;
  const replayURL = new URL(shell.location.href);
  const table = replayURL.searchParams.get('table') || 'demo';
  const indexKey = 'ark-replay-preview-zh:' + table;
  let index = bundled?.table === table ? bundled : null;
  if (demo) {
    const actions = ['建造围栏','选择动物行动','支持保护项目','休息并结算收入'];
    const players = ['玩家 A','玩家 B','玩家 C'];
    const steps = Array.from({ length: 120 }, (_, i) => i + 1);
    index = {table, steps, rows: steps.map((n, i) => [n, [[players[Math.floor(i / 3) % 3], actions[i % 4]]]])};
  } else if (!index) {
    try { index = JSON.parse(shell.sessionStorage.getItem(indexKey) || 'null'); } catch {}
  }
  const trailKey = 'ark-replay-prev:' + (replayURL.searchParams.get('table') || 'demo') + ':' + (replayURL.searchParams.get('player') || '');
  let prior = {};
  try { prior = JSON.parse(shell.sessionStorage.getItem(trailKey) || '{}') || {}; } catch {}
  const seekKey = trailKey + ':seek';
  const openReplayMenu = (d, option) => {
    const advanced = d.getElementById('advanced_replay_features');
    if (advanced?.getClientRects().length) advanced.click();
    let target = d.getElementById(option);
    const menu = d.getElementById('archive_end_game');
    if (!target?.getClientRects().length && menu?.getClientRects().length) {
      menu.click();
      target = d.getElementById(option);
    }
    return target;
  };
  const fastSeek = (step) => {
    const d = controller()?.next.ownerDocument;
    if (!d) return false;
    if (d.querySelector('#askforvalue_dialog #choicedlg_value')) return false;
    const option = openReplayMenu(d, 'go_to_specific_move');
    if (!option) return false;
    option.click();
    const field = d.querySelector('#askforvalue_dialog #choicedlg_value');
    const ok = d.querySelector('#askforvalue_dialog #ok_btn');
    if (!field || !ok) return false;
    field.value = String(step);
    const now = Date.now();
    activeSeek = {step, last: Number(current()), changed: now, expires: now + 23000, corrected: false};
    ok.click();
    return true;
  };
  const seek = (step) => {
    if (activeSeek || Date.now() < busyUntil) return;
    status.textContent = `正在打开第 ${step} 步…`;
    busyUntil = Date.now() + 700;
    const url = new URL(shell.location.href);
    if (demo) {
      url.searchParams.set('goto', String(step));
      shell.location.assign(url.href);
      return;
    }
    if (step > Number(current())) {
      if (fastSeek(step)) return true;
      status.textContent = 'BGA 的快速跳步还没准备好，请稍后再试。';
      busyUntil = 0;
      return;
    }
    try {
      shell.sessionStorage.setItem(seekKey, JSON.stringify({step, expires: Date.now() + 30000}));
    } catch {
      status.textContent = '无法保存这次回退，请检查浏览器的站点存储权限。';
      return;
    }
    url.searchParams.delete('goto');
    if (url.href === shell.location.href) shell.location.reload();
    else shell.location.assign(url.href);
  };
  const resumeSeek = () => {
    let pending;
    try { pending = JSON.parse(shell.sessionStorage.getItem(seekKey) || 'null'); } catch {}
    if (!pending) return;
    const now = Number(current());
    if (Date.now() > pending.expires || now === pending.step ||
        (now > 0 && now < pending.step && fastSeek(pending.step))) {
      try { shell.sessionStorage.removeItem(seekKey); } catch {}
    }
  };
  const verifySeek = (move) => {
    const job = activeSeek;
    if (!job || !move) return;
    const now = Date.now();
    if (move >= job.step || now >= job.expires) {
      activeSeek = null;
      status.textContent = move === job.step ? `已到第 ${move} 步。` : `BGA 停在第 ${move} 步。`;
      return;
    }
    if (move !== job.last) { job.last = move; job.changed = now; }
    const before = index?.steps?.findLast((step) => step < job.step) ?? job.step - 1;
    const original = controller()?.next;
    if (!job.corrected && move === before && now - job.changed > 1500 && !nativeDisabled(original)) {
      job.corrected = true;
      original.click();
    }
  };
  const rewind = () => {
    const now = Number(current());
    if (activeSeek || !Number.isSafeInteger(now) || now <= 1 || Date.now() < busyUntil) return;
    const from = Number(prior[now]);
    const previous = index?.steps?.findLast((step) => step < now);
    seek(Number.isSafeInteger(from) && from >= 1 && from < now ? from : previous ?? now - 1);
  };
  prev.addEventListener('click', rewind);
  const current = () => controller()?.move?.textContent.trim().match(/\d+/)?.[0];
  const nativeDisabled = (element) => !element || element.disabled || element.getAttribute('aria-disabled') === 'true' || element.classList.contains('disabled');
  const sync = () => {
    attachKeys(doc);
    attachKeys(controller()?.next.ownerDocument);
    const now = current();
    if (lastSingle && Number(now) > lastSingle.step && Date.now() <= lastSingle.until) {
      prior[now] = lastSingle.step;
      try { shell.sessionStorage.setItem(trailKey, JSON.stringify(prior)); } catch {}
      lastSingle = null;
    } else if (lastSingle && Date.now() > lastSingle.until) lastSingle = null;
    verifySeek(Number(now));
    prev.disabled = !!activeSeek || !now || Number(now) <= 1 || Date.now() < busyUntil;
    get('#current').textContent = now ? `BGA 回放 · 第 ${now} 步` : 'BGA 回放';
    next.disabled = !!activeSeek || Date.now() < busyUntil || nativeDisabled(controller()?.next);
  };
  const advance = (toTurn = false) => {
    const original = controller()?.next;
    if (activeSeek || Date.now() < busyUntil || nativeDisabled(original)) return;
    status.textContent = '';
    if (toTurn) {
      const d = original.ownerDocument;
      const turn = openReplayMenu(d, 'go_to_new_turn');
      if (nativeDisabled(turn)) {
        status.textContent = '此时 BGA 未提供「跳到下一位玩家」选项。';
        return;
      }
      lastSingle = null;
      busyUntil = Date.now() + 300;
      turn.click();
    } else {
      const step = Number(current());
      lastSingle = step > 0 ? { step, until: Date.now() + 4000 } : null;
      busyUntil = Date.now() + 250;
      original.click();
    }
    sync();
  };
  next.addEventListener('click', () => advance());
  const keyDocuments = new WeakSet();
  const attachKeys = (targetDoc) => {
    if (!targetDoc || keyDocuments.has(targetDoc)) return;
    keyDocuments.add(targetDoc);
    targetDoc.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || event.isComposing || event.repeat ||
          event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const key = event.code === 'Numpad4' ? 'ArrowLeft' : event.code === 'Numpad6' ? 'ArrowRight' : event.key;
      if (!['Enter', 'ArrowLeft', 'ArrowRight'].includes(key)) return;
      const path = event.composedPath();
      if (path.some((el) => el.isContentEditable || el.matches?.('input, textarea, select, [role="textbox"], [role="combobox"], dialog[open]'))) return;
      if (key === 'Enter' && path.some((el) => el.matches?.('button, a[href], [role="button"]'))) return;
      if (!controller()) return;
      event.preventDefault();
      event.stopPropagation();
      if (key === 'ArrowLeft') rewind();
      else advance(key === 'Enter');
    }, true);
  };
  const preview = get('.preview'), previewList = get('.preview ol'), confirm = get('.confirm');
  const desired = () => {
    const s = input.value.trim();
    return /^\d{1,8}$/.test(s) && Number(s) > 0 ? Number(s) : null;
  };
  const rowMessage = (step, title, body, target = false) => {
    const row = doc.createElement('li');
    const titleEl = doc.createElement('strong');
    titleEl.textContent = title;
    row.append(titleEl, doc.createTextNode(body));
    if (target) row.dataset.target = '1';
    if (step) row.dataset.step = String(step);
    previewList.append(row);
  };
  const renderPreview = () => {
    const step = desired();
    preview.hidden = !step;
    previewList.replaceChildren();
    get('.import').hidden = !!index;
    if (!step) return;
    get('.preview h3').textContent = `第 ${step} 步 · 跳转预览`;
    confirm.disabled = Number(current()) === step || Boolean(index?.steps?.length && !index.steps.includes(step));
    if (index?.rows?.length) {
      if (step > index.steps.at(-1)) {
        rowMessage(null, '超出回放范围', `这局最后记录到第 ${index.steps.at(-1)} 步。`, true);
        return;
      }
      const show = ([n, events]) => {
        const summaries = events.slice(0, 3).map(([who, what]) => who ? `${who}：${what}` : what);
        if (events.length > 3) summaries.push(`另有 ${events.length - 3} 条`);
        rowMessage(n, `第 ${n} 步${n === step ? ' · 目标' : ''}`, summaries.join('；'), n === step);
      };
      index.rows.filter(([n]) => n < step).slice(-2).forEach(show);
      const target = index.rows.find(([n]) => n === step);
      if (target) show(target);
      else rowMessage(step, `第 ${step} 步 · 目标`, index.steps.includes(step)
        ? '这一步没有公开的文字行动。'
        : `BGA 日志跳过了这个编号。下一个记录步号是 ${index.steps.find((n) => n > step)}。`, true);
      index.rows.filter(([n]) => n > step).slice(0, 2).forEach(show);
    } else {
      rowMessage(step, '当前没有这局的行动预览', '可以导入此局的 BGA 日志，或确认后直接跳转。', true);
    }
  };
  // BEGIN PREVIEW LOCALIZATION
  const zhTemplates = new Map(Object.entries({
  "gains ${bonuses_desc} (${source})": "获得 ${bonuses_desc}（${source}）",
  "places action card ${action_card_name}${action_card_icon} at position ${position} (finishing action)": "结束行动，将「${action_card_name}」移到第 ${position} 格",
  "chooses action card ${action_card_name}${action_card_icon}${action_card_level} with strength ${strength_icon}${strength}": "选择「${action_card_name}${action_card_level}」行动（强度 ${strength}）",
  "gains ${bonuses_desc} (${card_name})": "获得 ${bonuses_desc}（${card_name}）",
  "The display is replenished with ${card_names}": "展示区补充：${card_names}",
  "gets ${bonus_desc} (${source})": "获得 ${bonus_desc}（${source}）",
  "plays ${card_name} for ${amount_money} and places it in ${building_names}": "支付 ${amount_money} 金币打出「${card_name}」，放入${building_names}",
  "gains ${bonuses_desc}": "获得 ${bonuses_desc}",
  "advances break token of ${n} space(s), now at ${break}/${maxBreak}": "休息标记推进 ${n} 格（现在为 ${break}/${maxBreak}）",
  "pays ${bonuses_desc} for ${source}": "支付 ${bonuses_desc}（${source}）",
  "snaps ${card_names} from the display": "从展示区精选：${card_names}",
  "pays ${amount_money} for building ${building_name}": "花费 ${amount_money} 金币建造 ${building_name}",
  "draws ${n} card(s) from the deck": "从牌堆抽 ${n} 张牌",
  "upgrades ${action_card_name}${action_card_icon}${action_card_level}": "升级「${action_card_name}${action_card_level}」行动卡",
  "discards ${n} cards during break": "休息时弃掉 ${n} 张牌",
  "supports a conservation project on ${slot} : ${card_name}": "支持保护项目「${card_name}」（${slot}）",
  "adds ${building_name} for free": "免费建造${building_name}",
  "takes a new university": "获得一所大学",
  "plays ${card_name}": "打出「${card_name}」",
  "gets ${bonus_desc}": "获得 ${bonus_desc}",
  "donates ${bonuses_desc} to get ${bonuses2_desc}": "捐赠 ${bonuses_desc}，获得 ${bonuses2_desc}",
  "discards ${n} card(s)": "弃掉 ${n} 张牌",
  "takes ${card_names} in reputation range from the display": "从展示区声望范围内拿取：${card_names}",
  "takes a new Partner zoo": "获得一座合作动物园",
  "gains a new Association worker": "获得一名协会工作人员",
  "draws ${card_names} sponsor card(s) from the deck (Map 8 effect)": "从牌堆抽取赞助商牌「${card_names}」（8 号地图效果）",
  "advances break token of ${n} space(s) and reach the last space of the Break track. At the end of the turn, all players must take a break": "休息标记推进 ${n} 格并到达终点，本回合结束后所有玩家休息",
  "Starting a new break": "开始休息",
  "All tokens are removed from player cards": "移除玩家卡牌上的标记",
  "All workers go back to each player's reserve": "所有协会工作人员返回各自的储备区",
  "Replenishing partner zoos and universities": "补充合作动物园和大学",
  "Removing first two cards of the display: ${card_names}": "移除展示区最前面的两张牌：${card_names}",
  "End of the break": "休息结束",
  "adds ${building_name} (${card_name})": "建造${building_name}（${card_name}）",
  "increase the size of a ${building_name}": "扩建${building_name}",
  "plays a new conservation project: ${card_names}": "打出新保护项目：${card_names}",
  "cannot exceed 9 reputation": "声望不能超过 9",
  "will play with action cards: ${action_cards_names}": "选择本局行动卡：${action_cards_names}",
  "draws ${n} scoring cards from the deck": "从牌堆抽 ${n} 张终局计分卡",
  "discards 4 cards (initial selection)": "弃掉 4 张牌（开局选牌）",
  "triggers its reef abilities": "触发自己的珊瑚礁能力",
  "marks ${card_names} from display": "标记展示区卡牌：${card_names}",
  "places ${action_card_name}${action_card_icon} at position ${position} (Boost effect)": "将「${action_card_name}」移到第 ${position} 格（强化效果）",
  "discards 1 scoring card": "弃掉 1 张终局计分卡",
  "has ${appeal}<APPEAL> and scores ${conservationScore} for having ${conservation}<CONSERVATION>. ${player_name} scores ${newScore}.": "拥有 ${appeal} 点吸引力；${conservation} 点保护值折算为 ${conservationScore} 分；最终得分 ${newScore}",
  "draws 1 <${type}> card for gaining a new university: ${card_names}": "因获得新大学而抽取 1 张${type}牌：${card_names}",
  "draws ${n} cards for scuba dive effect": "因潜水效果抽 ${n} 张牌",
  "draws ${n} card(s) for hunter effect": "因狩猎效果抽 ${n} 张牌",
  "keeps ${card_name} card and discard ${n} card(s) for hunter effect": "保留「${card_name}」，弃掉 ${n} 张牌（狩猎效果）",
  "gains ${bonuses_desc} for their mark on ${card_name}": "因标记「${card_name}」获得 ${bonuses_desc}",
  "discards 1 card to play a Sponsor card for money (Sponsors4 effect)": "弃掉 1 张牌，用金币打出一张赞助商牌（赞助商 4 效果）",
  "Removing ${n} cards of the display due to Wave icons reveal: ${card_names}": "因翻出波浪图标，从展示区移除 ${n} 张牌：${card_names}",
  "digs ${card_names} from the display": "从展示区挖掘：${card_names}",
  "Starting the first round of action cards draft phase.": "开始第一轮行动卡轮抽",
  "Starting the second round of action cards draft phase.": "开始第二轮行动卡轮抽",
  "discards all ${n} card(s) of hunter effect (no sponsor)": "弃掉狩猎抽到的全部 ${n} 张牌（无赞助商）",
  "draws 1 <${type}> card: ${card_names} (${source})": "抽取 1 张${type}牌：${card_names}（${source}）",
  "triggers its reef abilities (conservation project reward)": "触发自己的珊瑚礁能力（保护项目奖励）",
  "focuses on large animals and won't be able to play small animal from now on": "专注大型动物，此后不能打出小型动物",
  "draws ${card_names} animal card from the deck (Waza Special Assignement effect)": "从牌堆抽取动物牌「${card_names}」（WAZA 特别任务效果）",
  "buys ${card_name} from display": "从展示区购买「${card_name}」",
  "discards ${card_names} for the Shark Attack effect": "因鲨鱼袭击效果弃掉：${card_names}",
  "keeps ${card_name} card and discard ${n} card(s) for scuba dive effect": "保留「${card_name}」，弃掉 ${n} 张牌（潜水效果）",
  "draws ${n} card(s) from discard for scavenging effect": "因食腐效果从弃牌堆抽取 ${n} 张牌",
  "keeps 1 card and discards ${n} card(s) for scavenging effect": "保留 1 张牌，弃掉 ${n} 张牌（食腐效果）",
  "cannot have more than 5 x-tokens": "X 标记不能超过 5 个",
  "triggers scoring card discard by reaching 10 conservation points": "达到 10 点保护值，触发弃置终局计分卡",
  "moves ${card_name} into the ${building_name} and free ${building_names}": "将「${card_name}」移入${building_name}，腾出${building_names}",
  "draws ${n} card(s) for perception effect": "因感知效果抽 ${n} 张牌",
  "keeps ${m} card(s) and discard ${n} card(s) for perception effect": "保留 ${m} 张牌，弃掉 ${n} 张牌（感知效果）",
  "sells ${n} card(s) for ${bonuses_desc}": "卖掉 ${n} 张牌，获得 ${bonuses_desc}",
  "releases ${card_name} into the wild and loses ${bonuses_desc} and frees ${building_names}": "放归「${card_name}」，失去 ${bonuses_desc}，腾出${building_names}",
  "${card_names} is not discarded and given to ${player_name} (Mark effect)": "「${card_names}」未被弃置，改由 ${player_name} 获得（标记效果）",
  "places ${action_card_name}${action_card_icon} at position ${position} (Clever effect)": "将「${action_card_name}」移到第 ${position} 格（聪明效果）",
  "gets an extra action (${card_name})": "获得一次额外行动（${card_name}）",
  "uses ${bonus_desc}": "使用 ${bonus_desc}",
  "End of game triggered: everyone except ${player_name} will get a last turn to play": "${player_name} 触发终局，其他玩家各再行动一回合",
  "The rightmost project card is discarded: ${card_names}": "弃置最右侧项目卡：${card_names}",
  "End of game": "游戏结束",
  "a size-${n} enclosure": "${n} 格饲养区",
  "${bonus}${bonus_icon} ${bonus_name}": "${bonus} ${bonus_name}",
  "${actionCard0}, ${actionCard1}, ${actionCard2}, ${actionCard3} and ${actionCard4}": "${actionCard0}、${actionCard1}、${actionCard2}、${actionCard3}、${actionCard4}"
}));
  const zhTerms = new Map(Object.entries({
    Build:'建造', Animals:'动物', Cards:'卡牌', Association:'协会', Sponsors:'赞助商',
    money:'金币', xtoken:'X 标记', conservation:'保护值', appeal:'吸引力', reputation:'声望',
    Snapping:'精选', 'upgrade-card':'升级行动卡', 'size-2':'建造 2 格饲养区', 'size-3':'建造 3 格饲养区',
    'add-worker':'增加协会工作人员', 'take-in-range-or-deck':'从声望范围内或牌堆拿牌',
    'bonus-icon':'图标奖励', DISCARD_SCORING:'弃置终局计分卡',
    'the first slot':'第 1 档', 'the second slot':'第 2 档', 'the third slot':'第 3 档',
    'reputation track bonus':'声望轨奖励', 'appeal income':'吸引力收入', 'map bonus space':'地图奖励格',
    'placement bonus':'覆盖奖励', 'increasing card strength':'提高行动强度', 'max strength Animals':'满强度动物行动',
    'triggering break':'触发休息', 'from university':'大学奖励', 'kiosk income':'售货亭收入',
    'maxing out reputation':'达到声望上限', 'Sponsors2 effect':'赞助商 2 效果', 'building a pavilion':'建造展亭',
    university:'大学', University:'大学', 'adding a new conservation project':'添加保护项目',
    'Sea Animals':'海洋动物', 'buying sponsor card':'购买赞助商牌', Birds:'鸟类',
    'partner zoo':'合作动物园', 'playing sponsor from reputation range':'在声望范围内打出赞助商',
    'Shark Attack':'鲨鱼袭击', 'Iconic animal':'标志性动物', Jungle:'丛林', Europe:'欧洲',
    'last worker bonus':'最后一名工作人员奖励', 'the large aquarium':'大型水族馆',
    'a pavilion':'展亭', 'the Large Bird Aviary':'大型鸟舍', 'a unique building':'独特建筑',
    'a Kiosk':'售货亭', SEAANIMAL:'海洋动物', BIRD:'鸟类', large:'大型'
  }));
  const localizedLog = (template, args, depth = 0) => {
    if (depth > 8 || typeof template !== 'string') return '';
    const body = depth === 0 ? template.replace(/^\$\{player_name\}\s+/, '') : template;
    const localized = zhTemplates.get(body);
    return (localized ?? body).replace(/\$\{([a-zA-Z_0-9]+)\}/g, (_, k) => {
      const v = args?.[k];
      if (typeof v === 'number') return String(v);
      if (typeof v !== 'string') return localizedLog(v?.log, v?.args, depth + 1);
      if (k === 'bonus_raw_desc') {
        const bonus = v.match(/^(\d+)\s+x\s+(.+)$/);
        if (bonus && zhTerms.has(bonus[2])) return bonus[2] === 'DISCARD_SCORING' ? zhTerms.get(bonus[2]) : `${bonus[1]} × ${zhTerms.get(bonus[2])}`;
      }
      if (/^action_card_level$/.test(k)) return v ? ` ${v}` : '';
      return ['source','action_card_name','actionCardType','bonus_name','building_name','slot','type'].includes(k)
        ? zhTerms.get(v.trim()) ?? v : v;
    });
  };
  const buildPreviewIndex = (data, table) => {
    if (!Array.isArray(data?.logs) || !data.logs.length ||
        data.logs.some((p) => String(p?.table_id) !== table)) throw new Error('请选择当前桌号的 BGA 原始回放 JSON。');
    const steps = new Set(), rows = new Map();
    for (const p of data.logs) {
      const n = Number(p.move_id);
      if (!Number.isSafeInteger(n) || n < 1) continue;
      steps.add(n);
      if (p.channel !== '/table/t' + table || !Array.isArray(p.data)) continue;
      for (const e of p.data) {
        const who = typeof e?.args?.player_name === 'string' ? e.args.player_name.slice(0, 80) : '';
        const what = localizedLog(e?.log, e?.args).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (!what) continue;
        if (!rows.has(n)) rows.set(n, []);
        rows.get(n).push([who, what.slice(0, 300)]);
      }
    }
    if (!rows.size) throw new Error('日志里没有可显示的公共行动。');
    return {table, steps: [...steps].sort((a,b) => a-b), rows: [...rows].sort((a,b) => a[0]-b[0])};
  };
  // END PREVIEW LOCALIZATION
  get('.import input').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 50_000_000) throw new Error('文件太大。');
      index = buildPreviewIndex(JSON.parse(await file.text()).data, table);
      try { shell.sessionStorage.setItem(indexKey, JSON.stringify(index)); } catch {}
      status.textContent = '已导入这局的公共行动。';
      renderPreview();
    } catch (error) { status.textContent = error.message || '无法读取日志。'; }
    event.target.value = '';
  });
  get('form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!desired()) { status.textContent = '请输入大于 0 的步数。'; input.focus(); return; }
    renderPreview();
    if (!confirm.disabled) confirm.focus();
  });
  confirm.addEventListener('click', () => {
    const step = desired();
    if (preview.hidden || !step || confirm.disabled || activeSeek || Date.now() < busyUntil) return;
    input.value = '';
    renderPreview();
    get('#current').focus({preventScroll:true});
    seek(step);
  });
  get('.cancel').addEventListener('click', () => {
    input.value = '';
    renderPreview();
    input.focus();
  });
  input.addEventListener('input', () => { status.textContent = ''; renderPreview(); });
  fold.addEventListener('click', () => {
    const row = get('.row');
    row.hidden = !row.hidden;
    get('.bar').toggleAttribute('data-folded', row.hidden);
    fold.textContent = row.hidden ? '展开 ▴' : '收起 ▾';
    fold.setAttribute('aria-expanded', String(!row.hidden));
    status.hidden = row.hidden;
    if (row.hidden) preview.hidden = true;
    else renderPreview();
  });

  // Wait for the native replay controls. No toolbar on error pages or live tables.
  const mount = () => {
    if (!controller() || !doc.body) return false;
    if (!doc.getElementById(host.id)) {
      doc.body.append(host);
      sync();
      shell.setInterval(() => { sync(); resumeSeek(); }, 250);
    }
    return true;
  };
  if (!mount()) {
    let attempts = 0;
    const timer = shell.setInterval(() => {
      if (mount() || ++attempts >= 180) shell.clearInterval(timer);
    }, 500);
  }
})();
