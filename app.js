'use strict';

const EXAM_SIZE = 30;
const EXAM_SECONDS = 20 * 60;
const MAX_ERRORS = 3;
const PRACTICE_SIZE = 20;
const TOPIC_MAX = 40;
const STORE_KEY = 'patente.v1';

const $ = s => document.querySelector(s);
const app = $('#app');
const tabbar = $('#tabbar');
const sheet = $('#sheet');
const sheetBody = $('#sheet-body');
const sheetPanel = sheet.querySelector('.sheet-panel');

let CHAPTERS = [];
const Q = new Map();            // id -> {id, ch, img, ans, th, text}
const BY_CH = new Map();        // chapter -> [question ids]
let THEORY = {};                // theory id -> [title, text] (Italian)
const TOPIC = new Map();        // theory id -> {th, ch, qids, imgs}
const TOPICS_BY_CH = new Map(); // chapter -> [theory ids]
const CH_IMG = new Map();       // chapter -> representative image
const TR = { q: {}, t: {} };
const SEARCH = new Map();       // theory id -> lowercase searchable text
let S = loadState();
let view = { name: 'home' };
const stack = [];
let session = null;
let timerId = null;

/* ---------- storage ---------- */
function freshState() { return { st: {}, bm: [], exams: [], tab: 'en', autoEn: false, days: {} }; }
function loadState() {
  const base = freshState();
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
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const pick = a => a[Math.floor(Math.random() * a.length)];
const chOf = n => CHAPTERS.find(c => c.n === n);
const isBm = id => S.bm.includes(id);
const wrongIds = () => Object.keys(S.st).filter(k => S.st[k].w && Q.has(+k)).map(Number);
const savedIds = () => S.bm.filter(id => Q.has(id));
const fold = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const LANGS = [['it', 'Italiano'], ['en', 'English'], ['fa', 'فارسی']];

function streak() {
  let n = 0;
  const d = new Date();
  if (!S.days[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (S.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function totals() {
  let seen = 0, att = 0, cor = 0;
  for (const [k, s] of Object.entries(S.st)) { if (!Q.has(+k)) continue; seen++; att += s.s; cor += s.c; }
  return { seen, acc: att ? Math.round(cor / att * 100) : null };
}
function chapterProgress(n) {
  const ids = BY_CH.get(n) || [];
  let done = 0, wrong = 0;
  for (const id of ids) { const s = S.st[id]; if (s && s.c > 0 && !s.w) done++; if (s && s.w) wrong++; }
  return { done, wrong, total: ids.length };
}
function topicTitle(th, lang = S.tab) {
  const t = TR.t[th];
  return lang !== 'it' && t && t[lang] ? t[lang][0] : THEORY[th][0];
}
const subLang = () => (S.tab === 'it' ? 'en' : S.tab);

/* ---------- icons ---------- */
const P = {
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  book: '<path d="M3 5.5h6.5A2.5 2.5 0 0 1 12 8v12a2 2 0 0 0-2-2H3zM21 5.5h-6.5A2.5 2.5 0 0 0 12 8v12a2 2 0 0 1 2-2h7z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/>',
  home: '<path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  chart: '<path d="M5 20V11M12 20V5M19 20v-7"/>',
  shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  alert: '<path d="M10.3 4L2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>',
  bookmark: '<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',
  grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  flame: '<path d="M12 21.5c3.9 0 6.5-2.7 6.5-6.4 0-3.9-2.9-6-4.2-10.1-1.8 1.6-2.6 3.5-2.6 5.4-1-.6-2-1.8-2.3-3.6C7 9 5.5 11.4 5.5 15.1c0 3.7 2.6 6.4 6.5 6.4z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>'
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

/* ---------- data ---------- */
async function loadData() {
  const [qr, tr] = await Promise.all([fetch('data/questions.json'), fetch('data/theory.json')]);
  if (!qr.ok || !tr.ok) throw new Error('load failed');
  const qd = await qr.json();
  THEORY = await tr.json();
  CHAPTERS = qd.chapters;

  const tmp = new Map();
  const chImg = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  for (const [id, ch, img, ans, th, text] of qd.q) {
    const key = th && THEORY[th] ? String(th) : '';
    Q.set(id, { id, ch, img, ans, th: key, text });
    if (!BY_CH.has(ch)) BY_CH.set(ch, []);
    BY_CH.get(ch).push(id);
    if (img) { if (!chImg.has(ch)) chImg.set(ch, new Map()); bump(chImg.get(ch), img); }
    if (key) {
      if (!tmp.has(key)) tmp.set(key, { qids: [], img: new Map(), ch: new Map() });
      const t = tmp.get(key);
      t.qids.push(id); bump(t.ch, ch); if (img) bump(t.img, img);
    }
  }
  const ranked = m => [...m.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
  for (const [th, t] of tmp) {
    const info = { th, qids: t.qids, imgs: ranked(t.img).slice(0, 8), ch: ranked(t.ch)[0] };
    TOPIC.set(th, info);
    if (!TOPICS_BY_CH.has(info.ch)) TOPICS_BY_CH.set(info.ch, []);
    TOPICS_BY_CH.get(info.ch).push(th);
  }
  for (const [ch, m] of chImg) CH_IMG.set(ch, ranked(m)[0]);

  await Promise.all(CHAPTERS.map(async c => {
    try {
      const r = await fetch(`data/tr/ch${pad2(c.n)}.json`);
      if (!r.ok) return;
      const d = await r.json();
      Object.assign(TR.q, d.q || {});
      Object.assign(TR.t, d.t || {});
    } catch (e) { /* chapter not translated yet */ }
  }));
}
function searchText(th) {
  if (!SEARCH.has(th)) {
    const t = TR.t[th] || {};
    const parts = [...THEORY[th], ...(t.en || []), ...(t.fa || [])];
    SEARCH.set(th, fold(parts.join(' ')));
  }
  return SEARCH.get(th);
}

/* ---------- navigation ---------- */
function render() {
  const n = view.name;
  const tab = { home: 'home', theory: 'theory', progress: 'progress', chapter: view.from || 'home', topic: view.from || 'theory' }[n];
  tabbar.hidden = !tab;
  document.body.classList.toggle('has-tabbar', !!tab);
  document.body.classList.toggle('in-quiz', n === 'quiz');
  tabbar.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  ({ home: renderHome, chapter: renderChapter, theory: renderTheoryTab, topic: renderTopicPage,
     progress: renderProgress, quiz: renderQuestion, result: renderResult })[n]();
}
function go(v) { view.y = window.scrollY; stack.push(view); view = v; render(); window.scrollTo(0, 0); }
function back() {
  view = stack.pop() || { name: 'home' };
  render();
  window.scrollTo(0, view.y || 0);
}
function setTab(name) { stack.length = 0; view = { name }; render(); window.scrollTo(0, 0); }
const topbar = (title, closeAct = 'back') => `
  <div class="topbar">
    <button class="back" data-act="${closeAct}" aria-label="Back">${icon('back')}<span>Back</span></button>
    <span class="topbar-title">${esc(title)}</span>
  </div>`;

/* ---------- shared bits ---------- */
function thumb(img, fallback, cls = '') {
  return img
    ? `<span class="thumb ${cls}"><img src="${imgSrc(img)}" alt="" loading="lazy"></span>`
    : `<span class="thumb ${cls} fallback">${fallback}</span>`;
}
function chapterRow(c, from) {
  const p = chapterProgress(c.n);
  const topics = (TOPICS_BY_CH.get(c.n) || []).length;
  const end = from === 'theory' ? `${topics} topics` : `${pct(p.done, p.total)}%`;
  return `<li><button class="row" data-act="chapter" data-ch="${c.n}" data-from="${from}">
    ${thumb(CH_IMG.get(c.n), c.n)}
    <span class="row-main">
      <span class="kicker">Chapter ${c.n}</span>
      <b lang="it">${esc(c.it)}</b>
      <small ${subLang() === 'fa' ? 'dir="rtl" lang="fa"' : ''}>${esc(c[subLang()] || c.en)}</small>
      ${from === 'theory' ? '' : `<span class="meter"><i style="width:${pct(p.done, p.total)}%"></i></span>`}
    </span>
    <span class="row-end">${end}${icon('chev')}</span>
  </button></li>`;
}
function topicRow(th, from) {
  const info = TOPIC.get(th);
  const sub = TR.t[th] && TR.t[th][subLang()] ? TR.t[th][subLang()][0] : '';
  return `<li><button class="row" data-act="topic" data-th="${th}" data-from="${from}">
    ${thumb(info.imgs[0], icon('book'), 'sm')}
    <span class="row-main">
      <b lang="it">${esc(THEORY[th][0])}</b>
      ${sub ? `<small ${subLang() === 'fa' ? 'dir="rtl" lang="fa"' : ''}>${esc(sub)}</small>` : ''}
    </span>
    <span class="row-end">${info.qids.length} Q${icon('chev')}</span>
  </button></li>`;
}
function langSwitch() {
  return `<div class="seg" role="tablist" aria-label="Language">
    ${LANGS.map(([k, l]) => `<button role="tab" data-lang="${k}" aria-selected="${S.tab === k}" ${k === 'fa' ? 'lang="fa"' : ''}>${l}</button>`).join('')}
  </div>`;
}
function formatText(s) {
  return s.split(/\n\s*\n|[ \t]{2,}/).map(p => p.trim()).filter(Boolean).map(p => {
    const lines = p.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.every(l => /^[-•]\s*/.test(l))) return `<ul>${lines.map(l => `<li>${esc(l.replace(/^[-•]\s*/, ''))}</li>`).join('')}</ul>`;
    return `<p>${lines.map(esc).join('<br>')}</p>`;
  }).join('').replace(/<\/ul><ul>/g, '');
}
function topicHTML(th, inSheet) {
  const it = THEORY[th];
  const info = TOPIC.get(th);
  const t = TR.t[th] || {};
  let body = it, lang = 'it', note = '';
  if (S.tab !== 'it') {
    if (t[S.tab]) { body = t[S.tab]; lang = S.tab; }
    else note = S.tab === 'fa' ? 'ترجمهٔ فارسی این بخش هنوز آماده نیست. متن ایتالیایی نمایش داده می‌شود.' : "English for this topic isn't ready yet. Showing Italian.";
  }
  const imgs = info ? info.imgs : [];
  return `
    ${langSwitch()}
    ${imgs.length ? `<div class="gallery ${imgs.length === 1 ? 'one' : ''}">${imgs.map(n => `<figure><img src="${imgSrc(n)}" alt="" loading="lazy"></figure>`).join('')}</div>` : ''}
    ${note ? `<p class="note" ${S.tab === 'fa' ? 'dir="rtl"' : ''}>${esc(note)}</p>` : ''}
    <article class="theory card" dir="${lang === 'fa' ? 'rtl' : 'ltr'}" lang="${lang}">
      <h2 id="sheet-title">${esc(body[0])}</h2>
      ${lang !== 'it' ? `<p class="it-title" lang="it" dir="ltr">${esc(it[0])}</p>` : ''}
      ${formatText(body[1])}
    </article>
    ${info && !inSheet ? `<button class="btn primary block" data-act="practice-topic" data-th="${th}">${icon('play')}Practice ${Math.min(info.qids.length, TOPIC_MAX)} questions on this topic</button>` : ''}
    ${inSheet ? '<button class="btn block" data-close>Back to the question</button>' : ''}`;
}

/* ---------- home ---------- */
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Buongiorno, Sina' : h < 18 ? 'Buon pomeriggio, Sina' : 'Buonasera, Sina';
}
function renderHome() {
  const { seen, acc } = totals();
  const w = wrongIds().length;
  const b = savedIds().length;
  const last = S.exams[S.exams.length - 1];
  const passed = S.exams.filter(e => e.errors <= MAX_ERRORS).length;
  const st = streak();
  app.innerHTML = `
    <header class="hero">
      <div class="hero-row">
        <img class="hero-logo" src="icons/icon-180.png" alt="">
        <div class="hero-txt"><h1>Sina Patente</h1><p>${greeting()}</p></div>
        ${st ? `<span class="streak" aria-label="${st} days in a row">${icon('flame')}${st}</span>` : ''}
      </div>
      <div class="hero-stats">
        <div><b>${pct(seen, Q.size)}%</b><span>questions seen</span></div>
        <div><b>${acc === null ? '–' : acc + '%'}</b><span>answers right</span></div>
        <div><b>${passed}<small>/${S.exams.length}</small></b><span>exams passed</span></div>
      </div>
    </header>

    <button class="exam-card" data-act="exam">
      <span class="exam-sign">30</span>
      <span class="exam-txt">
        <strong>Mock exam</strong>
        <span>30 questions · 20 min · max 3 mistakes</span>
        ${last ? `<em class="${last.errors <= MAX_ERRORS ? 'ok' : 'no'}">Last: ${EXAM_SIZE - last.errors}/${EXAM_SIZE} · ${last.errors <= MAX_ERRORS ? 'passed' : 'not passed'}</em>` : ''}
      </span>
      <span class="go">${icon('arrow')}</span>
    </button>

    <div class="quick">
      <button class="qa" data-act="quick"><span class="qa-ic blue">${icon('shuffle')}</span><b>Quick 20</b><small>Mixed practice</small></button>
      <button class="qa" data-act="wrong" ${w ? '' : 'disabled'}><span class="qa-ic red">${icon('alert')}</span><b>Mistakes</b><small>${w ? `${w} to fix` : 'None yet'}</small></button>
      <button class="qa" data-act="saved" ${b ? '' : 'disabled'}><span class="qa-ic amber">${icon('bookmark')}</span><b>Saved</b><small>${b ? `${b} saved` : 'None yet'}</small></button>
    </div>

    <div class="sec-head"><h2>Practice by chapter</h2><span>${CHAPTERS.length} chapters</span></div>
    <ul class="list">${CHAPTERS.map(c => chapterRow(c, 'home')).join('')}</ul>
  `;
}

/* ---------- chapter ---------- */
function ring(p) {
  const r = 26, c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="ring-bg"/><circle cx="32" cy="32" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}"/></svg>`;
}
function renderChapter() {
  const c = chOf(view.ch);
  const p = chapterProgress(c.n);
  const topics = TOPICS_BY_CH.get(c.n) || [];
  const pc = pct(p.done, p.total);
  app.innerHTML = `
    ${topbar(`Chapter ${c.n}`)}
    <section class="ch-hero card">
      ${thumb(CH_IMG.get(c.n), c.n, 'lg')}
      <h1 lang="it">${esc(c.it)}</h1>
      <p>${esc(c.en)}</p>
      <p dir="rtl" lang="fa">${esc(c.fa)}</p>
      <div class="ch-stats">
        <div class="ring-wrap">${ring(pc)}<b>${pc}%</b></div>
        <div><b>${p.done}</b> of ${p.total} questions mastered<br><span class="${p.wrong ? 'bad' : ''}">${p.wrong} still wrong</span></div>
      </div>
    </section>
    <div class="btn-row">
      <button class="btn primary" data-act="practice-ch" data-ch="${c.n}">${icon('play')}Practice ${PRACTICE_SIZE}</button>
      ${p.wrong ? `<button class="btn" data-act="practice-ch-wrong" data-ch="${c.n}">Fix ${p.wrong} mistakes</button>` : ''}
    </div>
    <div class="sec-head"><h2>Theory</h2><span>${topics.length} topics</span></div>
    ${langSwitch()}
    <ul class="list">${topics.map(th => topicRow(th, view.from || 'home')).join('')}</ul>
  `;
}

/* ---------- theory tab ---------- */
function renderTheoryTab() {
  app.innerHTML = `
    <header class="page-head">
      <h1>Theory</h1>
      <p>${TOPIC.size} topics with pictures, in Italiano · English · <span lang="fa">فارسی</span></p>
    </header>
    <label class="search">${icon('search')}<input id="search" type="search" enterkeyhint="search" placeholder="Search: sorpasso, lay-by, سبقت…" autocomplete="off" autocorrect="off" value="${esc(view.q || '')}"></label>
    ${langSwitch()}
    <div id="theory-results"></div>
  `;
  fillTheoryResults();
}
function fillTheoryResults() {
  const box = $('#theory-results');
  const q = fold((view.q || '').trim());
  if (!q) { box.innerHTML = `<ul class="list">${CHAPTERS.map(c => chapterRow(c, 'theory')).join('')}</ul>`; return; }
  const hits = [...TOPIC.keys()].filter(th => searchText(th).includes(q)).slice(0, 80);
  box.innerHTML = hits.length
    ? `<p class="hint">${hits.length} topic${hits.length === 1 ? '' : 's'} found</p><ul class="list">${hits.map(th => topicRow(th, 'theory')).join('')}</ul>`
    : `<p class="empty-note">No topics match “${esc(view.q.trim())}”.</p>`;
}
function renderTopicPage() {
  const info = TOPIC.get(view.th);
  app.innerHTML = `${topbar(`Chapter ${info.ch}`)}${topicHTML(view.th, false)}`;
}

/* ---------- progress tab ---------- */
function renderProgress() {
  const { seen, acc } = totals();
  const exams = S.exams.slice(-14);
  const passed = S.exams.filter(e => e.errors <= MAX_ERRORS).length;
  app.innerHTML = `
    <header class="page-head"><h1>Progress</h1><p>Saved on this iPhone</p></header>
    <div class="stat-grid">
      <div class="stat card"><b>${seen.toLocaleString()}</b><span>of ${Q.size.toLocaleString()} questions seen</span></div>
      <div class="stat card"><b>${acc === null ? '–' : acc + '%'}</b><span>answers right</span></div>
      <div class="stat card"><b>${streak()}</b><span>day streak ${icon('flame')}</span></div>
      <div class="stat card"><b>${passed}/${S.exams.length}</b><span>mock exams passed</span></div>
    </div>

    <section class="card">
      <h3>Mock exams</h3>
      ${exams.length ? `
        <div class="bars" role="img" aria-label="Scores of your last ${exams.length} mock exams">
          <span class="pass-line"><em>pass 27</em></span>
          ${exams.map(e => `<i class="${e.errors <= MAX_ERRORS ? 'pass' : 'fail'}" style="height:${Math.max(4, (EXAM_SIZE - e.errors) / EXAM_SIZE * 100)}%"></i>`).join('')}
        </div>
        <p class="hint">Last ${exams.length} exams. You pass with 27 or more right.</p>`
        : `<p class="hint">No mock exams yet. Try one when you've practised a few chapters.</p>`}
    </section>

    <section class="card">
      <h3>Chapters</h3>
      <ul class="mini">${CHAPTERS.map(c => { const p = chapterProgress(c.n); return `
        <li><span class="mini-n">${c.n}</span><span class="mini-name">${esc(c.en)}</span>
        <span class="meter"><i style="width:${pct(p.done, p.total)}%"></i></span><span class="mini-p">${pct(p.done, p.total)}%</span></li>`; }).join('')}
      </ul>
    </section>

    <section class="card">
      <h3>Settings</h3>
      <label class="set-row"><span><b>Show English automatically</b><small>Otherwise tap the question to see it</small></span>
        <input type="checkbox" class="switch" data-act="autoEn" ${S.autoEn ? 'checked' : ''}></label>
      <div class="set-row col"><span><b>Theory language</b></span>${langSwitch()}</div>
    </section>

    <section class="card">
      <h3>Backup</h3>
      <p class="hint">Your progress lives only on this phone. Copy a backup to Notes now and then.</p>
      <div class="btn-row"><button class="btn" data-act="export">Copy backup</button><button class="btn" data-act="import">Restore</button></div>
      <button class="link danger" data-act="reset">Reset all progress</button>
    </section>

    <p class="footnote">Questions, pictures and Italian theory come from the official Ministry question pool via the community project avalla/quiz-patente-ab (MIT licence). English and Persian translations were written by Claude. Before the real exam, also practise on the Ministry's own simulator.</p>
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
  else if (mode === 'chapter') { ids = practiceOrder(BY_CH.get(opts.ch)).slice(0, PRACTICE_SIZE); title = `Chapter ${opts.ch}`; }
  else if (mode === 'chwrong') { ids = shuffle(BY_CH.get(opts.ch).filter(id => S.st[id] && S.st[id].w)); title = `Chapter ${opts.ch} · mistakes`; }
  else if (mode === 'topic') { ids = practiceOrder(TOPIC.get(opts.th).qids).slice(0, TOPIC_MAX); title = THEORY[opts.th][0]; }
  else if (mode === 'quick') {
    const set = new Set(shuffle(wrongIds()).slice(0, 5));
    const all = [...Q.keys()];
    while (set.size < PRACTICE_SIZE) set.add(pick(all));
    ids = shuffle([...set]); title = 'Quick practice';
  }
  else if (mode === 'wrong') { ids = shuffle(wrongIds()).slice(0, 50); title = 'Mistakes'; }
  else { ids = shuffle(savedIds()); title = 'Saved questions'; }
  if (!ids.length) return;
  session = { mode, opts, title, ids, i: 0, ans: ids.map(() => null), showTr: S.autoEn };
  if (mode === 'exam') { session.endsAt = Date.now() + EXAM_SECONDS * 1000; startTimer(); }
  if (view.name !== 'quiz' && view.name !== 'result') { view.y = window.scrollY; stack.push(view); }
  view = { name: 'quiz' };
  render();
  window.scrollTo(0, 0);
}
function record(id, correct) {
  const s = S.st[id] || { s: 0, c: 0, w: 0 };
  s.s++; if (correct) { s.c++; s.w = 0; } else { s.w = 1; }
  S.st[id] = s;
  const k = dayKey();
  S.days[k] = (S.days[k] || 0) + 1;
  save();
}

/* ---------- question screen ---------- */
function renderQuestion() {
  const s = session;
  const id = s.ids[s.i];
  const q = Q.get(id);
  const exam = s.mode === 'exam';
  const picked = s.ans[s.i];
  const answered = picked !== null;
  const ok = answered && picked === q.ans;
  const en = TR.q[id];
  const done = s.ans.filter(a => a !== null).length;
  const progress = exam ? done : s.i + (answered ? 1 : 0);
  const th = q.th;
  const last = s.i === s.ids.length - 1;

  let bar;
  if (exam) {
    bar = `
      ${done === s.ids.length || last ? `<button class="btn primary block submit" data-act="submit">Submit exam · ${done}/${s.ids.length} answered</button>` : ''}
      <div class="exam-nav">
        <button class="icon-btn" data-act="prev" aria-label="Previous question" ${s.i === 0 ? 'disabled' : ''}>${icon('back')}</button>
        <div class="tf">
          <button class="vero ${picked === 1 ? 'is-picked' : ''}" data-act="answer" data-v="1" aria-pressed="${picked === 1}">VERO<small>True</small></button>
          <button class="falso ${picked === 0 ? 'is-picked' : ''}" data-act="answer" data-v="0" aria-pressed="${picked === 0}">FALSO<small>False</small></button>
        </div>
        <button class="icon-btn" data-act="skip" aria-label="Next question" ${last ? 'disabled' : ''}>${icon('chev')}</button>
      </div>`;
  } else if (!answered) {
    bar = `<div class="tf">
      <button class="vero" data-act="answer" data-v="1">VERO<small>True</small></button>
      <button class="falso" data-act="answer" data-v="0">FALSO<small>False</small></button>
    </div>`;
  } else {
    bar = `
      <div class="verdict ${ok ? 'ok' : 'no'}">
        <span class="mark">${icon(ok ? 'check' : 'close')}</span>
        <span><b>${ok ? pick(['Correct!', 'Esatto!', 'Bravo!', 'Right!']) : 'Not quite'}</b>
        <span>The answer is <strong>${q.ans ? 'VERO' : 'FALSO'}</strong> (${q.ans ? 'true' : 'false'})</span></span>
      </div>
      <button class="btn primary block" data-act="next">${last ? 'See results' : 'Next question'}${icon('arrow')}</button>`;
  }

  app.innerHTML = `
    <div class="qtop">
      <button class="icon-btn" data-act="quit" aria-label="Close">${icon('close')}</button>
      <div class="qprog">
        <div class="qprog-txt"><b>${esc(s.title)}</b><span>${s.i + 1}/${s.ids.length}</span></div>
        <span class="meter blue"><i style="width:${progress / s.ids.length * 100}%"></i></span>
      </div>
      ${exam ? `<span class="timer" id="timer">${icon('timer')}<span>${fmtTime()}</span></span>
                <button class="icon-btn" data-act="grid" aria-label="All questions">${icon('grid')}</button>`
             : `<button class="icon-btn star ${isBm(id) ? 'on' : ''}" data-act="star" aria-pressed="${isBm(id)}" aria-label="Save question">${icon('bookmark')}</button>`}
    </div>

    <div class="qcard ${s.showTr ? 'open' : ''}" data-act="tr" role="button" tabindex="0" aria-expanded="${s.showTr}">
      ${q.img ? `<div class="plate"><img src="${imgSrc(q.img)}" alt="Picture for this question"></div>` : ''}
      <p class="qtext" lang="it">${esc(q.text)}</p>
      ${s.showTr
        ? `<p class="qtr" lang="en"><span class="lang-tag">EN</span>${en ? esc(en) : 'English for this question isn’t ready yet.'}</p>`
        : `<span class="tap-hint">${icon('globe')}Tap the question for English</span>`}
    </div>

    ${!exam && th ? `
      <button class="theory-chip ${answered && !ok ? 'hl' : ''}" data-act="theory" data-th="${th}">
        ${thumb(TOPIC.get(th).imgs[0], icon('book'), 'sm')}
        <span><small>Theory for this question</small><b ${S.tab === 'fa' && TR.t[th] && TR.t[th].fa ? 'dir="rtl" lang="fa"' : ''}>${esc(topicTitle(th))}</b></span>
        ${icon('chev')}
      </button>` : ''}

    <div class="abar"><div class="abar-in ${answered && !exam ? (ok ? 'pop' : 'shake') : ''}">${bar}</div></div>
  `;
}
function answer(v) {
  const s = session;
  if (!s || s.done) return;
  const q = Q.get(s.ids[s.i]);
  if (s.mode === 'exam') {
    s.ans[s.i] = v;
    renderQuestion();
    const at = s.i;
    if (at < s.ids.length - 1) setTimeout(() => {
      if (session === s && view.name === 'quiz' && s.i === at && sheet.hidden) { s.i++; s.showTr = S.autoEn; renderQuestion(); window.scrollTo(0, 0); }
    }, 320);
    return;
  }
  if (s.ans[s.i] !== null) return;
  s.ans[s.i] = v;
  record(q.id, v === q.ans);
  renderQuestion();
}
function move(d) {
  const s = session;
  const n = s.i + d;
  if (n < 0 || n >= s.ids.length) return;
  s.i = n; s.showTr = S.autoEn;
  renderQuestion();
  window.scrollTo(0, 0);
}
function next() {
  if (session.i >= session.ids.length - 1) return finish();
  move(1);
}
function finish(timedOut = false) {
  const s = session;
  if (!s || s.done) return;
  stopTimer();
  s.done = true;
  s.timedOut = timedOut;
  const exam = s.mode === 'exam';
  s.items = s.ids.map((id, i) => ({ id, a: s.ans[i], ok: s.ans[i] === Q.get(id).ans })).filter(x => exam || x.a !== null);
  if (exam) {
    s.items.forEach(x => { if (x.a !== null) record(x.id, x.ok); });
    S.exams.push({ at: Date.now(), errors: s.items.filter(x => !x.ok).length });
    if (S.exams.length > 200) S.exams = S.exams.slice(-200);
    save();
  }
  closeSheet();
  view = { name: 'result' };
  render();
  window.scrollTo(0, 0);
}
function renderResult() {
  const s = session;
  const exam = s.mode === 'exam';
  const total = s.items.length;
  const wrong = s.items.filter(x => !x.ok);
  const right = total - wrong.length;
  const unanswered = s.items.filter(x => x.a === null).length;
  const pass = exam ? wrong.length <= MAX_ERRORS : true;
  const perfect = total > 0 && !wrong.length;
  const headline = exam ? (pass ? 'Passed!' : 'Not passed yet') : perfect ? 'Perfect!' : 'Session complete';
  const msg = exam
    ? `${wrong.length} mistake${wrong.length === 1 ? '' : 's'}${unanswered ? `, including ${unanswered} unanswered${s.timedOut ? ' when time ran out' : ''}` : ''}. You can make up to ${MAX_ERRORS}.`
    : wrong.length ? `${wrong.length} wrong. They're saved in Mistakes so you can fix them later.` : 'No mistakes. Keep going!';

  app.innerHTML = `
    <div class="qtop"><button class="icon-btn" data-act="done" aria-label="Close">${icon('close')}</button><div class="qprog"><div class="qprog-txt"><b>${esc(s.title)}</b></div></div></div>
    <section class="result ${pass ? 'pass' : 'fail'}">
      <div class="result-sign">${right}<small>/${total}</small></div>
      <h1>${headline}</h1>
      <p>${msg}</p>
    </section>
    <div class="btn-row">
      <button class="btn" data-act="done">Done</button>
      <button class="btn primary" data-act="again">${exam ? 'New exam' : 'Practice more'}</button>
    </div>
    ${wrong.length ? `<div class="sec-head"><h2>Review your mistakes</h2><span>${wrong.length}</span></div>
    <ul class="review">${wrong.map(x => {
      const q = Q.get(x.id);
      return `<li class="card">
        ${q.img ? `<div class="plate sm"><img src="${imgSrc(q.img)}" alt="" loading="lazy"></div>` : ''}
        <p class="rv-it" lang="it">${esc(q.text)}</p>
        ${TR.q[x.id] ? `<p class="rv-en" lang="en">${esc(TR.q[x.id])}</p>` : ''}
        <div class="pills">
          <span class="pill no">You: ${x.a === null ? 'no answer' : x.a ? 'VERO' : 'FALSO'}</span>
          <span class="pill ok">Correct: ${q.ans ? 'VERO' : 'FALSO'}</span>
          ${q.th ? `<button class="pill theory" data-act="theory" data-th="${q.th}">${icon('book')}Theory</button>` : ''}
        </div>
      </li>`;
    }).join('')}</ul>` : ''}
  `;
  if ((exam && pass) || (perfect && total >= 5)) confetti();
}
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#1D4ED8', '#DC2626', '#16A34A', '#F59E0B', '#FFFFFF'];
  box.innerHTML = Array.from({ length: 60 }, () =>
    `<i style="left:${Math.random() * 100}%;background:${pick(colors)};animation-delay:${Math.random() * 0.6}s;animation-duration:${2 + Math.random() * 1.5}s;transform:rotate(${Math.random() * 360}deg)"></i>`).join('');
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4500);
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
    const left = session.endsAt - Date.now();
    const el = document.getElementById('timer');
    if (el) { el.lastElementChild.textContent = fmtTime(); el.classList.toggle('low', left < 120000); }
    if (left <= 0) finish(true);
  }, 1000);
}
function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }

/* ---------- sheet ---------- */
function openSheet(html, kind) {
  sheetBody.innerHTML = html;
  sheet.dataset.kind = kind;
  sheet.hidden = false;
  document.body.classList.add('locked');
  sheetPanel.scrollTop = 0;
}
function closeSheet() { sheet.hidden = true; document.body.classList.remove('locked'); }
function openTheory(th) { sheet.dataset.th = th; openSheet(topicHTML(th, true), 'theory'); }
function openGrid() {
  const s = session;
  openSheet(`
    <h2 id="sheet-title" class="sheet-h">Exam questions</h2>
    <p class="hint">${s.ans.filter(a => a !== null).length} of ${s.ids.length} answered. Tap a number to go to it.</p>
    <div class="qgrid">${s.ids.map((_, i) => `<button data-jump="${i}" class="${s.ans[i] !== null ? 'done' : ''} ${i === s.i ? 'cur' : ''}">${i + 1}</button>`).join('')}</div>
    <button class="btn primary block" data-submit>Submit exam</button>
    <button class="btn block" data-close>Keep going</button>`, 'grid');
}

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
    S = Object.assign(freshState(), d);
    save(); render();
  } catch (e) { alert("That text isn't a valid backup. Copy the whole backup and try again."); }
}

/* ---------- events ---------- */
function setLang(l) {
  S.tab = l; save();
  SEARCH.clear();
  if (!sheet.hidden && sheet.dataset.kind === 'theory') {
    sheetBody.innerHTML = topicHTML(sheet.dataset.th, true);
  } else {
    const y = window.scrollY; render(); window.scrollTo(0, y);
  }
}
app.addEventListener('click', e => {
  const b = e.target.closest('[data-act], [data-lang]');
  if (!b) return;
  if (b.dataset.lang) return setLang(b.dataset.lang);
  const act = b.dataset.act;
  if (act === 'exam') start('exam');
  else if (act === 'quick') start('quick');
  else if (act === 'wrong') start('wrong');
  else if (act === 'saved') start('saved');
  else if (act === 'chapter') go({ name: 'chapter', ch: +b.dataset.ch, from: b.dataset.from });
  else if (act === 'topic') go({ name: 'topic', th: b.dataset.th, from: b.dataset.from });
  else if (act === 'practice-ch') start('chapter', { ch: +b.dataset.ch });
  else if (act === 'practice-ch-wrong') start('chwrong', { ch: +b.dataset.ch });
  else if (act === 'practice-topic') start('topic', { th: b.dataset.th });
  else if (act === 'back') back();
  else if (act === 'theory') openTheory(b.dataset.th);
  else if (act === 'tr') { session.showTr = !session.showTr; renderQuestion(); }
  else if (act === 'answer') answer(+b.dataset.v);
  else if (act === 'next') next();
  else if (act === 'prev') move(-1);
  else if (act === 'skip') move(1);
  else if (act === 'grid') openGrid();
  else if (act === 'submit') {
    const left = session.ans.filter(a => a === null).length;
    if (left && !confirm(`${left} question${left === 1 ? ' is' : 's are'} unanswered and will count as mistakes. Submit anyway?`)) return;
    finish();
  }
  else if (act === 'star') {
    const id = session.ids[session.i];
    S.bm = isBm(id) ? S.bm.filter(x => x !== id) : [...S.bm, id];
    save(); renderQuestion();
  }
  else if (act === 'quit') {
    if (session.mode === 'exam') { if (confirm("Leave this exam? It won't be scored.")) { stopTimer(); session.done = true; back(); } return; }
    if (session.ans.some(a => a !== null)) finish(); else back();
  }
  else if (act === 'again') start(session.mode, session.opts);
  else if (act === 'done') back();
  else if (act === 'autoEn') { S.autoEn = b.checked; save(); }
  else if (act === 'export') exportBackup();
  else if (act === 'import') importBackup();
  else if (act === 'reset') {
    if (confirm('Delete all your progress, mistakes, saved questions and exam history on this phone?')) { S = freshState(); save(); render(); }
  }
});
app.addEventListener('input', e => {
  if (e.target.id === 'search') { view.q = e.target.value; fillTheoryResults(); }
});
tabbar.addEventListener('click', e => {
  const b = e.target.closest('[data-tab]');
  if (b) setTab(b.dataset.tab);
});
sheet.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) return closeSheet();
  const l = e.target.closest('[data-lang]');
  if (l) return setLang(l.dataset.lang);
  const j = e.target.closest('[data-jump]');
  if (j) { closeSheet(); session.i = +j.dataset.jump; session.showTr = S.autoEn; renderQuestion(); window.scrollTo(0, 0); return; }
  if (e.target.closest('[data-submit]')) {
    const left = session.ans.filter(a => a === null).length;
    if (left && !confirm(`${left} question${left === 1 ? ' is' : 's are'} unanswered and will count as mistakes. Submit anyway?`)) return;
    finish();
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !sheet.hidden) return closeSheet();
  if (view.name !== 'quiz' || !session || session.done || !sheet.hidden) return;
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('qcard')) {
    e.preventDefault(); session.showTr = !session.showTr; renderQuestion(); return;
  }
  const exam = session.mode === 'exam';
  const answered = session.ans[session.i] !== null;
  if (e.key === 'v' || e.key === 'f') { if (exam || !answered) answer(e.key === 'v' ? 1 : 0); }
  else if (e.key === 'e') { session.showTr = !session.showTr; renderQuestion(); }
  else if (!exam && answered && e.key === 'Enter') next();
  else if (exam && e.key === 'ArrowRight') move(1);
  else if (exam && e.key === 'ArrowLeft') move(-1);
});

/* ---------- boot ---------- */
tabbar.innerHTML = [['home', 'home', 'Practice'], ['theory', 'book', 'Theory'], ['progress', 'chart', 'Progress']]
  .map(([k, i, l]) => `<button data-tab="${k}">${icon(i)}<span>${l}</span></button>`).join('');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
loadData().then(render).catch(() => {
  app.innerHTML = '<p class="empty-note">Couldn\'t load the questions. Check your connection and reopen the app.</p>';
});
