/* 題庫渲染與模擬考（需先載入 questions.js、spring.js、app.js） */
(function () {
  const Q = window.ACP_QUESTIONS || [];
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const WEIGHT = { '620.1': 13, '620.2': 29, '620.3': 25, '620.4': 14, '620.5': 19 };
  const DNAME = { '620.1': 'Project Creation', '620.2': 'Board Configuration', '620.3': 'Managing Projects', '620.4': 'Automation', '620.5': 'Reporting' };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* 解析文字允許少數排版標籤（資料來自本專案的 questions.js，非使用者輸入）：
     先整段 escape，再把白名單標籤還原，其餘一律當純文字顯示。 */
  const RICH_OK = /&lt;(\/?)(strong|em|b|i|code)&gt;/g;
  const rich = (s) => esc(s).replace(RICH_OK, '<$1$2>').replace(/&lt;br\s*\/?&gt;/g, '<br>');
  const shuffle = (a, rng = Math.random) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  /* ---------- 一題的 HTML（練習模式：選了就顯示解析） ---------- */
  function renderQ(q, idx, mode) {
    const letters = ['A', 'B', 'C', 'D'];
    const opts = letters.map((L, i) => `<label class="qopt" data-l="${L}"><input type="radio" name="${q.id}" value="${L}"><span class="ql">${L}</span><span class="qt">${esc(q.options[i])}</span></label>`).join('');
    const meta = `<span class="qmeta">${q.section}${q.difficulty ? ' · 難度 ' + '★'.repeat(q.difficulty) : ''}${q.version_note ? ' · <span class="qver">考試版／現行版不同</span>' : ''}</span>`;
    return `<article class="qb" data-id="${q.id}" data-answer="${q.answer}">
      <div class="qhead"><span class="qn">${idx + 1}</span><div class="qstem">${esc(q.stem)}${meta}</div></div>
      <div class="qopts">${opts}</div>
      <div class="qfeed" hidden></div>
    </article>`;
  }
  function feedbackHTML(q, chosen) {
    const ok = chosen === q.answer;
    const rows = ['A', 'B', 'C', 'D'].map((L) => `<li class="${L === q.answer ? 'right' : ''} ${L === chosen && !ok ? 'wrong' : ''}"><strong>${L}</strong>　${rich(q.explain[L])}</li>`).join('');
    const src = (q.sources || []).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc((u.replace(/^https?:\/\/(support\.)?atlassian\.com\//, '') || u).slice(0, 70))}</a>`).join('、');
    return `<div class="qverdict ${ok ? 'ok' : 'no'}">${ok ? '✓ 答對' : '✗ 答錯，正解 ' + q.answer}</div>
      ${q.version_note ? `<div class="callout warn" style="margin:.5rem 0"><div class="t">考試版／現行版</div>${rich(q.version_note)}</div>` : ''}
      <ul class="qexp">${rows}</ul><div class="qsrc">來源：${src}</div>`;
  }
  function bindPractice(root) {
    $$('.qb', root).forEach((art) => {
      const q = Q.find((x) => x.id === art.dataset.id);
      $$('input', art).forEach((inp) => inp.addEventListener('change', () => {
        const feed = $('.qfeed', art); feed.innerHTML = feedbackHTML(q, inp.value); feed.hidden = false;
        $$('.qopt', art).forEach((l) => { l.classList.toggle('chosen', l.dataset.l === inp.value); l.classList.toggle('correct', l.dataset.l === q.answer); l.classList.toggle('wrongpick', l.dataset.l === inp.value && inp.value !== q.answer); });
        $$('input', art).forEach((x) => (x.disabled = true));
        if (window.springPop && !reduced()) window.springPop(feed);
        const stat = store.get('acp620-practice', {}); stat[q.id] = inp.value === q.answer; store.set('acp620-practice', stat);
      }));
    });
  }

  /* ---------- 每頁「模擬題」區：<div class="qbank" data-section="620.2.4"></div> ---------- */
  $$('.qbank').forEach((box) => {
    const sec = box.dataset.section;
    const list = Q.filter((q) => q.section === sec);
    if (!list.length) { box.innerHTML = '<p class="kicker">此節題庫尚未就緒。</p>'; return; }
    const stat = store.get('acp620-practice', {});
    const done = list.filter((q) => q.id in stat).length, right = list.filter((q) => stat[q.id] === true).length;
    box.innerHTML = `<div class="toolbar" style="margin-top:0"><span class="kicker">本節 ${list.length} 題 · 已作答 ${done}，答對 ${right}</span><button class="btn ghost sm" data-act="show">全部展開</button><button class="btn ghost sm" data-act="reset">重置本節作答</button></div><div class="qlist" hidden>${list.map((q, i) => renderQ(q, i, 'practice')).join('')}</div>`;
    const qlist = $('.qlist', box); bindPractice(qlist);
    $('[data-act=show]', box).addEventListener('click', (e) => { qlist.hidden = !qlist.hidden; e.target.textContent = qlist.hidden ? '全部展開' : '收合'; });
    $('[data-act=reset]', box).addEventListener('click', () => { const s = store.get('acp620-practice', {}); list.forEach((q) => delete s[q.id]); store.set('acp620-practice', s); box.dispatchEvent(new Event('rerender')); location.reload(); });
  });

  /* ---------- 模擬考頁 ---------- */
  const exam = $('#exam');
  if (!exam) return;
  const N = 63, MIN = 180;
  let state = store.get('acp620-exam-state', null);

  function pick(domainOnly) {
    if (domainOnly) return shuffle(Q.filter((q) => q.domain === domainOnly)).slice(0, Math.min(N, Q.filter((q) => q.domain === domainOnly).length));
    const out = []; let remain = N;
    const doms = Object.keys(WEIGHT);
    const target = doms.map((d) => [d, Math.round(N * WEIGHT[d] / 100)]);
    // 修正四捨五入總和
    let sum = target.reduce((a, [, n]) => a + n, 0); target[1][1] += N - sum;
    target.forEach(([d, n]) => { out.push(...shuffle(Q.filter((q) => q.domain === d)).slice(0, n)); });
    return shuffle(out);
  }
  function start(domainOnly) {
    const qs = pick(domainOnly);
    state = { ids: qs.map((q) => q.id), answers: {}, started: Date.now(), submitted: null, domain: domainOnly || 'all', cur: 0 };
    store.set('acp620-exam-state', state); renderExam();
  }
  function fmt(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
  let timer = 0;
  function renderExam() {
    clearInterval(timer);
    if (!state) return renderHome();
    if (state.submitted) return renderReview();
    const qs = state.ids.map((id) => Q.find((q) => q.id === id));
    const answered = Object.keys(state.answers).length;
    exam.innerHTML = `<div class="exam-top card">
        <div><strong>模擬考</strong> <span class="kicker">${state.domain === 'all' ? '全範圍' : DNAME[state.domain]} · ${qs.length} 題 · ${MIN} 分鐘</span></div>
        <div class="exam-timer" id="exam-timer">--:--:--</div>
        <div class="kicker">已作答 <span id="exam-done">${answered}</span>／${qs.length}</div>
        <button class="btn" id="exam-submit">交卷</button><button class="btn ghost sm" id="exam-abort">放棄</button>
      </div>
      <div class="exam-grid" id="exam-grid">${qs.map((q, i) => `<button class="exam-dot ${state.answers[q.id] ? 'on' : ''}" data-i="${i}">${i + 1}</button>`).join('')}</div>
      <div id="exam-q"></div>`;
    const showQ = (i) => {
      state.cur = i; store.set('acp620-exam-state', state);
      const q = qs[i]; const chosen = state.answers[q.id];
      $('#exam-q').innerHTML = `<article class="qb" data-id="${q.id}">
        <div class="qhead"><span class="qn">${i + 1}</span><div class="qstem">${esc(q.stem)}</div></div>
        <div class="qopts">${['A','B','C','D'].map((L, k) => `<label class="qopt ${chosen === L ? 'chosen' : ''}" data-l="${L}"><input type="radio" name="ex-${q.id}" value="${L}" ${chosen === L ? 'checked' : ''}><span class="ql">${L}</span><span class="qt">${esc(q.options[k])}</span></label>`).join('')}</div>
        <div class="toolbar"><button class="btn ghost" id="exam-prev" ${i === 0 ? 'disabled' : ''}>← 上一題</button><button class="btn ghost" id="exam-next" ${i === qs.length - 1 ? 'disabled' : ''}>下一題 →</button><span class="kicker">${q.section}</span></div>
      </article>`;
      $$('#exam-q input').forEach((inp) => inp.addEventListener('change', () => { state.answers[q.id] = inp.value; store.set('acp620-exam-state', state); $$('.qopt', $('#exam-q')).forEach((l) => l.classList.toggle('chosen', l.dataset.l === inp.value)); $$('.exam-dot')[i].classList.add('on'); $('#exam-done').textContent = Object.keys(state.answers).length; }));
      $('#exam-prev').addEventListener('click', () => showQ(i - 1)); $('#exam-next').addEventListener('click', () => showQ(i + 1));
      $$('.exam-dot').forEach((d) => d.classList.toggle('cur', +d.dataset.i === i));
    };
    $$('.exam-dot').forEach((d) => d.addEventListener('click', () => showQ(+d.dataset.i)));
    $('#exam-submit').addEventListener('click', () => submit());
    $('#exam-abort').addEventListener('click', () => { state = null; store.set('acp620-exam-state', null); renderHome(); });
    const tick = () => { const left = state.started + MIN * 60000 - Date.now(); $('#exam-timer').textContent = fmt(left); if (left <= 0) submit(true); };
    tick(); timer = setInterval(tick, 1000);
    showQ(state.cur || 0);
  }
  function submit(auto) {
    clearInterval(timer);
    const qs = state.ids.map((id) => Q.find((q) => q.id === id));
    const right = qs.filter((q) => state.answers[q.id] === q.answer).length;
    state.submitted = Date.now(); state.score = right; state.auto = !!auto; store.set('acp620-exam-state', state);
    const hist = store.get('acp620-exam-history', []); hist.unshift({ at: state.submitted, domain: state.domain, total: qs.length, right, byDomain: Object.fromEntries(Object.keys(WEIGHT).map((d) => [d, [qs.filter((q) => q.domain === d && state.answers[q.id] === q.answer).length, qs.filter((q) => q.domain === d).length]])) }); store.set('acp620-exam-history', hist.slice(0, 20));
    renderReview();
  }
  function renderReview() {
    const qs = state.ids.map((id) => Q.find((q) => q.id === id));
    const right = state.score; const pass = right / qs.length >= 38 / 63;
    const byD = Object.keys(WEIGHT).map((d) => { const dq = qs.filter((q) => q.domain === d); const r = dq.filter((q) => state.answers[q.id] === q.answer).length; return `<tr><td>${d} ${DNAME[d]}</td><td class="c">${r}／${dq.length}</td><td class="c">${dq.length ? Math.round(100 * r / dq.length) : 0}%</td></tr>`; }).join('');
    exam.innerHTML = `<div class="card">
      <div class="hero-num" style="color:${pass ? 'var(--green)' : 'var(--rose)'}">${right}／${qs.length}</div>
      <p><strong>${pass ? '達到及格線' : '未達及格線'}</strong>（正式考 63 題答對 38 題，約 60%）${state.auto ? '，本次因時間到自動交卷' : ''}。</p>
      <div class="tbl-wrap"><table class="tbl"><tr><th>Domain</th><th class="c">答對</th><th class="c">正確率</th></tr>${byD}</table></div>
      <div class="toolbar"><button class="btn" id="exam-again">再考一次</button><button class="btn ghost" id="exam-wrong">只看錯題</button><button class="btn ghost" id="exam-all">看全部題目</button><button class="btn ghost sm" id="exam-home">回首頁</button></div>
    </div><div id="exam-review" class="qlist"></div>`;
    const show = (onlyWrong) => {
      const list = onlyWrong ? qs.filter((q) => state.answers[q.id] !== q.answer) : qs;
      $('#exam-review').innerHTML = list.map((q, i) => { const chosen = state.answers[q.id]; return `<article class="qb" data-id="${q.id}"><div class="qhead"><span class="qn">${qs.indexOf(q) + 1}</span><div class="qstem">${esc(q.stem)}<span class="qmeta">${q.section}</span></div></div>
        <div class="qopts">${['A','B','C','D'].map((L, k) => `<div class="qopt static ${L === q.answer ? 'correct' : ''} ${chosen === L && chosen !== q.answer ? 'chosen wrongpick' : ''}"><span class="ql">${L}</span><span class="qt">${esc(q.options[k])}</span></div>`).join('')}</div>
        <div class="qfeed">${feedbackHTML(q, chosen || '—')}</div></article>`; }).join('') || '<p class="kicker">沒有錯題。</p>';
    };
    $('#exam-again').addEventListener('click', () => start(state.domain === 'all' ? null : state.domain));
    $('#exam-wrong').addEventListener('click', () => show(true)); $('#exam-all').addEventListener('click', () => show(false));
    $('#exam-home').addEventListener('click', () => { state = null; store.set('acp620-exam-state', null); renderHome(); });
    show(true);
  }
  function renderHome() {
    const hist = store.get('acp620-exam-history', []);
    const counts = Object.keys(WEIGHT).map((d) => `<tr><td>${d} ${DNAME[d]}</td><td class="c">${WEIGHT[d]}%</td><td class="c">${Math.round(N * WEIGHT[d] / 100)}</td><td class="c">${Q.filter((q) => q.domain === d).length}</td><td class="c"><button class="btn ghost sm" data-dom="${d}">只練此 domain</button></td></tr>`).join('');
    const h = hist.map((r) => `<tr><td>${new Date(r.at).toLocaleString('zh-TW')}</td><td>${r.domain === 'all' ? '全範圍' : DNAME[r.domain]}</td><td class="c">${r.right}／${r.total}</td><td class="c">${Math.round(100 * r.right / r.total)}%</td></tr>`).join('');
    exam.innerHTML = `<div class="card">
      <p>正式考試 <strong>63 題、180 分鐘、答對 38 題及格</strong>。模擬考依認證頁公布的 domain 比重從題庫隨機抽 63 題，計時 180 分鐘，交卷後逐題回顧與錯題解析。作答進度存在瀏覽器，重新整理不會遺失。</p>
      <div class="tbl-wrap"><table class="tbl"><tr><th>Domain</th><th class="c">比重</th><th class="c">抽題數</th><th class="c">題庫題數</th><th class="c"></th></tr>${counts}</table></div>
      <div class="toolbar"><button class="btn" id="exam-start">開始全範圍模擬考（63 題）</button><span class="kicker">題庫共 ${Q.length} 題</span></div>
    </div>
    ${hist.length ? `<h3>歷史成績</h3><div class="tbl-wrap"><table class="tbl"><tr><th>時間</th><th>範圍</th><th class="c">分數</th><th class="c">正確率</th></tr>${h}</table></div>` : ''}`;
    $('#exam-start').addEventListener('click', () => start(null));
    $$('[data-dom]', exam).forEach((b) => b.addEventListener('click', () => start(b.dataset.dom)));
  }
  renderExam();
})();
