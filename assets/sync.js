/* ACP 教材：作答紀錄的變更通知與雲端同步（Firebase，選用）
 * 1. 攔截 localStorage 對本站紀錄（CFG.key）的寫入，發出 'acp:data' 事件，讓題數、錯題數即時更新（含其他分頁）。
 * 2. 有 CFG.fb（Firebase 設定）時，在導覽列加「雲端同步」：用 Google 登入後，
 *    紀錄存在 Firestore 的 u/{uid}/s/{CFG.key}；開頁與切回分頁時拉取合併，變更後 3 秒推送。
 *    合併規則：作答紀錄 att 與模擬考 exams 取聯集；其他欄位（不懂、已讀、計畫、Lab、考試日…）以較晚修改的一方為準。 */
(function () {
  'use strict';
  const CFG = window.ACP_CFG || {};
  const KEY = CFG.key;
  if (!KEY) return;
  const FT = KEY + '.ft';            // 每個欄位最後修改時間
  const SY = KEY + '.sync';          // 最後同步時間
  let applying = false, prev = null;

  const raw = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const parse = (s) => { try { return JSON.parse(s) || {}; } catch (e) { return {}; } };
  const getFT = () => parse((() => { try { return localStorage.getItem(FT); } catch (e) { return '{}'; } })());
  const setFT = (o) => { try { localStorage.setItem(FT, JSON.stringify(o)); } catch (e) {} };

  /* ---------- 變更通知 ---------- */
  let pending = 0;
  const notify = () => { if (pending) return; pending = setTimeout(() => { pending = 0; window.dispatchEvent(new CustomEvent('acp:data')); }, 0); };
  function bumpFields(oldS, newS) {
    if (applying) return;
    const a = parse(oldS), b = parse(newS), ft = getFT(), now = Date.now();
    new Set([...Object.keys(a), ...Object.keys(b)]).forEach((k) => {
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) ft[k] = now;
    });
    setFT(ft);
  }
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    const isMine = this === window.localStorage && k === KEY;
    const before = isMine ? raw() : null;
    orig.call(this, k, v);
    if (isMine) { bumpFields(before, v); notify(); schedulePush(); }
  };
  window.addEventListener('storage', (e) => { if (e.key === KEY) notify(); });   // 其他分頁改了

  /* ---------- 合併 ---------- */
  function merge(L, R, ftL, ftR) {
    const out = {}, ft = {};
    const keys = new Set([...Object.keys(L), ...Object.keys(R)]);
    keys.forEach((k) => {
      if (k === 'att') {
        const att = {};
        new Set([...Object.keys(L.att || {}), ...Object.keys(R.att || {})]).forEach((id) => {
          const m = new Map();
          [...((L.att || {})[id] || []), ...((R.att || {})[id] || [])].forEach((x) => m.set(x[0] + '|' + x[3] + '|' + x[1], x));
          att[id] = [...m.values()].sort((x, y) => x[0] - y[0]);
        });
        out.att = att; ft.att = Math.max(ftL.att || 0, ftR.att || 0);
      } else if (k === 'exams') {
        const m = new Map();
        [...(L.exams || []), ...(R.exams || [])].forEach((e) => { const o = m.get(e.id); if (!o || (!o.t1 && e.t1)) m.set(e.id, e); });
        out.exams = [...m.values()].sort((x, y) => (x.t0 || 0) - (y.t0 || 0)); ft.exams = Math.max(ftL.exams || 0, ftR.exams || 0);
      } else {
        const useR = (ftR[k] || 0) > (ftL[k] || 0) || !(k in L);
        if (useR) { if (k in R) out[k] = R[k]; ft[k] = ftR[k] || 0; }
        else { if (k in L) out[k] = L[k]; ft[k] = ftL[k] || 0; }
      }
    });
    return { data: out, ft };
  }

  /* ---------- Firebase ---------- */
  if (!CFG.fb) return;
  const V = '10.12.2';
  const SDK = ['app', 'auth', 'firestore'].map((m) => `https://www.gstatic.com/firebasejs/${V}/firebase-${m}-compat.js`);
  let fb = null, user = null, timer = 0, busy = false, ui = null;

  function loadSDK() {
    return SDK.reduce((p, src) => p.then(() => new Promise((ok, bad) => {
      const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s);
    })), Promise.resolve());
  }
  const docRef = () => fb.firestore().collection('u').doc(user.uid).collection('s').doc(KEY);
  const fmt = (t) => new Date(t).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  function paint(state, msg) {
    if (!ui) return;
    const last = (() => { try { return +localStorage.getItem(SY) || 0; } catch (e) { return 0; } })();
    if (!user) {
      ui.innerHTML = `<span>雲端同步：未登入</span><button type="button" class="btn sm ghost" data-a="in">用 Google 登入</button>${msg ? `<small class="err">${msg}</small>` : ''}`;
    } else {
      const st = state === 'busy' ? '同步中…' : state === 'err' ? '同步失敗' : (last ? `已同步 ${fmt(last)}` : '已登入');
      ui.innerHTML = `<span>雲端同步：${st}</span><small>${user.email || ''}</small><button type="button" class="btn sm ghost" data-a="out">登出</button>${msg ? `<small class="err">${msg}</small>` : ''}`;
    }
    const b = ui.querySelector('button');
    if (b) b.onclick = () => (b.dataset.a === 'in' ? signIn() : fb.auth().signOut());
  }
  function signIn() {
    const p = new fb.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    fb.auth().signInWithPopup(p).catch((e) => {
      if (/popup/i.test(e.code || '')) return fb.auth().signInWithRedirect(p);
      paint('err', '登入失敗：' + (e.code || e.message));
    });
  }
  async function pull() {
    if (!user || busy) return;
    busy = true; paint('busy');
    try {
      const snap = await docRef().get();
      const L = parse(raw()), ftL = getFT();
      if (snap.exists) {
        const r = snap.data();
        const m = merge(L, parse(r.data), ftL, parse(r.ft));
        const ms = JSON.stringify(m.data);
        if (ms !== raw()) { applying = true; localStorage.setItem(KEY, ms); applying = false; setFT(m.ft); }
        if (ms !== r.data) await docRef().set({ data: ms, ft: JSON.stringify(m.ft), at: Date.now() });
      } else if (raw()) {
        await docRef().set({ data: raw(), ft: JSON.stringify(ftL), at: Date.now() });
      }
      localStorage.setItem(SY, String(Date.now())); paint('ok');
    } catch (e) {
      paint('err', e.code === 'permission-denied' ? '這個帳號沒有雲端同步權限' : (e.code || e.message));
    } finally { busy = false; }
  }
  function schedulePush() {
    if (!fb || !user || applying) return;
    clearTimeout(timer); timer = setTimeout(pull, 3000);   // 推送前先拉取合併，避免覆蓋其他設備的紀錄
  }

  function mountUI() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    ui = document.createElement('div');
    ui.className = 'sync';
    const cnt = document.getElementById('nav-count');
    (cnt ? cnt.parentNode.insertBefore(ui, cnt.nextSibling) : nav.prepend(ui));
    paint();
  }

  function start() {
    mountUI();
    loadSDK().then(() => {
      fb = window.firebase;
      fb.initializeApp(CFG.fb);
      fb.auth().getRedirectResult().catch(() => {});
      fb.auth().onAuthStateChanged((u) => { user = u; paint(); if (u) pull(); });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); else if (timer) { clearTimeout(timer); pull(); } });
    }).catch(() => paint('err', '無法載入同步元件'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
