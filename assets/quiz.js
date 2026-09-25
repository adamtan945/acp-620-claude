/* ACP-620 題庫引擎 v2
 * 題目：window.ACP_Q = [{id, sec, dom, type:'single'|'multi', n, stem, zh, fig, opts[], ans:'AC', why{A..}, note, src[], lvl, lang}]
 * 紀錄：localStorage 'acp620.v2' → att{qid:[[t,pick,ok,mode]]}、flag{qid:t}、exams[]、cur（進行中的考試）
 * 每一次作答都保留；錯題＝最近一次答錯；「不懂」是全域標記。 */
(function () {
  'use strict';
  const Q = window.ACP_Q || [];
  const BY = new Map(Q.map((q) => [q.id, q]));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const KEY = 'acp620.v2';
  const L = 'ABCDEFGH';
  const WEIGHT = { '620.1': 13, '620.2': 29, '620.3': 25, '620.4': 14, '620.5': 19 };
  const DN = { '620.1': 'Project Creation', '620.2': 'Board Configuration', '620.3': 'Managing Projects', '620.4': 'Automation', '620.5': 'Reporting' };
  const EXAM_N = 63, EXAM_MIN = 180, PASS = 38 / 63;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const fmtT = (t) => new Date(t).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  /* ---------- 儲存 ---------- */
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { alert('瀏覽器儲存空間已滿或被封鎖，作答紀錄可能無法保存。'); } };
  function D() { const d = load(); d.att = d.att || {}; d.flag = d.flag || {}; d.exams = d.exams || []; return d; }
  (function migrate() {
    const d = D(); if (d.mig) return;
    try {
      const old = JSON.parse(localStorage.getItem('acp620-practice') || '{}');
      Object.entries(old).forEach(([id, ok]) => { if (BY.has(id) && !d.att[id]) d.att[id] = [[0, '', !!ok, 'p']]; });
      const hist = JSON.parse(localStorage.getItem('acp620-exam-history') || '[]');
      hist.forEach((h) => d.exams.push({ id: 'old' + h.at, legacy: 1, mode: 'full', dom: h.domain, t0: h.at, t1: h.at, score: h.right, total: h.total }));
    } catch (e) {}
    d.mig = 1; save(d);
  })();
  function record(id, pick, ok, mode) { const d = D(); (d.att[id] = d.att[id] || []).push([Date.now(), pick, ok, mode]); save(d); }
  const last = (d, id) => { const a = d.att[id]; return a && a.length ? a[a.length - 1] : null; };
  const isFlag = (id) => !!D().flag[id];
  function toggleFlag(id) { const d = D(); if (d.flag[id]) delete d.flag[id]; else d.flag[id] = Date.now(); save(d); return !!d.flag[id]; }
  const grade = (q, pick) => pick.split('').sort().join('') === q.ans.split('').sort().join('');

  /* ---------- 圖示 ---------- */
  const IC = {
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
    mark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 21V4h11l-2 4 2 4H5"/></svg>',
    ok: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    no: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  /* ---------- 單題卡片 ----------
   * mode: 'p' 練習（作答即批改、可重做）｜'e' 考試（只作答）｜'r' 檢討（鎖定、顯示解析） */
  function card(q, o) {
    o = o || {};
    const mode = o.mode || 'p';
    const el = document.createElement('article');
    el.className = 'q ' + (q.type === 'multi' ? 'multi' : 'single');
    el.dataset.id = q.id;
    let pick = o.pick || '';
    let graded = mode === 'r';
    const draw = () => {
      const d = D();
      const hist = (d.att[q.id] || []).slice(-12);
      const kind = q.type === 'multi' ? `多選・選 ${q.n}` : '單選';
      const top = `<div class="q-top">${o.num ? `<span class="num">第 ${o.num} 題</span>` : ''}<span class="chip ${q.type === 'multi' ? 'violet' : ''}">${kind}</span>${q.fig ? '<span class="chip teal">圖例題</span>' : ''}<a class="chip" href="${q.sec}.html">${q.sec}</a><span class="sp"></span>
        ${mode === 'e' ? `<button type="button" class="flag mk" aria-pressed="${o.marked ? 'true' : 'false'}" title="考完前回來檢查">${IC.mark}<span>稍後檢查</span></button>` : ''}
        <button type="button" class="flag fg" aria-pressed="${d.flag[q.id] ? 'true' : 'false'}" title="加入「不懂」清單">${IC.flag}<span>不懂</span></button></div>`;
      const stem = `<div class="q-stem">${q.stem}${q.zh ? `<span class="zh">${q.zh}</span>` : ''}</div>${q.type === 'multi' ? `<div class="q-pick">請選 ${q.n} 個答案</div>` : ''}${q.fig ? `<div class="q-fig">${q.fig}</div>` : ''}`;
      const opts = q.opts.map((t, i) => {
        const k = L[i];
        const sel = pick.includes(k);
        let cls = 'q-opt';
        if (graded) {
          cls += ' locked';
          if (q.ans.includes(k)) cls += sel || mode === 'r' && !pick ? ' right' : ' right missed';
          else if (sel) cls += ' wrong';
        } else if (sel) cls += ' sel';
        const why = graded && q.why && q.why[k] ? `<span class="why">${q.why[k]}</span>` : '';
        return `<li><label class="${cls}"><input type="${q.type === 'multi' ? 'checkbox' : 'radio'}" name="${q.id}-${o.uid || ''}" value="${k}" ${sel ? 'checked' : ''} ${graded ? 'disabled' : ''}><span class="k">${k}</span><span class="tx">${t}${why}</span></label></li>`;
      }).join('');
      let foot = '';
      if (graded) {
        const ok = grade(q, pick);
        foot += pick || mode !== 'r' ? `<div class="q-verdict ${ok ? 'ok' : 'no'}">${ok ? IC.ok + '答對' : IC.no + (pick ? '答錯' : '未作答') + '，正解是 ' + q.ans.split('').join('、')}</div>` : `<div class="q-verdict no">${IC.no}未作答，正解是 ${q.ans.split('').join('、')}</div>`;
        if (q.note) foot += `<div class="q-note">${q.note}</div>`;
        if (q.src && q.src.length) foot += `<div class="q-src">官方來源：${q.src.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(support\.|www\.)?atlassian\.com\//, '').replace(/\/$/, ''))}</a>`).join('、')}</div>`;
      }
      if (hist.length) foot += `<div class="q-hist" title="最近的作答紀錄">作答紀錄 ${hist.map((h) => `<i class="${h[2] ? 'o' : 'x'}" title="${h[0] ? fmtT(h[0]) : '舊版紀錄'}：${h[2] ? '對' : '錯'}${h[1] ? '（選 ' + h[1] + '）' : ''}"></i>`).join('')}<span>共 ${(d.att[q.id] || []).length} 次・答對 ${(d.att[q.id] || []).filter((h) => h[2]).length} 次</span></div>`;
      let act = '';
      if (mode === 'p') {
        act = graded
          ? `<button type="button" class="btn ghost sm redo">再做一次</button>`
          : q.type === 'multi' ? `<button type="button" class="btn sm submit" ${pick.length === q.n ? '' : 'disabled'}>確認答案</button><span class="small muted">${pick.length}／${q.n}</span>` : '';
        if (o.onNext) act += `<span class="sp"></span><button type="button" class="btn sm next" ${graded ? '' : 'disabled'}>下一題</button>`;
      }
      el.innerHTML = top + stem + `<ul class="q-opts">${opts}</ul>` + (act ? `<div class="q-act">${act}</div>` : '') + foot;
      bind();
    };
    const bind = () => {
      $('.fg', el).addEventListener('click', (e) => { const on = toggleFlag(q.id); e.currentTarget.setAttribute('aria-pressed', String(on)); o.onFlag && o.onFlag(on); });
      const mk = $('.mk', el); if (mk) mk.addEventListener('click', () => { o.marked = !o.marked; mk.setAttribute('aria-pressed', String(o.marked)); o.onMark && o.onMark(o.marked); });
      if (!graded) $$('input', el).forEach((inp) => inp.addEventListener('change', () => {
        const k = inp.value;
        if (q.type === 'multi') {
          if (inp.checked) { if (pick.length >= q.n) { inp.checked = false; flash(`這題只選 ${q.n} 個；要換的話先取消一個已選的選項。`); return; } pick = (pick + k).split('').sort().join(''); }
          else pick = pick.replace(k, '');
        } else pick = k;
        o.onPick && o.onPick(pick);
        if (mode === 'p' && q.type !== 'multi') { submit(); return; }
        draw();
      }));
      const sb = $('.submit', el); if (sb) sb.addEventListener('click', submit);
      const rd = $('.redo', el); if (rd) rd.addEventListener('click', () => { pick = ''; graded = false; draw(); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
      const nx = $('.next', el); if (nx) nx.addEventListener('click', () => o.onNext());
    };
    const submit = () => { graded = true; const ok = grade(q, pick); record(q.id, pick, ok, o.tag || 'p'); o.onGrade && o.onGrade(ok, pick); draw(); };
    const flash = (msg) => { let t = $('.q-note.tmp', el); if (!t) { t = document.createElement('div'); t.className = 'q-note tmp warn'; el.appendChild(t); } t.textContent = msg; setTimeout(() => t && t.remove(), 2600); };
    el.setPick = (p) => { pick = p; draw(); };
    draw();
    return el;
  }
  window.ACP = window.ACP || {};
  window.ACP.card = card;

  /* ---------- 練習 session：一次一題、題號盤、過濾 ---------- */
  function session(box, ids, opt) {
    opt = opt || {};
    let order = ids.slice(), i = 0;
    const res = {}; // 本次 session 的結果
    box.innerHTML = '';
    const head = document.createElement('div'); head.className = 'qz-head';
    const pal = document.createElement('div'); pal.className = 'pal';
    const holder = document.createElement('div');
    box.append(head, holder, pal);
    const paintHead = () => {
      const done = Object.keys(res).length, ok = Object.values(res).filter(Boolean).length;
      head.innerHTML = `<div class="qz-stats"><span class="chip brand">第 ${i + 1}／${order.length} 題</span><span class="chip green">本次答對 ${ok}／${done}</span></div>
        <div class="row">${opt.onExit ? '<button type="button" class="btn quiet sm ex">結束練習</button>' : ''}<button type="button" class="btn quiet sm sh">打亂順序</button></div>`;
      $('.sh', head).addEventListener('click', () => { order = shuffle(order); i = 0; show(); });
      const ex = $('.ex', head); if (ex) ex.addEventListener('click', () => opt.onExit(res));
    };
    const paintPal = () => {
      pal.innerHTML = order.map((id, k) => `<button type="button" data-k="${k}" class="${k === i ? 'cur' : ''} ${id in res ? (res[id] ? 'o' : 'x') : ''}" aria-label="第 ${k + 1} 題">${k + 1}</button>`).join('');
      $$('button', pal).forEach((b) => b.addEventListener('click', () => { i = +b.dataset.k; show(); }));
    };
    const show = () => {
      const q = BY.get(order[i]); if (!q) return;
      holder.innerHTML = '';
      holder.appendChild(card(q, {
        mode: 'p', num: i + 1, uid: 's' + i,
        onGrade: (ok) => { res[q.id] = ok; paintHead(); paintPal(); },
        onNext: i < order.length - 1 ? () => { i++; show(); holder.scrollIntoView({ block: 'start', behavior: 'smooth' }); } : null
      }));
      paintHead(); paintPal();
    };
    if (!order.length) { box.innerHTML = '<div class="call"><div><div class="t">這個條件下沒有題目</div>換一個篩選條件試試。</div></div>'; return; }
    show();
  }

  /* ---------- 各節「本節練習」 ---------- */
  $$('.qz[data-sec]').forEach((box) => {
    const sec = box.dataset.sec;
    // 新題（英文、多選、圖例）排前面，舊題在後
    const all = Q.filter((q) => q.sec === sec).sort((a, b) => (a.lang === 'en' ? 0 : 1) - (b.lang === 'en' ? 0 : 1));
    box.innerHTML = '';
    const ctl = document.createElement('div');
    const area = document.createElement('div');
    box.append(ctl, area);
    const FILTERS = [['all', '全部'], ['new', '沒做過'], ['wrong', '最近答錯'], ['flag', '不懂'], ['multi', '多選'], ['fig', '圖例']];
    let f = 'all';
    const pickIds = () => {
      const d = D();
      return all.filter((q) => f === 'all' || (f === 'new' && !d.att[q.id]) || (f === 'wrong' && last(d, q.id) && !last(d, q.id)[2]) || (f === 'flag' && d.flag[q.id]) || (f === 'multi' && q.type === 'multi') || (f === 'fig' && q.fig)).map((q) => q.id);
    };
    const paint = () => {
      const d = D();
      const done = all.filter((q) => d.att[q.id]).length;
      const okN = all.filter((q) => last(d, q.id) && last(d, q.id)[2]).length;
      const fl = all.filter((q) => d.flag[q.id]).length;
      const multi = all.filter((q) => q.type === 'multi').length;
      ctl.innerHTML = `<div class="stats">
          <div class="stat"><div class="v">${all.length}<small> 題</small></div><div class="l">本節題數（多選 ${multi}）</div></div>
          <div class="stat"><div class="v">${done}<small>／${all.length}</small></div><div class="l">做過的題</div></div>
          <div class="stat"><div class="v">${pct(okN, done)}<small>%</small></div><div class="l">最近一次的正確率</div></div>
          <div class="stat"><div class="v">${fl}</div><div class="l">標記「不懂」</div></div></div>
        <div class="row"><div class="seg" role="group" aria-label="篩選題目">${FILTERS.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${v === f}">${t}</button>`).join('')}</div></div>
        <div class="row" style="margin-top:.7rem"><button type="button" class="btn go">開始練習（${pickIds().length} 題）</button></div>`;
      $$('.seg button', ctl).forEach((b) => b.addEventListener('click', () => { f = b.dataset.v; paint(); }));
      $('.go', ctl).addEventListener('click', () => { ctl.hidden = true; session(area, pickIds(), { onExit: () => { area.innerHTML = ''; ctl.hidden = false; paint(); box.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }); });
    };
    if (!all.length) { box.innerHTML = '<p class="muted">本節題目整理中。</p>'; return; }
    paint();
  });

  /* ================= 首頁儀表板 ================= */
  const dash = $('#dash');
  if (dash) {
    const d = D();
    const ids = Q.map((q) => q.id);
    const done = ids.filter((id) => d.att[id]);
    const ok = done.filter((id) => last(d, id)[2]).length;
    const wrong = done.length - ok;
    const read = Object.keys(d.read || {}).length;
    const ex = d.exams.filter((e) => e.t1 && e.mode === 'full');
    dash.innerHTML = `
      <div class="stat"><div class="v">${read}<small>／24</small></div><div class="l">讀完的小節</div></div>
      <div class="stat"><div class="v">${done.length}<small>／${ids.length}</small></div><div class="l">做過的題</div></div>
      <div class="stat"><div class="v">${done.length ? pct(ok, done.length) + '<small>%</small>' : '—'}</div><div class="l">最近一次正確率</div></div>
      <div class="stat"><div class="v bad">${wrong}</div><div class="l">目前答錯的題</div></div>
      <div class="stat"><div class="v warn">${Object.keys(d.flag).length}</div><div class="l">標記「不懂」</div></div>
      <div class="stat"><div class="v">${ex.length ? pct(ex[ex.length - 1].score, ex[ex.length - 1].total) + '<small>%</small>' : '—'}</div><div class="l">最近一次全真模擬</div></div>`;
    const big = $('#big-count');
    const examAt = new Date('2026-09-28T10:00:00+08:00').getTime();
    const paintCount = () => {
      const left = examAt - Date.now();
      if (left <= 0) { big.innerHTML = '<b>考試進行中或已結束</b><span class="muted">祝你順利通過！</span>'; return; }
      const dd = Math.floor(left / 864e5), hh = Math.floor(left % 864e5 / 36e5), mm = Math.floor(left % 36e5 / 6e4);
      big.innerHTML = `<span class="muted">距離考試還有</span><b>${dd}</b><span>天</span><b>${hh}</b><span>小時</span><b>${mm}</b><span>分</span>`;
    };
    if (big) { paintCount(); setInterval(paintCount, 30000); }
    const today = new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10);
    $$('[data-day]').forEach((c) => c.classList.toggle('today', c.dataset.day === today));
    const pl = d.plan || {};
    $$('[data-plan]').forEach((cb) => {
      cb.checked = !!pl[cb.dataset.plan];
      cb.closest('label').classList.toggle('done', cb.checked);
      cb.addEventListener('change', () => { const d2 = D(); d2.plan = d2.plan || {}; if (cb.checked) d2.plan[cb.dataset.plan] = Date.now(); else delete d2.plan[cb.dataset.plan]; save(d2); cb.closest('label').classList.toggle('done', cb.checked); });
    });
  }

  /* ================= 模擬考頁 ================= */
  const app = $('#exam-app');
  if (!app) return;
  let timer = 0;

  function pickExam(n) {
    const out = [];
    const doms = Object.keys(WEIGHT);
    const target = doms.map((d) => [d, Math.round(n * WEIGHT[d] / 100)]);
    target[1][1] += n - target.reduce((a, [, k]) => a + k, 0);
    target.forEach(([dom, k]) => {
      const pool = Q.filter((q) => q.dom === dom);
      // 多選題優先抽到約四成，貼近正式考試
      const multi = shuffle(pool.filter((q) => q.type === 'multi')), single = shuffle(pool.filter((q) => q.type !== 'multi'));
      const km = Math.min(multi.length, Math.round(k * 0.4));
      out.push(...multi.slice(0, km), ...single.slice(0, k - km));
      if (km + Math.min(single.length, k - km) < k) out.push(...multi.slice(km, km + (k - km - single.length)));
    });
    return shuffle(out).map((q) => q.id);
  }
  function startExam(kind) {
    const n = kind === 'quick' ? 20 : EXAM_N, min = kind === 'quick' ? 30 : EXAM_MIN;
    const d = D();
    d.cur = { id: 'x' + Date.now(), mode: kind, t0: Date.now(), lim: min * 60000, ids: pickExam(n), ans: {}, mk: {}, i: 0 };
    save(d); run();
  }
  function practice(ids, title) {
    clearInterval(timer); document.body.classList.add('ex-run');
    app.innerHTML = `<div class="row" style="justify-content:space-between"><h2 style="margin:0">${esc(title)}</h2><button type="button" class="btn ghost sm back">回模擬考首頁</button></div><div class="sessbox"></div>`;
    $('.back', app).addEventListener('click', home);
    session($('.sessbox', app), ids, { onExit: home });
    scrollTo({ top: 0 });
  }

  /* ---------- 首頁 ---------- */
  function home() {
    clearInterval(timer); document.body.classList.remove('ex-run');
    const d = D();
    if (d.cur && !d.cur.t1) return run();
    const ids = Q.map((q) => q.id);
    const done = ids.filter((id) => d.att[id]);
    const okLast = done.filter((id) => last(d, id)[2]).length;
    const wrong = done.filter((id) => !last(d, id)[2]);
    const flags = ids.filter((id) => d.flag[id]);
    const fresh = ids.filter((id) => !d.att[id]);
    const exams = d.exams.filter((e) => e.t1).sort((a, b) => b.t1 - a.t1);
    const best = exams.filter((e) => e.mode === 'full').reduce((m, e) => Math.max(m, pct(e.score, e.total)), 0);
    const domRows = Object.keys(WEIGHT).map((dom) => {
      const dq = Q.filter((q) => q.dom === dom), dd = dq.filter((q) => d.att[q.id]), ok = dd.filter((q) => last(d, q.id)[2]).length, p = pct(ok, dd.length);
      return `<div><span>${dom} ${DN[dom]} <span class="muted small">（考試 ${WEIGHT[dom]}%）</span></span><b>${dd.length ? p + '%' : '—'}</b><div class="bar2"><i class="${!dd.length ? '' : p < 60 ? 'lo' : p < 80 ? 'mid' : 'hi'}" style="width:${dd.length ? p : 0}%"></i></div><span class="muted small" style="grid-column:1/-1">做過 ${dd.length}／${dq.length} 題</span></div>`;
    }).join('');
    const trend = exams.filter((e) => !e.legacy).slice(0, 12).reverse();
    const spark = trend.length > 1 ? (() => {
      const W = 320, H = 90, xs = (k) => 20 + k * (W - 40) / (trend.length - 1), ys = (p) => 80 - p * 0.7;
      const pts = trend.map((e, k) => `${xs(k).toFixed(1)},${ys(pct(e.score, e.total)).toFixed(1)}`).join(' ');
      return `<figure class="fig narrow"><div class="frame"><svg class="dia" viewBox="0 0 ${W} ${H}" role="img" aria-label="模擬考分數走勢"><line x1="20" x2="${W - 20}" y1="${ys(60)}" y2="${ys(60)}" class="ln d rose"/><text x="${W - 20}" y="${ys(60) - 4}" text-anchor="end" class="s tf-rose">及格線 60%</text><polyline points="${pts}" class="ln brand w3"/>${trend.map((e, k) => `<circle cx="${xs(k)}" cy="${ys(pct(e.score, e.total))}" r="4" class="fl-brand"/>`).join('')}</svg></div><figcaption>最近 ${trend.length} 次模擬考的正確率</figcaption></figure>`;
    })() : '';
    const hist = exams.length ? `<table class="tbl"><thead><tr><th>時間</th><th>類型</th><th class="c">分數</th><th class="c">結果</th><th></th></tr></thead><tbody>${exams.map((e) => `<tr><td data-l="時間">${fmtT(e.t1)}</td><td data-l="類型">${e.mode === 'quick' ? '20 題小考' : e.legacy ? '舊版模擬考' : '全真模擬'}</td><td class="c" data-l="分數">${e.score}／${e.total}（${pct(e.score, e.total)}%）</td><td class="c" data-l="結果">${pct(e.score, e.total) >= 60 ? '<span class="ok">及格</span>' : '<span class="bad">未及格</span>'}</td><td data-l="檢討">${e.legacy ? '<span class="muted small">無逐題資料</span>' : `<button type="button" class="btn ghost sm rv" data-id="${e.id}">檢討</button>`}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">還沒有模擬考紀錄。</p>';
    const secOpts = Array.from(new Set(Q.map((q) => q.sec))).sort().map((s) => `<option value="${s}">${s}（${Q.filter((q) => q.sec === s).length} 題）</option>`).join('');
    app.innerHTML = `
      <div class="stats">
        <div class="stat"><div class="v">${done.length}<small>／${ids.length}</small></div><div class="l">題庫做過的題</div></div>
        <div class="stat"><div class="v">${pct(okLast, done.length)}<small>%</small></div><div class="l">最近一次作答正確率</div></div>
        <div class="stat"><div class="v bad">${wrong.length}</div><div class="l">目前答錯的題</div></div>
        <div class="stat"><div class="v warn">${flags.length}</div><div class="l">標記「不懂」</div></div>
        <div class="stat"><div class="v">${best ? best + '%' : '—'}</div><div class="l">全真模擬最佳</div></div>
      </div>
      <section class="sec" style="margin-top:1.5rem"><h2>選一種練法</h2>
        <div class="grid">
          <div class="card"><h3>全真模擬考</h3><p class="small muted">依比重抽 ${EXAM_N} 題、約四成多選，計時 ${EXAM_MIN} 分鐘。交卷才看答案，跟正式考試一樣。</p><button type="button" class="btn" data-go="full">開始（${EXAM_N} 題）</button></div>
          <div class="card"><h3>20 題小考</h3><p class="small muted">30 分鐘，一樣交卷才批改。適合零碎時間測一下。</p><button type="button" class="btn ghost" data-go="quick">開始小考</button></div>
          <div class="card"><h3>錯題重練</h3><p class="small muted">所有「最近一次答錯」的題。答對後就會從清單消失。</p><button type="button" class="btn ghost" data-go="wrong" ${wrong.length ? '' : 'disabled'}>重練 ${wrong.length} 題</button></div>
          <div class="card"><h3>不懂的題</h3><p class="small muted">你按過星號「不懂」的題。搞懂了再按一次取消。</p><button type="button" class="btn ghost" data-go="flag" ${flags.length ? '' : 'disabled'}>練 ${flags.length} 題</button></div>
          <div class="card"><h3>還沒做過的題</h3><p class="small muted">隨機抽 20 題你從沒碰過的題目，作答後馬上看解析。</p><button type="button" class="btn ghost" data-go="new" ${fresh.length ? '' : 'disabled'}>抽 ${Math.min(20, fresh.length)} 題</button></div>
          <div class="card"><h3>自選範圍</h3><label class="small muted" for="pick-sec">章節</label><select id="pick-sec" class="search" style="margin:.3rem 0 .5rem"><option value="*">全部章節</option>${Object.keys(DN).map((k) => `<option value="d${k}">${k} ${DN[k]}（整個 domain）</option>`).join('')}${secOpts}</select>
            <label class="small muted" for="pick-type">題型</label><select id="pick-type" class="search" style="margin:.3rem 0 .6rem"><option value="*">全部題型</option><option value="multi">只要多選</option><option value="fig">只要圖例題</option></select><button type="button" class="btn ghost" data-go="custom">開始練習</button></div>
        </div></section>
      <section class="sec"><h2>各 domain 掌握度</h2><div class="meter">${domRows}</div></section>
      <section class="sec"><h2>歷次模擬考</h2>${spark}${hist}</section>
      <section class="sec"><h2>紀錄備份</h2><p class="small muted">作答紀錄只存在這台裝置的瀏覽器。換裝置前先匯出，到新裝置再匯入。</p>
        <div class="row"><button type="button" class="btn ghost sm" id="exp">匯出紀錄</button><label class="btn ghost sm" for="imp">匯入紀錄</label><input id="imp" type="file" accept="application/json" class="sr"><button type="button" class="btn danger sm" id="wipe">清除全部紀錄</button></div></section>`;
    $$('[data-go]', app).forEach((b) => b.addEventListener('click', () => {
      const g = b.dataset.go;
      if (g === 'full' || g === 'quick') return startExam(g);
      if (g === 'wrong') return practice(shuffle(wrong), '錯題重練');
      if (g === 'flag') return practice(flags, '不懂的題');
      if (g === 'new') return practice(shuffle(fresh).slice(0, 20), '還沒做過的題');
      const s = $('#pick-sec').value, t = $('#pick-type').value;
      const ids2 = Q.filter((q) => (s === '*' || (s[0] === 'd' ? q.dom === s.slice(1) : q.sec === s)) && (t === '*' || (t === 'multi' ? q.type === 'multi' : !!q.fig))).map((q) => q.id);
      practice(shuffle(ids2), '自選範圍練習');
    }));
    $$('.rv', app).forEach((b) => b.addEventListener('click', () => review(b.dataset.id)));
    $('#exp').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(load(), null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `acp620-紀錄-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $('#imp').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then((t) => {
        const inc = JSON.parse(t), d2 = D();
        Object.entries(inc.att || {}).forEach(([id, arr]) => { const seen = new Set((d2.att[id] || []).map((h) => h[0])); d2.att[id] = (d2.att[id] || []).concat(arr.filter((h) => !seen.has(h[0]))).sort((a, b) => a[0] - b[0]); });
        Object.assign(d2.flag, inc.flag || {});
        const have = new Set(d2.exams.map((x) => x.id)); (inc.exams || []).forEach((x) => { if (!have.has(x.id)) d2.exams.push(x); });
        d2.read = Object.assign(d2.read || {}, inc.read || {});
        save(d2); home(); alert('已合併匯入的紀錄。');
      }).catch(() => alert('檔案格式不對，請選之前匯出的 JSON。'));
    });
    $('#wipe').addEventListener('click', () => { if (confirm('確定清除所有作答紀錄、不懂標記與模擬考成績？這個動作不能復原。建議先匯出備份。')) { const d2 = D(); save({ read: d2.read, mig: 1 }); home(); } });
  }

  /* ---------- 考試進行中 ---------- */
  function run() {
    clearInterval(timer); document.body.classList.add('ex-run'); scrollTo({ top: 0 });
    const d = D(); const c = d.cur; if (!c) return home();
    const total = c.ids.length;
    app.innerHTML = `<div class="ex-bar"><span class="time" id="ex-time">--:--:--</span><div class="prog" aria-hidden="true"><i id="ex-prog"></i></div><span class="small" id="ex-done"></span><button type="button" class="btn ghost sm" id="ex-pal" aria-expanded="false">題號</button><button type="button" class="btn sm" id="ex-sub">交卷</button></div>
      <div id="ex-palbox" hidden><div class="pal" id="ex-pal-grid"></div><p class="small muted">藍色＝已作答、橘點＝稍後檢查。點題號直接跳過去。</p></div>
      <div id="ex-q"></div>
      <div class="nav-q"><button type="button" class="btn ghost" id="ex-prev">上一題</button><button type="button" class="btn ghost" id="ex-next">下一題</button></div>
      <p class="small muted" style="margin-top:1rem">可以隨時離開，進度會保留；回到這頁會接著作答。鍵盤：A–F 選答案、← → 換題。</p>`;
    const paintBar = () => {
      const c2 = D().cur; const n = Object.keys(c2.ans).filter((k) => c2.ans[k]).length;
      $('#ex-done').textContent = `已答 ${n}／${total}`; $('#ex-prog').style.width = pct(n, total) + '%';
      $('#ex-pal-grid').innerHTML = c2.ids.map((id, k) => `<button type="button" data-k="${k}" class="${c2.ans[id] ? 'a' : ''} ${c2.mk[id] ? 'mk' : ''} ${k === c2.i ? 'cur' : ''}">${k + 1}</button>`).join('');
      $$('#ex-pal-grid button').forEach((b) => b.addEventListener('click', () => go(+b.dataset.k)));
    };
    const go = (k) => {
      const c2 = D(); c2.cur.i = Math.max(0, Math.min(total - 1, k)); save(c2);
      const cur = c2.cur, id = cur.ids[cur.i], q = BY.get(id);
      const box = $('#ex-q'); box.innerHTML = '';
      box.appendChild(card(q, { mode: 'e', num: cur.i + 1, pick: cur.ans[id] || '', marked: !!cur.mk[id], uid: 'e',
        onPick: (p) => { const c3 = D(); c3.cur.ans[id] = p; save(c3); paintBar(); },
        onMark: (m) => { const c3 = D(); if (m) c3.cur.mk[id] = 1; else delete c3.cur.mk[id]; save(c3); paintBar(); } }));
      $('#ex-prev').disabled = cur.i === 0; $('#ex-next').disabled = cur.i === total - 1;
      paintBar();
    };
    $('#ex-prev').addEventListener('click', () => { go(D().cur.i - 1); scrollTo({ top: 0, behavior: 'smooth' }); });
    $('#ex-next').addEventListener('click', () => { go(D().cur.i + 1); scrollTo({ top: 0, behavior: 'smooth' }); });
    $('#ex-pal').addEventListener('click', (e) => { const b = $('#ex-palbox'); b.hidden = !b.hidden; e.currentTarget.setAttribute('aria-expanded', String(!b.hidden)); });
    $('#ex-sub').addEventListener('click', () => {
      const c2 = D().cur; const n = c2.ids.filter((id) => c2.ans[id]).length, mk = Object.keys(c2.mk).length;
      const msg = `確定交卷？\n\n已作答 ${n}／${total} 題${total - n ? `，還有 ${total - n} 題沒答（會算錯）` : ''}${mk ? `\n有 ${mk} 題標記「稍後檢查」` : ''}`;
      if (confirm(msg)) finish(false);
    });
    document.onkeydown = (e) => {
      if (!$('#ex-q') || e.target.closest('input,select,textarea') && e.target.type !== 'radio' && e.target.type !== 'checkbox') return;
      if (e.key === 'ArrowRight') $('#ex-next').click();
      else if (e.key === 'ArrowLeft') $('#ex-prev').click();
      else { const k = 'ABCDEFGH'.indexOf(e.key.toUpperCase()); if (k >= 0) { const inp = $$('#ex-q input')[k]; if (inp) { inp.checked = inp.type === 'checkbox' ? !inp.checked : true; inp.dispatchEvent(new Event('change')); } } }
    };
    const tick = () => {
      const c2 = D().cur; if (!c2) return;
      const left = c2.t0 + c2.lim - Date.now();
      const s = Math.max(0, Math.floor(left / 1000));
      const t = $('#ex-time'); if (!t) return clearInterval(timer);
      t.textContent = `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      t.classList.toggle('low', left < 10 * 60000);
      if (left <= 0) finish(true);
    };
    tick(); timer = setInterval(tick, 1000);
    go(c.i || 0);
  }
  function finish(auto) {
    clearInterval(timer); document.onkeydown = null;
    const d = D(); const c = d.cur; if (!c) return home();
    let score = 0; const now = Date.now();
    c.ids.forEach((id) => { const q = BY.get(id); const p = c.ans[id] || ''; const ok = !!q && !!p && grade(q, p); if (ok) score++; (d.att[id] = d.att[id] || []).push([now, p, ok, 'e']); });
    const ex = { id: c.id, mode: c.mode, t0: c.t0, t1: now, ids: c.ids, ans: c.ans, mk: c.mk, score, total: c.ids.length, auto: !!auto };
    d.exams.push(ex); delete d.cur; save(d);
    review(ex.id, true);
  }

  /* ---------- 檢討 ---------- */
  function review(id, fresh) {
    clearInterval(timer); document.body.classList.remove('ex-run');
    const d = D(); const ex = d.exams.find((e) => e.id === id); if (!ex) return home();
    const qs = ex.ids.map((k) => BY.get(k)).filter(Boolean);
    const okOf = (q) => !!ex.ans[q.id] && grade(q, ex.ans[q.id]);
    const p = pct(ex.score, ex.total), pass = ex.score / ex.total >= PASS;
    const byDom = Object.keys(WEIGHT).map((dom) => { const dq = qs.filter((q) => q.dom === dom); if (!dq.length) return ''; const ok = dq.filter(okOf).length, pp = pct(ok, dq.length); return `<div><span>${dom} ${DN[dom]}</span><b>${ok}／${dq.length}</b><div class="bar2"><i class="${pp < 60 ? 'lo' : pp < 80 ? 'mid' : 'hi'}" style="width:${pp}%"></i></div></div>`; }).join('');
    const bySec = {}; qs.forEach((q) => { bySec[q.sec] = bySec[q.sec] || [0, 0]; bySec[q.sec][1]++; if (okOf(q)) bySec[q.sec][0]++; });
    const weakSecs = Object.entries(bySec).filter(([, [o, t]]) => t >= 2 && o / t < 0.6).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]).slice(0, 6);
    app.innerHTML = `<div class="card">
        <div class="eyebrow">${ex.mode === 'quick' ? '20 題小考' : '全真模擬考'}・${fmtT(ex.t1)}${ex.auto ? '・時間到自動交卷' : ''}</div>
        <div class="row" style="align-items:baseline;margin:.4rem 0"><span style="font-size:2.6rem;font-weight:800;letter-spacing:-.02em;color:${pass ? 'var(--green)' : 'var(--rose)'}">${ex.score}／${ex.total}</span><span class="chip ${pass ? 'green' : 'rose'}">${p}%・${pass ? '達及格線' : '未達及格線'}</span></div>
        <p class="small muted">正式考試 63 題答對 38 題及格（約 60%）。多選題要全部選對才算分。用時 ${Math.round((ex.t1 - ex.t0) / 60000)} 分鐘。</p>
        <div class="meter">${byDom}</div>
        ${weakSecs.length ? `<div class="call weak"><div><div class="t">這次最弱的小節</div>${weakSecs.map(([s, [o, t]]) => `<a class="chip rose" href="${s}.html">${s}　${o}／${t}</a>`).join(' ')}<p class="small" style="margin:.4rem 0 0">點進去讀「3 分鐘速覽」和「易錯觀念」，再回來做錯題重練。</p></div></div>` : ''}
        <div class="row"><button type="button" class="btn" id="rv-redo" ${qs.some((q) => !okOf(q)) ? '' : 'disabled'}>錯的題立刻重練</button><button type="button" class="btn ghost" id="rv-home">回模擬考首頁</button></div></div>
      <div class="row" style="margin:1.2rem 0 .4rem"><div class="seg" role="group" aria-label="檢討範圍"><button type="button" data-v="wrong" aria-pressed="true">錯題 ${qs.filter((q) => !okOf(q)).length}</button><button type="button" data-v="mk" aria-pressed="false">標記檢查 ${qs.filter((q) => ex.mk && ex.mk[q.id]).length}</button><button type="button" data-v="flag" aria-pressed="false">不懂</button><button type="button" data-v="all" aria-pressed="false">全部 ${qs.length}</button></div></div>
      <div id="rv-list"></div>`;
    const list = (v) => {
      const box = $('#rv-list'); box.innerHTML = '';
      const d2 = D();
      const sel = qs.filter((q) => v === 'all' || (v === 'wrong' && !okOf(q)) || (v === 'mk' && ex.mk && ex.mk[q.id]) || (v === 'flag' && d2.flag[q.id]));
      if (!sel.length) { box.innerHTML = '<p class="muted">這一類沒有題目。</p>'; return; }
      sel.forEach((q) => box.appendChild(card(q, { mode: 'r', num: ex.ids.indexOf(q.id) + 1, pick: ex.ans[q.id] || '', uid: 'r' })));
    };
    $$('.seg button', app).forEach((b) => b.addEventListener('click', () => { $$('.seg button', app).forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); list(b.dataset.v); }));
    $('#rv-home').addEventListener('click', home);
    $('#rv-redo').addEventListener('click', () => practice(qs.filter((q) => !okOf(q)).map((q) => q.id), '這次考試的錯題'));
    list('wrong');
    if (fresh) scrollTo({ top: 0 });
  }

  home();
})();
