// HUD 界面
import { TOOL_GROUPS, TOOLS, SPECIALS, QUESTS, MILESTONES, ZONE_NAMES, LEVEL_NAMES, ZONE_STATS } from '../core/config.js';
import { formatMoney } from '../core/utils.js';

const $ = (s) => document.querySelector(s);

export class UI {
  constructor(game) {
    this.game = game;
    this.group = null;
    this.infoTile = null;
    this.view = null;
    this.buildToolbar();
    this.bindTop();
    this.renderQuests();
  }

  get city() { return this.game.city; }

  buildToolbar() {
    const tb = $('#toolbar');
    tb.innerHTML = '';
    for (const g of TOOL_GROUPS) {
      const b = document.createElement('button');
      b.className = 'tbtn';
      b.dataset.g = g.id;
      b.innerHTML = `<i>${g.icon}</i><span>${g.name}</span>`;
      b.onclick = () => this.openGroup(g.id);
      tb.appendChild(b);
    }
  }

  openGroup(id) {
    const g = TOOL_GROUPS.find((x) => x.id === id);
    this.game.audio.play('click');
    if (g.tools.length === 1) {
      this.closeSub();
      this.group = id;
      this.game.input.setTool(this.game.input.tool === g.tools[0] ? 'select' : g.tools[0]);
      return;
    }
    if (this.group === id && !$('#subpanel').classList.contains('hidden')) {
      this.closeSub();
      this.game.input.setTool('select');
      return;
    }
    this.group = id;
    if (!g.tools.includes(this.game.input.tool)) this.game.input.setTool('select');
    this.renderSub();
    $('#subpanel').classList.remove('hidden');
    document.querySelectorAll('.tbtn').forEach((b) => b.classList.toggle('on', b.dataset.g === id));
  }

  renderSub() {
    const g = TOOL_GROUPS.find((x) => x.id === this.group);
    if (!g) return;
    const sp = $('#subpanel');
    sp.innerHTML = '';
    for (const t of g.tools) {
      const def = TOOLS[t];
      const c = document.createElement('div');
      const locked = def.special && def.unlock > this.city.maxPop;
      c.className = 'card' + (def.zone ? ' z' + def.zone : '') + (locked ? ' locked' : '') + (this.game.input && this.game.input.tool === t ? ' on' : '');
      c.dataset.t = t;
      let price = '';
      if (def.special) price = locked ? `🔒 人口 ${def.unlock}` : formatMoney(def.cost);
      else if (def.zone) price = '¥2 / 格';
      else price = '免费';
      let desc = def.desc || '';
      if (def.special) desc += `<br><span style="color:#9fb0c3">维护费 ¥${def.upkeep}/天 · 占地 ${def.size}×${def.size}</span>`;
      c.innerHTML = `<div class="bar"></div><div class="ic">${def.icon}</div><div class="nm">${def.name}</div><div class="pr">${price}</div><div class="desc">${desc}</div>`;
      c.onclick = () => {
        this.game.audio.play('click');
        if (locked) { this.toast(`🔒 人口达到 ${def.unlock} 后解锁「${def.name}」`, 'warn'); return; }
        this.game.input.setTool(this.game.input.tool === t ? 'select' : t);
      };
      sp.appendChild(c);
    }
  }

  closeSub() {
    $('#subpanel').classList.add('hidden');
    this.group = null;
    document.querySelectorAll('.tbtn').forEach((b) => b.classList.remove('on'));
  }

  setActiveTool(t) {
    document.querySelectorAll('.card').forEach((c) => c.classList.toggle('on', c.dataset.t === t));
    const gid = TOOL_GROUPS.find((g) => g.tools.includes(t))?.id;
    document.querySelectorAll('.tbtn').forEach((b) => {
      const g = TOOL_GROUPS.find((x) => x.id === b.dataset.g);
      b.classList.toggle('on', (g.tools.length === 1 && g.tools[0] === t) || (b.dataset.g === this.group && !$('#subpanel').classList.contains('hidden')) || (gid === b.dataset.g && t !== 'select'));
    });
    if (t === 'select' && this.group && TOOL_GROUPS.find((g) => g.id === this.group).tools.length === 1) this.group = null;
  }

  closePanels() {
    this.closeSub();
    $('#budget').classList.add('hidden');
  }

  bindTop() {
    document.querySelectorAll('#speed button').forEach((b) => {
      b.onclick = () => { this.game.setSpeed(+b.dataset.s); this.game.audio.play('click'); };
    });
    $('#stat-money').onclick = () => this.toggleBudget();
    $('#btn-save').onclick = () => { this.game.save(); this.toast('💾 城市已保存', 'good'); };
    $('#btn-sound').onclick = () => {
      const on = this.game.audio.toggle();
      $('#btn-sound').textContent = on ? '🔊' : '🔇';
    };
    $('#btn-quality').onclick = () => {
      const q = this.game.env.quality === 'high' ? 'low' : 'high';
      this.game.env.setQuality(q);
      this.toast(q === 'high' ? '✨ 高画质' : '⚡ 性能模式', 'good');
    };
    $('#btn-menu').onclick = () => this.menu();
    document.querySelectorAll('#views button').forEach((b) => {
      b.onclick = () => {
        const v = b.dataset.v;
        this.view = this.view === v ? null : v;
        document.querySelectorAll('#views button').forEach((x) => x.classList.toggle('on', x.dataset.v === this.view));
        this.game.view.overlay.setHeat(this.view, this.city);
        this.game.audio.play('click');
      };
    });
    $('#quests .panel-title').onclick = () => $('#quests').classList.toggle('collapsed');
  }

  refreshHeat() { if (this.view) this.game.view.overlay.setHeat(this.view, this.city); }

  setSpeedButtons(s) {
    document.querySelectorAll('#speed button').forEach((b) => b.classList.toggle('on', +b.dataset.s === s));
  }

  // 每帧（节流）更新数值
  update() {
    const c = this.city, s = c.stats;
    const m = $('#money');
    m.textContent = formatMoney(c.money);
    m.classList.toggle('neg', c.money < 0);
    const net = c.budget.income - c.budget.expense;
    const md = $('#money-delta');
    md.textContent = (net >= 0 ? '+' : '') + Math.round(net) + '/天';
    md.className = net >= 0 ? 'pos' : 'neg';
    $('#pop').textContent = s.pop.toLocaleString();
    const h = Math.round(s.happiness);
    $('#happy').textContent = h + '%';
    $('#happy-icon').textContent = h >= 75 ? '😄' : h >= 55 ? '🙂' : h >= 35 ? '😐' : '😠';
    const pw = $('#power');
    pw.textContent = `${s.powerUse}/${s.powerCap}`;
    pw.style.color = s.powerCap === 0 || s.powerUse >= s.powerCap * 0.95 ? 'var(--bad)' : '';
    $('#clock').textContent = c.timeText;
    $('#date').textContent = c.dateText;
    const d = c.demand;
    document.querySelector('#demand .r i').style.height = 6 + d.R * 94 + '%';
    document.querySelector('#demand .c i').style.height = 6 + d.C * 94 + '%';
    document.querySelector('#demand .i i').style.height = 6 + d.I * 94 + '%';
    // 里程碑进度
    const mi = c.milestone;
    const prev = mi > 0 ? MILESTONES[mi - 1].pop : 0;
    const next = MILESTONES[mi];
    const bar = $('#milestone-bar');
    if (next) {
      const p = Math.min(1, (s.pop - prev) / (next.pop - prev));
      bar.querySelector('i').style.width = p * 100 + '%';
      bar.querySelector('span').textContent = `下一里程碑「${next.name}」 ${s.pop}/${next.pop}`;
    } else {
      bar.querySelector('i').style.width = '100%';
      bar.querySelector('span').textContent = '已达成全部里程碑！';
    }
    $('#milestone-name').textContent = mi > 0 ? MILESTONES[mi - 1].name : '荒野';
    if (this.infoTile) this.showInfo(this.infoTile[0], this.infoTile[1], true);
    if (!$('#budget').classList.contains('hidden')) this.renderBudget();
  }

  renderQuests() {
    const ul = $('#quest-list');
    ul.innerHTML = '';
    let cur = false;
    for (const q of QUESTS) {
      const done = !!this.city.quests[q.id];
      const li = document.createElement('li');
      li.className = done ? 'done' : !cur ? 'cur' : '';
      if (!done) cur = true;
      li.innerHTML = `<div class="ck">${done ? '✓' : ''}</div><div>${q.text}</div><em>+¥${q.reward}</em>`;
      ul.appendChild(li);
    }
  }

  toast(text, type = '') {
    const box = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = text;
    box.appendChild(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, 3200);
  }

  tooltip(html, x, y, bad) {
    const t = $('#tooltip');
    if (!html) { t.classList.add('hidden'); return; }
    t.classList.remove('hidden');
    t.innerHTML = html;
    t.classList.toggle('badc', !!bad);
    t.style.left = x + 'px';
    t.style.top = y + 'px';
  }

  meter(v, color) {
    return `<div class="meter"><i style="width:${Math.round(v)}%;background:${color}"></i></div>`;
  }

  showInfo(x, z, refresh) {
    const info = this.city.tileInfo(x, z);
    const el = $('#info');
    if (!info) return this.hideInfo();
    this.infoTile = [x, z];
    let html = '<button class="close" id="info-close">✕</button>';
    const lv = info.landValue;
    if (info.special) {
      const sp = info.special, def = SPECIALS[sp.type];
      html += `<h3>${def.icon} ${def.name}</h3><span class="tag">${{ service: '公共服务', power: '电力设施', landmark: '城市地标' }[def.cat]}</span>`;
      html += `<div class="row"><span>说明</span><span>${def.desc}</span></div>`;
      if (def.power) html += `<div class="row"><span>发电量</span><span>⚡ ${def.power}</span></div>`;
      for (const f in def.effects) {
        const nm = { leisure: '休闲', police: '治安', fire: '消防', health: '医疗', edu: '教育', landmark: '地标', pollution: '污染' }[f];
        html += `<div class="row"><span>${nm}覆盖半径</span><span>${def.effects[f][0]} 格</span></div>`;
      }
      html += `<div class="row"><span>维护费</span><span>¥${def.upkeep}/天</span></div>`;
      html += `<button class="act" id="info-demolish">🚜 拆除（返还 ¥${Math.floor(def.cost / 2)}）</button>`;
    } else if (info.bld) {
      const b = info.bld;
      const zs = ZONE_STATS[b.zone];
      const icon = { R: '🏠', C: '🏬', I: '🏭' }[b.zone];
      html += `<h3>${icon} ${ZONE_NAMES[b.zone]}建筑</h3><span class="tag">${LEVEL_NAMES[b.level]} · ${b.level} 级</span><span class="tag">${'★'.repeat(b.level)}${'☆'.repeat(3 - b.level)}</span>`;
      html += `<div class="row"><span>${zs.label}</span><span>${Math.round(b.occ)} / ${b.cap}</span></div>`;
      html += `<div class="row"><span>幸福度</span><span>${Math.round(b.happy)}%</span></div>${this.meter(b.happy, b.happy > 60 ? 'var(--good)' : b.happy > 35 ? 'var(--warn)' : 'var(--bad)')}`;
      html += `<div class="row"><span>地价</span><span>${Math.round(lv)}</span></div>${this.meter(lv, 'var(--accent2)')}`;
      if (b.zone === 'R') html += `<div class="row"><span>污染</span><span>${Math.round(info.pollution * 100)}%</span></div>`;
      html += `<div class="row"><span>耗电</span><span>⚡ ${zs.power[b.level]}</span></div>`;
      const warns = [];
      if (!b.access) warns.push('🚧 未连接到高速公路的道路网');
      if (!b.powered) warns.push('⚡ 电力不足，市民正在离开');
      if (b.zone === 'R' && info.pollution > 0.3) warns.push('☁️ 污染严重，影响健康');
      if (warns.length) html += `<div class="warn">${warns.join('<br>')}</div>`;
      else if (b.level < 3) {
        let tip;
        if (b.zone === 'I') tip = b.level === 1 ? '建造学校提升教育，可升级' : '更高教育覆盖可升级为重工业';
        else tip = b.level === 1 ? `地价达到 30 可升级（公园、服务设施提升地价）` : `地价达到 52 且人口 ≥ 500 可升级为高密度`;
        html += `<div class="ok">⬆️ ${tip}</div>`;
      } else html += `<div class="ok">🌟 已达到最高等级</div>`;
    } else if (info.road) {
      html += `<h3>🛣️ 道路</h3><span class="tag">${info.water ? '桥梁' : '双向两车道'}</span>`;
      html += `<div class="row"><span>连接高速</span><span>${this.city.connected[z * 64 + x] ? '✅ 是' : '❌ 否'}</span></div>`;
      html += `<div class="row"><span>维护费</span><span>¥0.25/天</span></div>`;
    } else if (info.water) {
      html += `<h3>🌊 水域</h3><div class="row"><span>提示</span><span>可在水上修建桥梁</span></div>`;
    } else {
      html += `<h3>${info.zone ? { R: '🏠', C: '🏬', I: '🏭' }[info.zone] + ' ' + info.zoneName + '区（空地）' : '🌿 空地'}</h3>`;
      html += `<div class="row"><span>地价</span><span>${Math.round(lv)}</span></div>${this.meter(lv, 'var(--accent2)')}`;
      html += `<div class="row"><span>污染</span><span>${Math.round(info.pollution * 100)}%</span></div>`;
      if (info.zone) {
        const d = this.city.demand[info.zone];
        const acc = this.city.accessDir(x, z) >= 0;
        const low = {
          R: '📉 住宅需求不足：城里工作岗位不够，没人愿意搬来。<br>👉 多划一些<b>商业区</b>和<b>工业区</b>，或建公园、学校提升幸福度',
          C: '📉 商业需求不足：居民太少，商店没有顾客。<br>👉 多划一些<b>住宅区</b>',
          I: '📉 工业需求不足：居民和商店还不够多。<br>👉 多划一些<b>住宅区</b>和<b>商业区</b>',
        }[info.zone];
        const power = this.city.stats.powerCap - this.city.stats.powerUse < 2;
        const msg = !acc ? '🚧 需要连接到高速公路的道路' : d <= 0.05 ? low : power ? '⚡ 电力不足，无法开工。👉 再建一座发电设施' : '🏗️ 等待开发商建造…';
        html += `<div class="${acc && d > 0.05 && !power ? 'ok' : 'warn'}">${msg}</div>`;
      }
    }
    if (!refresh || el.classList.contains('hidden')) el.classList.remove('hidden');
    el.innerHTML = html;
    $('#info-close').onclick = () => this.hideInfo();
    const dm = $('#info-demolish');
    if (dm) dm.onclick = () => { this.city.bulldozeArea([[x, z]]); this.hideInfo(); };
    this.game.view.overlay.setCursor(x, z, info.special ? info.special.n : 1, '#3fd0b6');
  }

  hideInfo() {
    this.infoTile = null;
    $('#info').classList.add('hidden');
  }

  toggleBudget() {
    const b = $('#budget');
    b.classList.toggle('hidden');
    if (!b.classList.contains('hidden')) this.renderBudget(true);
  }

  renderBudget(full) {
    const c = this.city, bd = c.budget;
    const f = (v) => '¥' + Math.round(v).toLocaleString();
    const el = $('#budget');
    if (full || !el.querySelector('#tax')) {
      el.innerHTML = `<h3>📊 城市预算 <span style="font-size:12px;color:#9fb0c3">（每天）</span></h3><div id="bud-rows"></div>
        <div class="tax"><div class="row"><span>税率</span><b id="tax-v">${c.tax}%</b></div>
        <input id="tax" type="range" min="1" max="20" value="${c.tax}" />
        <div class="hint">高税率增加收入，但会降低需求与幸福度</div></div>`;
      el.querySelector('#tax').oninput = (e) => {
        c.tax = +e.target.value;
        el.querySelector('#tax-v').textContent = c.tax + '%';
      };
    }
    el.querySelector('#bud-rows').innerHTML = `
      <div class="row"><span>🏠 住宅税收</span><span class="pos">+${f(bd.incR)}</span></div>
      <div class="row"><span>🏬 商业税收</span><span class="pos">+${f(bd.incC)}</span></div>
      <div class="row"><span>🏭 工业税收</span><span class="pos">+${f(bd.incI)}</span></div>
      <div class="row"><span>🛣️ 道路维护</span><span class="neg">-${f(bd.expRoad)}</span></div>
      <div class="row"><span>🏛️ 设施维护</span><span class="neg">-${f(bd.expSvc)}</span></div>
      <div class="row total"><span>净收入</span><span class="${bd.income - bd.expense >= 0 ? 'pos' : 'neg'}">${bd.income - bd.expense >= 0 ? '+' : '-'}${f(Math.abs(bd.income - bd.expense))}</span></div>`;
  }

  modal(html, buttons = [{ text: '太棒了！', primary: true }]) {
    const m = $('#modal');
    m.innerHTML = `<div class="mcard">${html}<div class="btns"></div></div>`;
    const box = m.querySelector('.btns');
    for (const b of buttons) {
      const e = document.createElement('button');
      e.className = 'btn' + (b.primary ? ' primary' : '');
      e.textContent = b.text;
      e.onclick = () => { m.classList.add('hidden'); b.fn && b.fn(); };
      box.appendChild(e);
    }
    m.classList.remove('hidden');
  }

  milestone(m) {
    this.game.audio.play('fanfare');
    const unlocks = Object.values(SPECIALS).filter((d) => d.unlock > 0 && d.unlock <= this.city.maxPop);
    this.modal(`<div class="big">🏆</div><h2>${m.name}</h2><p>人口突破 <b>${m.pop.toLocaleString()}</b>！市民们为你的城市欢呼。</p><div class="reward">奖励 +${formatMoney(m.reward)}</div>`);
    this.renderSub();
  }

  menu() {
    this.modal(`<div class="big">🏙️</div><h2>游戏菜单</h2><p>进度会自动保存。</p>`, [
      { text: '继续', primary: true },
      { text: '保存', fn: () => { this.game.save(); this.toast('💾 城市已保存', 'good'); } },
      { text: '新城市', fn: () => this.modal(`<div class="big">⚠️</div><h2>重新开始？</h2><p>当前城市进度将被清除。</p>`, [
        { text: '取消' }, { text: '确定重开', primary: true, fn: () => this.game.newGame() },
      ]) },
    ]);
  }
}
