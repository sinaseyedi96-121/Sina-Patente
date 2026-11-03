'use strict';

const EXAM_SIZE = 30;
const EXAM_SECONDS = 20 * 60;
const MAX_ERRORS = 3;
const STORE_KEY = 'patente.v1';

const app = document.getElementById('app');
const sheet = document.getElementById('sheet');
const sheetBody = document.getElementById('sheet-body');

let CHAPTERS = [];
const Q = new Map();          // id -> {id, ch, img, ans, th, text}
const BY_CH = new Map();      // chapter -> [ids]
let THEORY = {};              // id -> [title, text]
const TR = { q: {}, t: {}, chapters: new Set() };
let S = loadState();
let session = null;
let timerId = null;

/* ---------- storage ---------- */
function loadState() {
  const base = { st: {}, bm: [], exams: [], tab: 'en' };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? Object.assign(base, JSON.parse(raw)) : base;
  } catch (e) { return base; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ }
}

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const imgSrc = n => `images/${String(n).padStart(3, '0')}.gif`;
const pad2 = n => String(n).padStart(2, '0');
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const pick = a => a[Math.floor(Math.random() * a.length)];
const chName = n => CHAPTERS.find(c => c.n === n);
const isBm = id => S.bm.includes(id);
const wrongIds = () => Object.keys(S.st).filter(k => S.st[k].w && Q.has(+k)).map(Number);

const ICON = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8-4.3-4.1 5.9-.8z"/></svg>'
};

/* ---------- data ---------- */
async function loadData() {
  const [qr, tr] = await Promise.all([fetch('data/questions.json'), fetch('data/theory.json')]);
  const qd = await qr.json();
  THEORY = await tr.json();
  CHAPTERS = qd.chapters;
  for (const [id, ch, img, ans, th, text] of qd.q) {
    Q.set(id, { id, ch, img, ans, th, text });
    if (!BY_CH.has(ch)) BY_CH.set(ch, []);
    BY_CH.get(ch).push(id);
  }
  await Promise.all(CHAPTERS.map(async c => {
    try {
      const r = await fetch(`data/tr/ch${pad2(c.n)}.json`, { cache: 'no-cache' });
      if (!r.ok) return;
      const d = await r.json();
      Object.assign(TR.q, d.q || {});
      Object.assign(TR.t, d.t || {});
      if (d.q && Object.keys(d.q).length) TR.chapters.add(c.n);
    } catch (e) { /* chapter not translated yet */ }
  }));
}

/* ---------- home ---------- */
function chapterProgress(n) {
  const ids = BY_CH.get(n) || [];
  let done = 0;
  for (const id of ids) { const s = S.st[id]; if (s && s.c > 0 && !s.w) done++; }
  return { done, total: ids.length };
}

function renderHome() {
  stopTimer();
  session = null;
  const w = wrongIds().length;
  const b = S.bm.filter(id => Q.has(id)).length;
  const last = S.exams[S.exams.length - 1];
  const passes = S.exams.slice(-10).filter(e => e.errors <= MAX_ERRORS).length;
  const recent = Math.min(S.exams.length, 10);

  app.innerHTML = `
    <header class="home-head">
      <div class="badge" aria-hidden="true">B</div>
      <div><h1>Patente B</h1><p>${Q.size.toLocaleString()} official quiz questions</p></div>
    </header>

    <button class="exam-card" data-act="exam">
      <div class="ring" aria-hidden="true">30</div>
      <div><strong>Take a mock exam</strong><span>30 questions, 20 minutes, up to 3 mistakes to pass</span></div>
    </button>
    ${last ? `<p class="last-exam">Last exam: ${EXAM_SIZE - last.errors}/${EXAM_SIZE}, ${last.errors <= MAX_ERRORS ? 'passed' : 'failed'}. Passed ${passes} of the last ${recent}.</p>` : ''}

    <div class="row-pair">
      <button class="tile" data-act="wrong" ${w ? '' : 'disabled'}><strong>Wrong answers</strong><span>${w ? `${w} to review` : 'None yet'}</span></button>
      <button class="tile" data-act="bookmarks" ${b ? '' : 'disabled'}><strong>Bookmarks</strong><span>${b ? `${b} saved` : 'Star a question to save it'}</span></button>
    </div>

    <h2 class="section-title">Practice by chapter</h2>
    <ul class="chapters">
      ${CHAPTERS.map(c => {
        const p = chapterProgress(c.n);
        const pct = p.total ? Math.round(p.done / p.total * 100) : 0;
        return `<li><button data-act="chapter" data-ch="${c.n}">
          <span class="num">${c.n}</span>
          <span class="name">${esc(c.it)}${TR.chapters.has(c.n) ? '<span class="tr-dot" title="English added"></span>' : ''}<small>${esc(c.en)}</small><div class="bar"><i style="width:${pct}%"></i></div></span>
          <span class="pct">${p.done}/${p.total}</span>
        </button></li>`;
      }).join('')}
    </ul>

    <p class="footnote">English added for ${TR.chapters.size} of ${CHAPTERS.length} chapters (green dot).
      Progress is saved on this device. <button data-act="export">Copy backup</button> · <button data-act="import">Restore backup</button></p>
  `;
}

/* ---------- sessions ---------- */
function practiceOrder(ids) {
  const wrong = [], fresh = [], seen = [];
  for (const id of ids) {
    const s = S.st[id];
    if (!s) fresh.push(id); else if (s.w) wrong.push(id); else seen.push(id);
  }
  return [...shuffle(wrong), ...shuffle(fresh), ...shuffle(seen)];
}

function buildExam() {
  const picked = new Set();
  for (const c of CHAPTERS) picked.add(pick(BY_CH.get(c.n)));
  const all = [...Q.keys()];
  while (picked.size < EXAM_SIZE) picked.add(pick(all));
  return [...picked].sort((a, b) => Q.get(a).ch - Q.get(b).ch);
}

function start(mode, opts = {}) {
  let ids, title;
  if (mode === 'exam') { ids = buildExam(); title = 'Mock exam'; }
  else if (mode === 'chapter') { ids = practiceOrder(BY_CH.get(opts.ch)); const c = chName(opts.ch); title = `${c.n}. ${c.it}`; }
  else if (mode === 'wrong') { ids = shuffle(wrongIds()); title = 'Wrong answers'; }
  else { ids = shuffle(S.bm.filter(id => Q.has(id))); title = 'Bookmarks'; }
  if (!ids.length) return renderHome();
  session = { mode, title, ids, i: 0, results: [], picked: null, showTr: false, ch: opts.ch };
  if (mode === 'exam') { session.endsAt = Date.now() + EXAM_SECONDS * 1000; startTimer(); }
  window.scrollTo(0, 0);
  renderQuestion();
}

function record(id, correct) {
  const s = S.st[id] || { s: 0, c: 0, w: 0 };
  s.s++; if (correct) { s.c++; s.w = 0; } else { s.w = 1; }
  S.st[id] = s;
  save();
}

/* ---------- question screen ---------- */
function renderQuestion() {
  const id = session.ids[session.i];
  const q = Q.get(id);
  const answered = session.picked !== null;
  const correct = answered && session.picked === q.ans;
  const isExam = session.mode === 'exam';
  const errors = session.results.filter(r => !r.ok).length;
  const last = session.i === session.ids.length - 1;
  const en = TR.q[id];

  const sub = isExam
    ? `Question ${session.i + 1} of ${session.ids.length} · ${errors} ${errors === 1 ? 'mistake' : 'mistakes'}`
    : `${session.i + 1} of ${session.ids.length}`;

  app.innerHTML = `
    <div class="qbar">
      <button class="icon-btn" data-act="quit" aria-label="Close">${ICON.close}</button>
      <div class="meta"><b>${esc(session.title)}</b><span>${sub}</span></div>
      ${isExam ? `<span class="timer" id="timer">${fmtTime()}</span>` : ''}
      <button class="icon-btn star ${isBm(id) ? 'on' : ''}" data-act="star" aria-pressed="${isBm(id)}" aria-label="Bookmark">${ICON.star}</button>
    </div>

    ${q.img ? `<div class="plate"><img src="${imgSrc(q.img)}" alt="Sign or diagram for this question"></div>` : ''}
    <p class="question" lang="it">${esc(q.text)}</p>
    <button class="reveal" data-act="tr" aria-expanded="${session.showTr}">${session.showTr ? 'Hide English' : 'Show English'}</button>
    ${session.showTr ? (en
      ? `<p class="translation" lang="en">${esc(en)}</p>`
      : `<p class="translation missing">English for this chapter hasn't been added yet.</p>`) : ''}

    <div class="answers ${answered ? 'answered' : ''}">
      <button class="sign vero ${session.picked === 1 ? 'picked' : ''}" data-act="answer" data-v="1" ${answered ? 'disabled' : ''}><span class="lbl">VERO<small>True</small></span></button>
      <button class="sign falso ${session.picked === 0 ? 'picked' : ''}" data-act="answer" data-v="0" ${answered ? 'disabled' : ''}><span class="lbl">FALSO<small>False</small></span></button>
    </div>

    ${answered ? `
      <div class="verdict ${correct ? 'ok' : 'no'}">
        <span class="mark" aria-hidden="true">${correct ? '✓' : '✕'}</span>
        <div><b>${correct ? 'Correct' : 'Wrong'}</b>The answer is ${q.ans ? 'VERO (true)' : 'FALSO (false)'}.</div>
      </div>
      <div class="actions">
        ${q.th && THEORY[q.th] ? '<button class="btn" data-act="theory">Theory</button>' : ''}
        <button class="btn primary" data-act="next">${last ? (isExam ? 'See result' : 'Finish') : 'Next'}</button>
      </div>` : ''}
  `;
}

function answer(v) {
  const q = Q.get(session.ids[session.i]);
  session.picked = v;
  const ok = v === q.ans;
  session.results.push({ id: q.id, ok });
  record(q.id, ok);
  renderQuestion();
}

function next() {
  if (session.i >= session.ids.length - 1) return finish();
  session.i++;
  session.picked = null;
  session.showTr = false;
  window.scrollTo(0, 0);
  renderQuestion();
}

function finish(timedOut = false) {
  stopTimer();
  const isExam = session.mode === 'exam';
  let errors = session.results.filter(r => !r.ok).length;
  const unanswered = isExam ? session.ids.length - session.results.length : 0;
  errors += unanswered;
  const wrongList = session.results.filter(r => !r.ok).map(r => r.id);
  if (isExam) {
    S.exams.push({ at: Date.now(), errors });
    if (S.exams.length > 100) S.exams = S.exams.slice(-100);
    save();
  }
  const total = isExam ? session.ids.length : session.results.length;
  const right = total - errors;
  const pass = errors <= MAX_ERRORS;

  app.innerHTML = `
    <div class="qbar"><button class="icon-btn" data-act="home" aria-label="Close">${ICON.close}</button><div class="meta"><b>${esc(session.title)}</b></div></div>
    <div class="result-head">
      ${isExam
        ? `<div class="result-sign ${pass ? 'pass' : 'fail'}">${right}/${total}</div><h2>${pass ? 'Passed' : 'Not passed'}</h2>
           <p>${errors} ${errors === 1 ? 'mistake' : 'mistakes'}${unanswered ? `, including ${unanswered} unanswered when time ran out` : ''}. You can make up to ${MAX_ERRORS}.</p>`
        : `<div class="result-sign pass">${right}/${total}</div><h2>Session done</h2><p>${errors ? `${errors} wrong. They're saved in Wrong answers.` : 'No mistakes.'}</p>`}
    </div>
    <div class="actions">
      <button class="btn" data-act="home">Home</button>
      <button class="btn primary" data-act="again">${isExam ? 'New exam' : 'Practice again'}</button>
    </div>
    ${wrongList.length ? `<h2 class="section-title">Your mistakes</h2><ul class="review">${wrongList.map(id => {
      const q = Q.get(id);
      return `<li class="${q.img ? '' : 'noimg'}">${q.img ? `<img src="${imgSrc(q.img)}" alt="">` : ''}<div>
        <p lang="it">${esc(q.text)}</p>
        ${TR.q[id] ? `<p class="ans" lang="en">${esc(TR.q[id])}</p>` : ''}
        <p class="ans">Answer: ${q.ans ? 'VERO (true)' : 'FALSO (false)'}${q.th && THEORY[q.th] ? ` · <button class="reveal" data-act="theory-id" data-th="${q.th}">Theory</button>` : ''}</p>
      </div></li>`;
    }).join('')}</ul>` : ''}
  `;
  session.done = true;
  if (timedOut) window.scrollTo(0, 0);
}

/* ---------- timer ---------- */
function fmtTime() {
  const left = Math.max(0, Math.round((session.endsAt - Date.now()) / 1000));
  return `${pad2(Math.floor(left / 60))}:${pad2(left % 60)}`;
}
function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    if (!session || session.done) return stopTimer();
    const el = document.getElementById('timer');
    const left = session.endsAt - Date.now();
    if (el) { el.textContent = fmtTime(); el.classList.toggle('low', left < 120000); }
    if (left <= 0) finish(true);
  }, 1000);
}
function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }

/* ---------- theory sheet ---------- */
function openTheory(th) {
  sheet.hidden = false;
  sheet.dataset.th = th;
  renderTheory();
}
function renderTheory() {
  const th = sheet.dataset.th;
  const it = THEORY[th];
  const t = TR.t[th] || {};
  const tab = S.tab;
  let body, dir = 'ltr', lang = tab, note = '';
  if (tab === 'it') body = it;
  else if (t[tab]) body = t[tab];
  else { body = it; lang = 'it'; note = tab === 'fa' ? 'ترجمهٔ فارسی این بخش هنوز اضافه نشده است. متن ایتالیایی نمایش داده می‌شود.' : "English for this theory hasn't been added yet. Showing Italian."; }
  if (lang === 'fa') dir = 'rtl';
  const noteDir = tab === 'fa' && note ? ' dir="rtl" style="text-align:right"' : '';
  sheetBody.innerHTML = `
    <div class="tabs" role="tablist">
      ${[['it', 'Italiano'], ['en', 'English'], ['fa', 'فارسی']].map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}
    </div>
    ${note ? `<p class="theory note"${noteDir}>${esc(note)}</p>` : ''}
    <article class="theory" dir="${dir}" lang="${lang}">
      <h3 id="sheet-title">${esc(body[0])}</h3>
      ${body[1].split(/\n\s*\n/).map(p => `<p>${esc(p.trim())}</p>`).join('')}
    </article>
    <div class="actions"><button class="btn" data-close>Close</button></div>
  `;
}
function closeSheet() { sheet.hidden = true; }

/* ---------- backup ---------- */
async function exportBackup() {
  const text = JSON.stringify(S);
  try { await navigator.clipboard.writeText(text); alert('Backup copied. Paste it into Notes to keep it safe.'); }
  catch (e) { prompt('Copy this backup text:', text); }
}
function importBackup() {
  const text = prompt('Paste your backup text:');
  if (!text) return;
  try {
    const d = JSON.parse(text);
    if (!d || typeof d.st !== 'object') throw new Error('bad');
    S = Object.assign({ st: {}, bm: [], exams: [], tab: 'en' }, d);
    save(); renderHome();
  } catch (e) { alert("That text isn't a valid backup. Copy the whole backup and try again."); }
}

/* ---------- events ---------- */
app.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'exam') start('exam');
  else if (act === 'chapter') start('chapter', { ch: +b.dataset.ch });
  else if (act === 'wrong') start('wrong');
  else if (act === 'bookmarks') start('bookmarks');
  else if (act === 'answer') answer(+b.dataset.v);
  else if (act === 'next') next();
  else if (act === 'tr') { session.showTr = !session.showTr; renderQuestion(); }
  else if (act === 'theory') openTheory(Q.get(session.ids[session.i]).th);
  else if (act === 'theory-id') openTheory(b.dataset.th);
  else if (act === 'star') {
    const id = session.ids[session.i];
    S.bm = isBm(id) ? S.bm.filter(x => x !== id) : [...S.bm, id];
    save(); renderQuestion();
  }
  else if (act === 'quit') {
    if (session.mode === 'exam' && !confirm('Stop this exam? It won\'t be scored.')) return;
    if (session.mode !== 'exam' && session.results.length) finish(); else renderHome();
  }
  else if (act === 'again') start(session.mode, { ch: session.ch });
  else if (act === 'home') renderHome();
  else if (act === 'export') exportBackup();
  else if (act === 'import') importBackup();
});

sheet.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) return closeSheet();
  const t = e.target.closest('[data-tab]');
  if (t) { S.tab = t.dataset.tab; save(); renderTheory(); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !sheet.hidden) closeSheet();
  if (!session || session.done || !sheet.hidden) return;
  if (session.picked === null && (e.key === 'v' || e.key === 'f')) answer(e.key === 'v' ? 1 : 0);
  else if (session.picked !== null && e.key === 'Enter') next();
});

/* ---------- boot ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
loadData().then(renderHome).catch(() => {
  app.innerHTML = '<p class="empty">Couldn\'t load the questions. Check your connection and reopen the app.</p>';
});
