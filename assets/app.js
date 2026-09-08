/* ACP-620 教材互動腳本（需先載入 spring.js） */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pop = (el) => { if (window.springPop && !reduced()) window.springPop(el); };

  /* ---------- 主題切換：跟隨系統，可手動覆蓋（localStorage） ---------- */
  (function theme() {
    const root = document.documentElement;
    let saved = null; try { saved = localStorage.getItem('acp620-theme'); } catch (e) {}
    if (saved === 'dark' || saved === 'light') root.dataset.theme = saved;
    const btn = $('#theme-btn'); if (!btn) return;
    const sys = () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const cur = () => root.dataset.theme || sys();
    const label = () => { btn.innerHTML = cur() === 'dark' ? '☾&nbsp;深色' : '☀︎&nbsp;淺色'; btn.title = root.dataset.theme ? '手動設定（再按一次切換）' : '跟隨系統'; };
    btn.addEventListener('click', () => {
      const next = cur() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next; try { localStorage.setItem('acp620-theme', next); } catch (e) {}
      label();
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', label);
    label();
  })();

  /* 側欄目前頁 */
  const here = location.pathname.split('/').pop() || 'index.html';
  $$('.sidebar nav a').forEach((a) => { if (a.getAttribute('href') === here) a.classList.add('current'); });

  /* ---------- 題目解答：從題目處以 spring 展開，收合走原路，可中途反向 ---------- */
  $$('details.q').forEach((d) => {
    const a = $('.a', d); if (!a) return;
    const wrap = document.createElement('div'); wrap.className = 'a-wrap';
    a.parentNode.insertBefore(wrap, a); wrap.appendChild(a);
    wrap.style.height = d.open ? 'auto' : '0px'; if (!d.open) wrap.style.opacity = '0';
    const sum = $('summary', d);
    sum.addEventListener('click', (e) => {
      e.preventDefault();
      const opening = !d.classList.contains('is-open');
      d.classList.toggle('is-open', opening);
      if (opening) d.open = true;
      if (reduced() || !window.springExpand) { wrap.style.height = opening ? 'auto' : '0px'; wrap.style.opacity = opening ? '1' : '0'; if (!opening) d.open = false; return; }
      const s = window.springExpand(wrap, opening, { response: 0.32 });
      if (!opening) s.set({ onDone: () => { d.open = false; s.set({ onDone: null }); } });
    });
  });

  /* ---------- 1. CMP vs TMP：設定連動動畫 ---------- */
  const cmpBtn = $('#btn-cmp'), tmpBtn = $('#btn-tmp'), resetBtn = $('#btn-reset-scheme');
  function clearScheme() {
    $$('#dia-scheme .pulse, #dia-scheme .flow-on, #dia-scheme .dim').forEach((e) => e.classList.remove('pulse', 'flow-on', 'dim'));
    $$('#dia-scheme .status-msg').forEach((e) => (e.textContent = ''));
  }
  async function playCmp() {
    clearScheme();
    $('#cmp-scheme').classList.add('pulse');
    $('#cmp-msg').textContent = 'Jira admin 修改 workflow scheme…';
    await sleep(700);
    $$('#dia-scheme .cmp-link').forEach((l) => l.classList.add('flow-on'));
    await sleep(700);
    $$('#dia-scheme .cmp-proj').forEach((p) => p.classList.add('pulse'));
    $('#cmp-msg').textContent = '三個 project 同時套用新的 workflow';
  }
  async function playTmp() {
    clearScheme();
    $('#tmp-a').classList.add('pulse');
    $('#tmp-msg').textContent = 'Project A 的 admin 修改自己的 workflow…';
    await sleep(900);
    $('#tmp-b').classList.add('dim'); $('#tmp-c').classList.add('dim');
    $('#tmp-msg').textContent = '只有 Project A 改變，B、C 完全不受影響';
  }
  if (cmpBtn) cmpBtn.addEventListener('click', playCmp);
  if (tmpBtn) tmpBtn.addEventListener('click', playTmp);
  if (resetBtn) resetBtn.addEventListener('click', clearScheme);

  /* ---------- 2. 權限加總（access level ∪ roles） ---------- */
  const PERM = {
    browse: '瀏覽 project 與 issue', comment: '留言、加附件', create: '建立 issue',
    edit: '編輯、指派、轉狀態', sprint: '管理 sprint', duedate: '改 due date',
    delany: '刪任何留言／issue', admin: '改 project 設定'
  };
  const ROLE = {
    viewer: ['browse', 'comment'],
    member: ['browse', 'comment', 'create', 'edit', 'sprint', 'duedate'],
    admin: ['browse', 'comment', 'create', 'edit', 'sprint', 'duedate', 'delany', 'admin'],
    reviewer: ['browse', 'comment']
  };
  const LEVEL = { open: 'member', limited: 'viewer', private: null };
  const unionBox = $('#union');
  if (unionBox) {
    const levelBtns = $$('#lvl button');
    const roleChecks = $$('#roles input');
    let prev = new Set();
    const render = () => {
      const lvl = levelBtns.find((b) => b.classList.contains('on')).dataset.lvl;
      const base = LEVEL[lvl];
      const assigned = roleChecks.filter((c) => c.checked).map((c) => c.value);
      const all = new Set([...(base ? ROLE[base] : []), ...assigned.flatMap((r) => ROLE[r])]);
      const baseName = { member: 'Member', viewer: 'Viewer' }[base] || '（無）';
      $('#u-base').innerHTML = `<span class="chip brand">${baseName}</span>` +
        (base ? '' : '<div class="kicker" style="margin-top:6px">Private：未被加入者連 project 都看不到</div>');
      $('#u-roles').innerHTML = assigned.length
        ? assigned.map((r) => `<span class="chip teal">${{ member: 'Member', admin: 'Administrator', reviewer: 'Reviewer（自訂）' }[r]}</span>`).join(' ')
        : '<span class="chip">（沒有指派）</span>';
      const res = $('#u-result');
      res.innerHTML = Object.keys(PERM).map((k) => `<span class="chip ${all.has(k) ? 'on' : 'off'}" data-k="${k}">${PERM[k]}</span>`).join(' ');
      // 剛亮起的 chip 用 spring pop 強調「多了什麼」
      $$('.chip', res).forEach((c) => { if (all.has(c.dataset.k) && !prev.has(c.dataset.k)) pop(c); });
      prev = all;
      $('#u-count').textContent = all.size;
      roleChecks.forEach((c) => c.closest('label').classList.toggle('on', c.checked));
    };
    levelBtns.forEach((b) => b.addEventListener('click', () => { levelBtns.forEach((x) => x.classList.remove('on')); b.classList.add('on'); render(); }));
    roleChecks.forEach((c) => c.addEventListener('change', render));
    render();
  }

  /* ---------- 3. TMP：column ＝ status ---------- */
  const colLab = $('#col-lab');
  if (colLab) {
    const board = $('#board-mock'), list = $('#status-list');
    const palette = ['#7b8296', '#2f56d8', '#0e8a8c', '#b0741c', '#6a45c0'];
    let n = 0;
    function catOf() {
      const cols = $$('.col', board);
      cols.forEach((c, i) => {
        c.classList.remove('done');
        const cat = i === 0 ? 'To do' : i === cols.length - 1 ? 'Done' : 'In progress';
        if (i === cols.length - 1) c.classList.add('done');
        const s = $(`#st-${c.dataset.id} .cat`); if (s) s.textContent = cat;
      });
    }
    const MAX = 3;
    function addCol() {
      if ($$('.col', board).filter((c) => c.dataset.id.startsWith('x')).length >= MAX) { $('#col-msg').textContent = `示範最多加 ${MAX} 個自訂 column；先刪掉再加`; return; }
      n++;
      const id = 'x' + n, name = n === 1 ? 'Review' : 'Column ' + n, color = palette[(n + 2) % palette.length];
      const col = document.createElement('div');
      col.className = 'col'; col.dataset.id = id;
      col.innerHTML = `<div class="ch"><span class="dot" style="background:${color}"></span>${name}</div><div class="cardm"></div>`;
      board.insertBefore(col, $$('.col', board).pop());
      const st = document.createElement('div');
      st.className = 'status new'; st.id = 'st-' + id;
      st.innerHTML = `<span class="dot" style="background:${color}"></span>${name}<span class="cat"></span>`;
      list.appendChild(st);
      pop(col); pop(st);
      catOf();
      $('#col-msg').textContent = `建立 column「${name}」→ 同時生成 status「${name}」，位置在中間所以歸 In progress 類別`;
    }
    $('#btn-addcol').addEventListener('click', addCol);
    $('#btn-delcol').addEventListener('click', () => {
      const cols = $$('.col', board).filter((c) => c.dataset.id.startsWith('x'));
      if (!cols.length) { $('#col-msg').textContent = '沒有可刪的自訂 column（內建的 To do / Done 這裡不示範刪除）'; return; }
      const c = cols.pop(); $('#st-' + c.dataset.id).remove(); c.remove(); catOf();
      $('#col-msg').textContent = '刪除 column → status 一起刪除；若 column 內有 issue，Jira 會要求你指定搬去哪一欄';
    });
    catOf();
    colLab._auto = addCol;
  }

  /* ---------- 4. Issue type ＝ 標籤 + scheme 對應 ---------- */
  const map = $('#dia-map');
  if (map) {
    const MAP = {
      bug: { wf: 'wf-qa', sc: 'sc-bug', fc: 'fc-bug' },
      task: { wf: 'wf-simple', sc: 'sc-default', fc: 'fc-default' },
      story: { wf: 'wf-simple', sc: 'sc-default', fc: 'fc-default' }
    };
    function select(t) {
      $$('.pill', map).forEach((p) => p.classList.toggle('on', p.dataset.t === t));
      $$('.pill-t', map).forEach((p) => p.classList.toggle('on', p.dataset.t === t));
      $$('.rowhl', map).forEach((r) => r.classList.remove('on'));
      $$('.route', map).forEach((r) => r.classList.toggle('on', r.dataset.t === t));
      Object.values(MAP[t]).forEach((id) => $('#hl-' + id).classList.add('on'));
      const names = { bug: 'Bug', task: 'Task', story: 'Story' };
      $('#map-msg').innerHTML = t === 'bug'
        ? `<strong>${names[t]}</strong> 對到 QA workflow（多一個 Verified 狀態）、Bug 專用 screen（Steps to reproduce）、Bug field configuration（Severity 必填）——三張表都不同，所以它值得是獨立的 issue type。`
        : `<strong>${names[t]}</strong> 對到 Simple workflow、Default screen、Default field configuration——和 Story 完全一樣的三張表。如果只是想「分類」，其實用 label 或 component 就夠，不必多一個 type。`;
    }
    $$('.pill-hit', map).forEach((p) => p.addEventListener('click', () => select(p.dataset.t)));
    select('bug');
    map._auto = async () => { select('task'); await sleep(1400); select('story'); await sleep(1400); select('bug'); };
  }

  /* ---------- 5. 階層圖 hover ---------- */
  const hier = $('#dia-hier');
  if (hier) {
    $$('[data-lvl]', hier).forEach((g) => {
      g.addEventListener('mouseenter', () => $$('.hier-cards .card').forEach((c) => c.classList.toggle('hl', c.dataset.lvl === g.dataset.lvl)));
      g.addEventListener('mouseleave', () => $$('.hier-cards .card').forEach((c) => c.classList.remove('hl')));
    });
  }

  /* ---------- 6. Sub-task blocking condition ---------- */
  const sub = $('#sub-lab');
  if (sub) {
    const checks = $$('input', sub), btn = $('#btn-parent-done'), msg = $('#sub-msg');
    const render = () => {
      const done = checks.filter((c) => c.checked).length;
      checks.forEach((c) => { const st = c.closest('.issue').querySelector('.st'); const was = st.classList.contains('done'); st.textContent = c.checked ? 'Done' : 'In Progress'; st.classList.toggle('done', c.checked); if (c.checked && !was) pop(st); });
      const ok = done === checks.length;
      btn.disabled = !ok; if (ok) pop(btn);
      btn.textContent = ok ? 'Done（可轉換）' : `Done（隱藏：還有 ${checks.length - done} 個 sub-task 未完成）`;
      msg.textContent = ok ? 'Subtask Blocking Condition 通過，parent 的 Done 轉換按鈕出現。' : 'Condition 未通過：按鈕根本不會出現在 parent 上（condition 是「藏起來」，validator 才是「按了才擋」）。';
    };
    checks.forEach((c) => c.addEventListener('change', render));
    btn.addEventListener('click', () => { const st = $('#parent-st'); st.textContent = 'Done'; st.classList.add('done'); pop(st); msg.textContent = 'Parent 已轉為 Done。'; });
    render();
  }

  /* ---------- 進入視野自動示範一次（reduced-motion 不自動） ---------- */
  if (!reduced() && 'IntersectionObserver' in window) {
    const targets = [
      [$('#dia-scheme'), playCmp],
      [colLab, () => colLab._auto && colLab._auto()],
      [map, () => map._auto && map._auto()]
    ].filter(([el]) => el);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting || en.intersectionRatio < 0.6) return;
        const hit = targets.find(([el]) => el === en.target);
        if (hit && !en.target.dataset.played) { en.target.dataset.played = '1'; setTimeout(hit[1], 350); }
      });
    }, { threshold: [0.6] });
    targets.forEach(([el]) => io.observe(el));
  }
})();
