/* ACP-620 教材 v2：導覽抽屜、主題、目錄、閱讀進度、已讀標記、圖鑑篩選 */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const KEY = 'acp620.v2';
  const db = {
    load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } },
    save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
  };
  window.ACP = window.ACP || {};
  window.ACP.db = db;

  /* ---------- 主題 ---------- */
  const root = document.documentElement;
  const themeBtn = $('#theme');
  const sysDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
  const curTheme = () => root.dataset.theme || (sysDark() ? 'dark' : 'light');
  const paintTheme = () => {
    if (!themeBtn) return;
    const dark = curTheme() === 'dark';
    themeBtn.setAttribute('aria-label', dark ? '切換為淺色' : '切換為深色');
    themeBtn.innerHTML = dark
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  };
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = curTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('acp620.theme', next); } catch (e) {}
      paintTheme();
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintTheme);
    paintTheme();
  }

  /* ---------- 導覽抽屜（< 1100px） ---------- */
  const body = document.body;
  const menu = $('#menu'), nav = $('#nav'), scrim = $('#scrim');
  const setNav = (open) => {
    body.classList.toggle('nav-open', open);
    if (menu) menu.setAttribute('aria-expanded', String(open));
    if (open && nav) { const a = $('a.it.on', nav) || $('a', nav); a && a.focus({ preventScroll: true }); }
    if (!open && menu && document.activeElement && nav && nav.contains(document.activeElement)) menu.focus();
  };
  if (menu) menu.addEventListener('click', () => setNav(!body.classList.contains('nav-open')));
  if (scrim) scrim.addEventListener('click', () => setNav(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && body.classList.contains('nav-open')) setNav(false); });
  if (nav) nav.addEventListener('click', (e) => { if (e.target.closest('a') && innerWidth < 1100) setNav(false); });

  /* ---------- 側欄：目前頁、已讀點 ---------- */
  const here = (location.pathname.split('/').pop() || 'index.html');
  const data = db.load();
  $$('#nav a.it').forEach((a) => {
    const href = a.getAttribute('href');
    if (href === here) { a.classList.add('on'); a.setAttribute('aria-current', 'page'); const g = a.closest('details'); if (g) g.open = true; }
    const sec = a.dataset.sec;
    if (sec && data.read && data.read[sec]) a.insertAdjacentHTML('beforeend', '<i class="done" title="已讀"></i>');
  });
  // 倒數（側欄）
  const cd = $('#nav-count');
  if (cd) {
    const exam = new Date('2026-09-28T10:00:00+08:00').getTime();
    const left = exam - Date.now();
    if (left > 0) {
      const d = Math.floor(left / 864e5), h = Math.floor(left % 864e5 / 36e5);
      cd.innerHTML = `距離考試 <b>${d}</b> 天 <b>${h}</b> 小時`;
    } else cd.textContent = '考試日已到，祝順利！';
  }

  /* ---------- 本頁目錄：scrollspy ---------- */
  const tocLinks = $$('#toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    const map = new Map(tocLinks.map((a) => [a.getAttribute('href').slice(1), a]));
    let current = null;
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => { if (en.isIntersecting) current = en.target.id; });
      if (current) tocLinks.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + current));
    }, { rootMargin: '-20% 0px -70% 0px' });
    map.forEach((a, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* ---------- 閱讀進度條 ---------- */
  const rb = $('#readbar');
  if (rb) {
    let raf = 0;
    const upd = () => { raf = 0; const h = document.documentElement; const max = h.scrollHeight - h.clientHeight; rb.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%'; };
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
    upd();
  }

  /* ---------- 標記本節已讀 ---------- */
  $$('[data-readmark]').forEach((box) => {
    const sec = box.dataset.readmark;
    const btn = $('button', box), msg = $('.msg', box);
    const paint = () => {
      const d = db.load(); const t = d.read && d.read[sec];
      btn.textContent = t ? '取消已讀' : '標記本節已讀';
      btn.classList.toggle('ghost', !!t);
      msg.textContent = t ? `已於 ${new Date(t).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 標記已讀。記得做完本節練習題。` : '讀完這一節後按一下，首頁的進度會更新。';
    };
    btn.addEventListener('click', () => { const d = db.load(); d.read = d.read || {}; if (d.read[sec]) delete d.read[sec]; else d.read[sec] = Date.now(); db.save(d); paint(); });
    paint();
  });

  /* ---------- 通用篩選（圖鑑） ---------- */
  $$('[data-filter]').forEach((wrap) => {
    const items = $$(wrap.dataset.filter);
    const q = $('input[type=search]', wrap);
    const groups = $$('.seg', wrap);
    const count = $('.fcount', wrap);
    const apply = () => {
      const text = (q && q.value.trim().toLowerCase()) || '';
      const need = groups.map((g) => { const on = $('button[aria-pressed="true"]', g); return on ? on.dataset.v : '*'; });
      let n = 0;
      items.forEach((it) => {
        const tags = (it.dataset.tags || '').split(' ');
        const okTags = need.every((v) => v === '*' || tags.includes(v));
        const okText = !text || it.textContent.toLowerCase().includes(text);
        it.hidden = !(okTags && okText); if (!it.hidden) n++;
      });
      if (count) count.textContent = `顯示 ${n}／${items.length}`;
    };
    groups.forEach((g) => $$('button', g).forEach((b) => b.addEventListener('click', () => { $$('button', g).forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); apply(); })));
    if (q) q.addEventListener('input', apply);
    apply();
  });

  /* ---------- 分頁切換（例如 CMP／TMP） ---------- */
  $$('[data-tabs]').forEach((box) => {
    const btns = $$('.seg button', box), panes = $$('[data-pane]', box);
    const show = (v) => { btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v))); panes.forEach((p) => (p.hidden = p.dataset.pane !== v)); };
    btns.forEach((b) => b.addEventListener('click', () => show(b.dataset.v)));
    show(btns[0] && btns[0].dataset.v);
  });

  /* ---------- 驗收模式：?audit=1 列出超出視窗寬度的元素 ---------- */
  if (/[?&]audit=1/.test(location.search)) {
    addEventListener('load', () => {
      const W = document.documentElement.clientWidth, bad = [];
      $$('body *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > W + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed' && !el.closest('.nav') && !el.classList.contains('skip')) bad.push((el.tagName + '.' + (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className)).slice(0, 60) + ' w=' + Math.round(r.width) + ' r=' + Math.round(r.right));
      });
      const pre = document.createElement('pre'); pre.id = 'audit-out';
      pre.textContent = JSON.stringify({ W, sw: document.documentElement.scrollWidth, n: bad.length, bad: bad.slice(0, 40) });
      document.body.appendChild(pre);
    });
  }
})();
