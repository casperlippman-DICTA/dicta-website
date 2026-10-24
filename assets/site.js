(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};

/* =====================================================================
   HERO: Draw-mode replay
   Letters are stroke lists in x-height units (baseline y = 0, y up).
   A trailing 1 on a point marks a sharp corner.
   ===================================================================== */
const E = (cx, cy, rx, ry, a0, a1, n = 18) => {
  const p = [];
  for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; p.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  return p;
};
const GLYPH = {
  R: { w: .82, s: [[[0, 1.6], [0, 0]], [[0, 1.58], [.36, 1.63], [.62, 1.5], [.68, 1.27], [.55, 1.0], [.06, .9, 1], [.4, .46], [.78, 0]]] },
  o: { w: .84, s: [E(.42, .5, .4, .5, 95, 458)] },
  m: { w: .96, s: [[[0, 1], [0, 0, 1], [0, .62], [.1, .9], [.24, 1], [.38, .88], [.43, .6], [.43, 0, 1], [.43, .62], [.53, .9], [.67, 1], [.81, .88], [.86, .6], [.86, 0]]] },
  a: { w: .88, s: [E(.38, .5, .36, .5, 25, 385), [[.76, 1], [.75, .14], [.86, 0]]] },
  c: { w: .74, s: [E(.4, .5, .38, .5, 40, 322, 14)] },
  e: { w: .76, s: [[[.04, .5], [.66, .55], [.6, .86], [.36, 1], [.1, .84], [0, .48], [.1, .12], [.38, 0], [.66, .14]]] },
  n: { w: .68, s: [[[0, 1], [0, 0, 1], [0, .6], [.12, .9], [.32, 1], [.52, .88], [.58, .55], [.58, 0]]] },
  u: { w: .72, s: [[[0, 1], [.02, .32], [.14, .06], [.3, 0], [.48, .12], [.57, .46], [.58, 1, 1], [.58, .14], [.68, 0]]] },
  s: { w: .62, s: [[[.56, .88], [.36, 1], [.12, .93], [.07, .7], [.28, .53], [.5, .38], [.56, .15], [.33, 0], [.04, .1]]] },
  nu: { w: .66, s: [[[0, 1], [.07, .6], [.18, .22], [.3, 0, 1], [.45, .38], [.57, .78], [.55, 1]]] },
  mu: { w: .72, s: [[[0, 1], [0, -.62]], [[0, .48], [.06, .14], [.24, 0], [.42, .1], [.52, .42], [.54, 1, 1], [.55, .16], [.64, 0]]] },
  alpha: { w: .86, s: [[[.74, .98], [.68, .64], [.54, .9], [.32, 1], [.1, .86], [0, .5], [.1, .14], [.3, 0], [.5, .12], [.64, .42], [.74, .12], [.86, 0]]] }
};
// Marks are centered on the letter (x relative to its middle).
const MARK = {
  macron: [[-.34, 1.34], [.34, 1.37]],
  psili: [[-.22, 1.68], [-.1, 1.58], [-.11, 1.42], [-.23, 1.34]],
  acute: [[.04, 1.3], [.26, 1.7]]
};
const BOOKS = {
  ltrl: { prompt: 'Rome', entry: 'Rōma, Rōmae (f.)', ch: 'Chapter 6', dir: 'English to Latin', count: '5 / 32',
    letters: [['R', 'R'], ['o', 'o'], ['m', 'm'], ['a', 'a']], marks: [{ i: 1, m: 'macron', out: 'ō' }],
    capMark: 'A flat stroke above a vowel becomes a macron.', color: '#c4411f' },
  ltrg: { prompt: 'name', entry: 'ὄνομα, ὀνόματος, τό', ch: 'Chapter 12', dir: 'English to Greek', count: '6 / 32',
    letters: [['o', 'ο'], ['nu', 'ν'], ['o', 'ο'], ['mu', 'μ'], ['alpha', 'α']], marks: [{ i: 0, m: 'psili', out: 'ὀ' }, { i: 0, m: 'acute', out: 'ὄ' }],
    capMark: 'Breathings and accents are strokes too, attached to the vowel below.', color: '#2b8712' },
  llps: { prompt: 'ocean', entry: 'ōceanus, -ī (m)', ch: 'Capitulum I', dir: 'English to Latin', count: '3 / 41',
    letters: [['o', 'o'], ['c', 'c'], ['e', 'e'], ['a', 'a'], ['n', 'n'], ['u', 'u'], ['s', 's']], marks: [{ i: 0, m: 'macron', out: 'ō' }],
    capMark: 'A flat stroke above a vowel becomes a macron.', color: '#aa5828' }
};
const ORDER = ['ltrl', 'ltrg', 'llps'];

function catmull(p) {
  if (p.length < 3) { // straight line: densify
    const out = []; const [a, b] = [p[0], p[p.length - 1]];
    for (let k = 0; k <= 10; k++) out.push([a[0] + (b[0] - a[0]) * k / 10, a[1] + (b[1] - a[1]) * k / 10]);
    return out;
  }
  const out = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    for (let k = 0; k < 8; k++) {
      const t = k / 8, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(p[p.length - 1]);
  return out;
}
function smooth(pts) {
  const segs = []; let cur = [pts[0]];
  for (let i = 1; i < pts.length; i++) { cur.push(pts[i]); if (pts[i][2] && i < pts.length - 1) { segs.push(cur); cur = [pts[i]]; } }
  segs.push(cur);
  const out = [];
  segs.forEach((s, si) => { const c = catmull(s); if (si) c.shift(); out.push(...c); });
  return out;
}
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const demo = {
  el: $('#demo'), canvas: $('#dCanvas'), book: 'ltrl', playing: !reduced, t: 0, last: 0, raf: 0, visible: true, model: null, seed: 1,
  W: 0, H: 0, dpr: 1
};
const ctx = demo.canvas.getContext('2d');

function layout(bookKey) {
  const B = BOOKS[bookKey], W = demo.W, H = demo.H;
  const gap = .26, slant = .1;
  const units = B.letters.reduce((s, [g]) => s + GLYPH[g].w, 0) + gap * (B.letters.length - 1);
  const xh = Math.min(H * .25, (W * .84) / units);
  const base = H * .66;
  let x = (W - units * xh) / 2;
  const rnd = seeded(demo.seed);
  const speed = xh * 6.2 / 1000; // px per ms
  const toPx = (ox, p, j) => [ox + (p[0] + p[1] * slant) * xh + (rnd() - .5) * j * xh, base - p[1] * xh + (rnd() - .5) * j * xh, p[2]];
  const mk = (raw, ox) => {
    const pts = smooth(raw.map(p => toPx(ox, p, .05)));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, len: cum[cum.length - 1] };
  };
  const letters = B.letters.map(([g, ch]) => {
    const G = GLYPH[g];
    const L = { g, base: ch, w: G.w, x0: x, cx: x + (G.w / 2) * xh + .5 * slant * xh, strokes: G.s.map(s => mk(s, x)), recogT: null, muts: [] };
    x += (G.w + gap) * xh;
    return L;
  });
  // Build the event timeline.
  let t = 500; const ev = []; const strokes = [];
  letters.forEach((L, i) => {
    if (i > 0) { letters[i - 1].recogT = t; ev.push({ t, k: 'recog', i: i - 1 }); }
    L.strokes.forEach((S, si) => {
      const d = Math.max(140, S.len / speed);
      S.t0 = t; S.t1 = t + d; strokes.push(S); t += d + (si < L.strokes.length - 1 ? 110 : 190);
    });
  });
  t += 700; // the app recognizes after 0.7 s of idle
  letters[letters.length - 1].recogT = t; ev.push({ t, k: 'recog', i: letters.length - 1 });
  t += 650;
  ev.push({ t: t - 150, k: 'cap', text: B.capMark });
  const marks = B.marks.map(M => {
    const L = letters[M.i];
    const raw = MARK[M.m].map(p => [p[0] + L.w / 2, p[1]]);
    const S = mk(raw, L.x0);
    S.t0 = t; S.t1 = t + Math.max(180, S.len / (speed * .8)); t = S.t1 + 380;
    S.mutT = t - 60; L.muts.push({ t: S.mutT, out: M.out });
    ev.push({ t: S.mutT, k: 'mut', i: M.i });
    t += 260;
    return S;
  });
  t += 500;
  ev.push({ t, k: 'check' });
  ev.push({ t: t + 3200, k: 'end' });
  return { B, letters, marks, ev, xh, base, end: t + 3200, checkT: t, evi: 0 };
}

function drawStroke(S, frac) {
  if (frac <= 0) return null;
  const target = S.len * Math.min(1, frac);
  ctx.beginPath(); ctx.moveTo(S.pts[0][0], S.pts[0][1]);
  let tip = S.pts[0];
  for (let i = 1; i < S.pts.length; i++) {
    if (S.cum[i] <= target) { ctx.lineTo(S.pts[i][0], S.pts[i][1]); tip = S.pts[i]; }
    else {
      const seg = S.cum[i] - S.cum[i - 1], r = seg ? (target - S.cum[i - 1]) / seg : 0;
      tip = [S.pts[i - 1][0] + (S.pts[i][0] - S.pts[i - 1][0]) * r, S.pts[i - 1][1] + (S.pts[i][1] - S.pts[i - 1][1]) * r];
      ctx.lineTo(tip[0], tip[1]); break;
    }
  }
  ctx.stroke();
  return frac < 1 ? tip : null;
}
const ease = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

function render(t) {
  const M = demo.model; if (!M) return;
  const { W, H } = demo; const xh = M.xh;
  ctx.setTransform(demo.dpr, 0, 0, demo.dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // practice-sheet guides: baseline and dashed x-height
  ctx.lineWidth = 1; ctx.strokeStyle = '#ebe5e3';
  ctx.beginPath(); ctx.moveTo(16, M.base + .5); ctx.lineTo(W - 16, M.base + .5); ctx.stroke();
  ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(16, M.base - xh + .5); ctx.lineTo(W - 16, M.base - xh + .5); ctx.stroke(); ctx.setLineDash([]);

  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const ink = '#1c1615';
  let tip = null;
  const fs = xh / .47;
  M.letters.forEach(L => {
    const fade = L.recogT == null ? 0 : clamp((t - L.recogT) / 240);
    if (fade < 1) {
      ctx.globalAlpha = 1 - fade; ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2.4, xh * .075);
      L.strokes.forEach(S => { const f = (t - S.t0) / (S.t1 - S.t0); const tp = drawStroke(S, f >= 1 ? 1 : ease(clamp(f))); if (tp) tip = tp; });
    }
    if (fade > 0) {
      let ch = L.base, lastMut = -1e9;
      L.muts.forEach(m => { if (t >= m.t) { ch = m.out; lastMut = m.t; } });
      const since = t - lastMut, pulse = since < 420 ? 1 - since / 420 : 0;
      ctx.globalAlpha = fade;
      ctx.save(); ctx.translate(L.cx, M.base); const s = 1 + .16 * pulse + .06 * (1 - fade); ctx.scale(s, s);
      ctx.fillStyle = pulse > 0 ? M.B.color : ink;
      ctx.font = `400 ${fs}px "Gentium Book Plus", "Gentium Plus", "Times New Roman", serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(ch, 0, 0); ctx.restore();
    }
  });
  M.marks.forEach(S => {
    const f = (t - S.t0) / (S.t1 - S.t0); if (f <= 0) return;
    const fade = clamp((t - S.mutT) / 200);
    if (fade >= 1) return;
    ctx.globalAlpha = 1 - fade; ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2.4, xh * .075);
    const tp = drawStroke(S, ease(clamp(f))); if (tp) tip = tp;
  });
  ctx.globalAlpha = 1;
  if (tip) { ctx.fillStyle = M.B.color; ctx.beginPath(); ctx.arc(tip[0], tip[1], Math.max(3.5, xh * .09), 0, Math.PI * 2); ctx.fill(); }
}

const dom = { letters: $('#dLetters'), verdict: $('#dVerdict'), cap: $('#dCaption'), prompt: $('#dPrompt'), ch: $('#dChapter'), ct: $('#dCount'), dir: $('#dDir'), enter: $('#dEnter') };
function lettersAt(t) {
  const M = demo.model;
  return M.letters.filter(L => L.recogT != null && t >= L.recogT).map(L => { let c = L.base; L.muts.forEach(m => { if (t >= m.t) c = m.out; }); return c; }).join(' ');
}
function setCaption(text) { dom.cap.textContent = text; }
function applyEvents(t) {
  const M = demo.model;
  let changed = false;
  while (M.evi < M.ev.length && t >= M.ev[M.evi].t) {
    const e = M.ev[M.evi++]; changed = true;
    if (e.k === 'cap') setCaption(e.text);
    if (e.k === 'check') {
      dom.enter.classList.add('press'); setTimeout(() => dom.enter.classList.remove('press'), 160);
      dom.verdict.textContent = '✓ Correct · ' + M.B.entry; dom.verdict.classList.add('on');
      setCaption('Checked against the textbook entry, accents and all.');
    }
    if (e.k === 'end') { nextBook(); return; }
  }
  if (changed) dom.letters.innerHTML = lettersAt(t) || '&nbsp;';
}
function setBook(key, opts = {}) {
  demo.book = key; demo.el.dataset.book = key; demo.seed = (demo.seed * 7 + 3) % 997;
  $$('.booktabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.book === key)));
  const B = BOOKS[key];
  dom.prompt.textContent = B.prompt; dom.ch.textContent = B.ch; dom.ct.textContent = B.count; dom.dir.textContent = B.dir;
  dom.verdict.classList.remove('on'); dom.letters.innerHTML = '&nbsp;';
  setCaption('Each letter is read as it is written.');
  demo.model = layout(key);
  demo.t = 0;
  if (!demo.playing || reduced) { demo.t = demo.model.checkT + 1; applyEvents(demo.t); render(demo.t); }
}
function nextBook() { setBook(ORDER[(ORDER.indexOf(demo.book) + 1) % ORDER.length]); }
function frame(now) {
  demo.raf = 0;
  if (!demo.playing || !demo.visible) return;
  const dt = Math.min(64, now - (demo.last || now)); demo.last = now;
  demo.t += dt;
  applyEvents(demo.t);
  render(demo.t);
  demo.raf = requestAnimationFrame(frame);
}
function kick() { if (!demo.raf && demo.playing && demo.visible) { demo.last = 0; demo.raf = requestAnimationFrame(frame); } }
function resize() {
  const r = demo.canvas.getBoundingClientRect();
  demo.dpr = Math.min(2, window.devicePixelRatio || 1);
  demo.W = r.width; demo.H = r.height;
  demo.canvas.width = Math.round(r.width * demo.dpr); demo.canvas.height = Math.round(r.height * demo.dpr);
  const t = demo.t; demo.model = layout(demo.book); demo.model.evi = demo.model.ev.findIndex(e => e.t > t); if (demo.model.evi < 0) demo.model.evi = demo.model.ev.length;
  render(t);
}
$$('.booktabs button').forEach(b => b.addEventListener('click', () => { setBook(b.dataset.book); kick(); }));
$('#demoReplay').addEventListener('click', () => { setBook(demo.book); kick(); });
const pauseBtn = $('#demoPause');
function syncPause() {
  pauseBtn.setAttribute('aria-label', demo.playing ? 'Pause replay' : 'Play replay');
  $('.i-pause', pauseBtn).hidden = !demo.playing; $('.i-play', pauseBtn).hidden = demo.playing;
}
pauseBtn.addEventListener('click', () => {
  demo.playing = !demo.playing; syncPause();
  if (demo.playing && demo.t >= demo.model.checkT && reduced) setBook(demo.book);
  kick();
});
if ('IntersectionObserver' in window) new IntersectionObserver(es => { demo.visible = es[0].isIntersecting; kick(); }, { threshold: .05 }).observe(demo.canvas);
document.addEventListener('visibilitychange', () => { demo.visible = !document.hidden; kick(); });
if ('ResizeObserver' in window) new ResizeObserver(() => resize()).observe(demo.canvas); else addEventListener('resize', resize);
syncPause();
const fontReady = document.fonts && document.fonts.load ? Promise.race([document.fonts.load('40px "Gentium Book Plus"', 'Rōmaὄνομα'), new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
resize(); setBook('ltrl');
// Open on a finished word so the first frame (and any thumbnail) shows the result; playback then moves on to Greek.
if (demo.playing) { demo.t = demo.model.checkT + 1; applyEvents(demo.t); render(demo.t); }
fontReady.then(() => { resize(); kick(); });

/* =====================================================================
   STUDY MODES
   ===================================================================== */
const MODES = [
  { id: 'draw', group: 'Practice', name: 'Draw', hint: 'Handwriting, checked letter by letter', screens: ['draw'], tag: 'Handwriting recognition',
    title: 'Write the answer by hand',
    body: 'DICTA reads your handwriting as you write and checks it against the textbook entry, macrons, accents and breathing marks included. Writing a word out builds a memory that typing skips.',
    points: ['A stroke over a vowel becomes a macron, accent or breathing', 'Greek-specific rules for letters a recognizer tends to confuse, like ν and υ', 'Animated stroke-order guides for every Greek letter'] },
  { id: 'write', group: 'Practice', name: 'Write', hint: 'Type with a Greek keyboard or macron key', screens: ['write', 'feedback'], tag: 'Typing practice',
    title: 'Type it and see exactly what went wrong',
    body: 'A built-in polytonic Greek keyboard and a one-tap macron key for Latin make it quick to type the real form. Wrong characters are highlighted, so a missing accent can’t hide.',
    points: ['Polytonic Greek keyboard with every accent and breathing', 'Character-by-character feedback on each answer', 'An end-of-session summary of how many tries each word took'] },
  { id: 'cards', group: 'Practice', name: 'Cards', hint: 'Flashcards, audio and piles', screens: ['cards'], tag: 'Flashcards',
    title: 'Flip, listen and sort',
    body: 'Flashcards for every chapter, with a recording on each Learn to Read Latin card. Star the words you miss, or sort a whole chapter into Know, Don’t know and Need review piles.',
    points: ['Swipe or tap to move through a deck', 'Stars follow a word into every other mode', 'Sort into Piles shows which words need work'] },
  { id: 'match', group: 'Practice', name: 'Match', hint: 'A timed matching game', screens: ['match'], tag: 'Game',
    title: 'Match words to meanings against the clock',
    body: 'A quick matching grid, built for a first pass through a new chapter. It works the same way in all three textbooks.',
    points: ['Timed rounds', 'Runs on any playlist you build', 'Shown here with Lingua Latina vocabulary'] },
  { id: 'audio', group: 'Practice', name: 'Audio', hint: 'The original recordings', screens: ['audio'], tag: 'Listening', audio: true,
    title: 'The feature DICTA started with',
    body: 'Every Learn to Read Latin term, read aloud by Casper. Build a playlist by chapter or from your starred words, loop it, and listen while you walk, train or clean.',
    points: ['Playlists by chapter, by stars or by hand', 'Loops for as long as you like', 'Keeps playing while you do something else'] },
  { id: 'multi', group: 'Practice', name: 'Multiplayer', hint: 'Up to 8 players on one Wi‑Fi network', screens: ['multi'], tag: 'Beta', beta: true,
    title: 'Study together, or race',
    body: 'One device hosts and up to seven others on the same Wi‑Fi join. The host picks the mode, direction, chapter and time limit, and everyone answers the same words. Spectators can watch without playing.',
    points: ['Up to 8 players and no accounts', 'Draw, Write or Match rounds', 'A spectator view for watching a game'] },
  { id: 'grammar', group: 'Reference and drills', name: 'Grammar', hint: 'Morphology, syntax, structure', screens: ['grammar'], tag: 'Reference',
    title: 'The grammar behind the vocabulary',
    body: 'A Latin reference laid out the way the textbook teaches it: declensions, conjugations, irregular nouns, verbs and adjectives, and the uses of each case.',
    points: ['Morphology, Syntax and Structure tabs', 'Endings highlighted in every paradigm', 'Worked examples for each case use'] },
  { id: 'ipa', group: 'Reference and drills', name: 'IPA chart', hint: 'The 2018 chart, rebuilt for touch', screens: ['ipa'], tag: 'Reference',
    title: 'The International Phonetic Alphabet, one tap at a time',
    body: 'The 2018 IPA chart rebuilt natively, with consonants, vowels, diacritics, suprasegmentals and tones. Tap a symbol to see how the sound is made. Try it on the phone.',
    points: ['Place, manner and voicing for every consonant', 'Diacritics shown with before-and-after examples', 'For linguistics students and pronunciation work'] },
  { id: 'ex', group: 'Reference and drills', name: 'Exercises', hint: 'Generated drills', screens: ['ex'], tag: 'In development', dev: true,
    title: 'Drills that never run out, limited to your chapter',
    body: 'DICTA builds translation and form-identification exercises from the vocabulary you have studied, using the textbook’s rules for endings and English renderings. It only uses forms from chapters you have reached.',
    points: ['English-to-Latin and Latin-to-English phrases', 'Identify person, number, tense, voice and mood', 'Partial credit for answers with several parts'] }
];
const modeList = $('#modeList'), modeDetail = $('#modeDetail'), dots = $('#phoneDots');
let modeIdx = 0, screenIdx = 0;
const groups = {};
MODES.forEach((m, i) => {
  if (!groups[m.group]) {
    const g = document.createElement('div'); g.className = 'mode-group'; g.setAttribute('role', 'none');
    g.innerHTML = `<span aria-hidden="true">${m.group}</span>`; modeList.appendChild(g); groups[m.group] = g;
  }
  const b = document.createElement('button');
  b.className = 'mode-tab'; b.setAttribute('role', 'tab'); b.id = 'mode-' + m.id; b.setAttribute('aria-controls', 'modeDetail');
  const badge = m.beta ? '<span class="tag beta">Beta</span>' : m.dev ? '<span class="tag dev">Soon</span>' : '';
  b.innerHTML = `<b>${m.name}${badge}</b><small>${m.hint}</small>`;
  b.addEventListener('click', () => selectMode(i, true));
  b.addEventListener('keydown', e => {
    const k = e.key; let n = null;
    if (k === 'ArrowDown' || k === 'ArrowRight') n = (i + 1) % MODES.length;
    if (k === 'ArrowUp' || k === 'ArrowLeft') n = (i - 1 + MODES.length) % MODES.length;
    if (k === 'Home') n = 0; if (k === 'End') n = MODES.length - 1;
    if (n != null) { e.preventDefault(); selectMode(n, true); $('#mode-' + MODES[n].id).focus(); }
  });
  groups[m.group].appendChild(b);
});
const playIcon = '<svg viewBox="0 0 12 12" fill="currentColor"><path d="M3 1.8v8.4a.6.6 0 0 0 .9.5l6.8-4.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5z"/></svg>';
const stopIcon = '<svg viewBox="0 0 12 12" fill="currentColor"><rect x="2.5" y="2.5" width="7" height="7" rx="1.2"/></svg>';
const CLIPS = [['agricola', 'agricola', 'farmer'], ['puella', 'puella', 'girl'], ['regina', 'rēgīna', 'queen'], ['verbum', 'verbum', 'word']];
function showScreen(id) {
  $$('#phoneScreen .scr').forEach(s => { const on = s.dataset.screen === id; s.classList.toggle('on', on); if (s.classList.contains('scr-html')) s.inert = !on; });
}
function selectMode(i, user) {
  modeIdx = i; screenIdx = 0; const m = MODES[i];
  $$('.mode-tab').forEach((b, j) => { b.setAttribute('aria-selected', String(j === i)); b.tabIndex = j === i ? 0 : -1; });
  modeDetail.setAttribute('aria-labelledby', 'mode-' + m.id);
  showScreen(m.screens[0]);
  dots.innerHTML = m.screens.length > 1 ? m.screens.map((s, j) => `<button aria-label="Screen ${j + 1} of ${m.screens.length}" aria-current="${j === 0}"></button>`).join('') : '';
  $$('button', dots).forEach((d, j) => d.addEventListener('click', () => { screenIdx = j; showScreen(m.screens[j]); $$('button', dots).forEach((x, k) => x.setAttribute('aria-current', String(k === j))); }));
  const tagCls = m.beta ? 'tag beta' : m.dev ? 'tag dev' : 'tag';
  modeDetail.innerHTML = `<span class="${tagCls}" style="justify-self:start">${m.tag}</span><h3>${m.title}</h3><p>${m.body}</p><ul>${m.points.map(p => `<li>${p}</li>`).join('')}</ul>` +
    (m.audio ? `<div class="clips">${CLIPS.map(([id, la, en]) => `<span class="clip" style="cursor:default;padding-left:14px"><span class="la" lang="la">${la}</span><span class="en">${en}</span></span>`).join('')}</div><span class="clip-note">Chapter 1 words from the recordings. Hear them in the app.</span>` : '');
  if (user) store.set('dicta-mode', m.id);
}
let playing = null;
function wireClips() {
  $$('.clip', modeDetail).forEach(btn => btn.addEventListener('click', () => {
    const a = document.getElementById('aud-' + btn.dataset.clip);
    if (playing && playing.a !== a) { playing.a.pause(); playing.a.currentTime = 0; resetClip(playing.btn); }
    if (!a.paused) { a.pause(); a.currentTime = 0; resetClip(btn); playing = null; return; }
    playing = { a, btn };
    $('.pb', btn).innerHTML = stopIcon;
    const prog = $('.prog', btn);
    a.ontimeupdate = () => { if (a.duration) prog.style.width = (a.currentTime / a.duration * 100) + '%'; };
    a.onended = () => { resetClip(btn); playing = null; };
    a.play().catch(() => resetClip(btn));
  }));
}
function resetClip(btn) { if (!btn) return; $('.pb', btn).innerHTML = playIcon; $('.prog', btn).style.width = '0'; }
const savedMode = MODES.findIndex(m => m.id === store.get('dicta-mode'));
selectMode(savedMode > -1 ? savedMode : 0, false);

// IPA mini chart
const IPA = {
  p: ['Voiceless bilabial plosive', 'As in English pin'], b: ['Voiced bilabial plosive', 'As in English bin'],
  t: ['Voiceless alveolar plosive', 'As in English tin'], d: ['Voiced alveolar plosive', 'As in English din'],
  k: ['Voiceless velar plosive', 'As in English kin'], 'ɡ': ['Voiced velar plosive', 'As in English go'],
  m: ['Voiced bilabial nasal', 'As in English man'], n: ['Voiced alveolar nasal', 'As in English no'], 'ŋ': ['Voiced velar nasal', 'As in English sing'],
  'ɸ': ['Voiceless bilabial fricative', 'As in Japanese fuji'], 'β': ['Voiced bilabial fricative', 'As in Spanish haba'],
  s: ['Voiceless alveolar fricative', 'As in English sip'], z: ['Voiced alveolar fricative', 'As in English zip'],
  x: ['Voiceless velar fricative', 'As in Scots loch'], 'ɣ': ['Voiced velar fricative', 'As in Spanish lago']
};
$$('#ipaGrid button').forEach(b => {
  b.setAttribute('aria-pressed', String(b.dataset.i === 'ŋ'));
  b.setAttribute('aria-label', IPA[b.dataset.i][0]);
  b.addEventListener('click', () => {
    $$('#ipaGrid button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $('#ipaBig').textContent = b.dataset.i; $('#ipaName').textContent = IPA[b.dataset.i][0]; $('#ipaKw').textContent = IPA[b.dataset.i][1];
  });
});

/* =====================================================================
   BOOKS
   ===================================================================== */
const SHELF = [
  { key: 'ltrl', abbr: 'LTRL', lang: 'Latin', glyph: 'Ā', title: 'Learn to Read Latin', by: 'Andrew Keller & Stephanie Russell', bk: 'var(--red-field)', ink: 'var(--red-ink)',
    facts: [['Terms', '633'], ['Chapters', '1–15']], notes: 'Audio for every term · Grammar reference · Exercises in development',
    words: [['agricola, agricolae (m.)', 'farmer', 1], ['rēgīna, rēgīnae (f.)', 'queen', 1], ['bellum, bellī (n.)', 'war', 1], ['vīta, vītae (f.)', 'life', 2], ['amīcitia, amīcitiae (f.)', 'friendship', 5], ['Rōma, Rōmae (f.)', 'Rome', 6], ['urbs, urbis -ium (f.)', 'city', 6], ['ācer, ācris, ācre', 'sharp, keen; fierce', 6], ['virtūs, virtūtis (f.)', 'manliness, courage; excellence, virtue', 7], ['lēx, lēgis (f.)', 'law', 8], ['nox, noctis -ium (f.)', 'night', 9], ['tempus, temporis (n.)', 'time', 9], ['memoria, memoriae (f.)', 'memory', 12]] },
  { key: 'ltrg', abbr: 'LTRG', lang: 'Ancient Greek', glyph: 'Ω', title: 'Learn to Read Greek', by: 'Andrew Keller & Stephanie Russell', bk: 'var(--ltrg)', ink: 'var(--ltrg-ink)',
    facts: [['Terms', '535'], ['Chapters', '1–16']], notes: 'Polytonic keyboard · Greek handwriting rules · Letter guides',
    words: [['λόγος, λόγου, ὁ', 'word; speech; argument', 1], ['ψῡχή, ψῡχῆς, ἡ', 'soul; life force', 1], ['σοφίᾱ, σοφίᾱς, ἡ', 'wisdom', 1], ['δίκη, δίκης, ἡ', 'justice', 1], ['θάλαττα, θαλάττης, ἡ', 'sea', 2], ['ἀλήθεια, ἀληθείᾱς, ἡ', 'truth', 2], ['δῆμος, δήμου, ὁ', '(the) people', 2], ['ἀρετή, ἀρετῆς, ἡ', 'excellence; valor; virtue', 4], ['νοῦς, νοῦ, ὁ', 'mind; sense; thought', 7], ['πόλις, πόλεως, ἡ', 'city', 7], ['χρόνος, χρόνου, ὁ', 'time', 10], ['ὄνομα, ὀνόματος, τό', 'name', 12], ['ἡδύς, ἡδεῖα, ἡδύ', 'sweet, pleasant', 12]] },
  { key: 'llps', abbr: 'LLPS', lang: 'Latin', glyph: 'F', title: 'Lingua Latina per se Illustrata', by: 'Hans H. Ørberg · Familia Romana', bk: 'var(--llps-field)', ink: 'var(--llps-ink)',
    facts: [['Terms', '1,605'], ['Capitula', 'I–XXXIII']], notes: 'Chapters XXI–XXXIII added in 2026 · Every practice mode',
    words: [['fluvius, -ī (m)', 'river', 1], ['ōceanus, -ī (m)', 'ocean', 1], ['īnsula, -ae (f)', 'island', 1], ['littera, -ae (f)', 'letter (of the alphabet)', 1], ['līberī, -ōrum (m)', 'children', 2], ['rosa, -ae (f)', 'rose', 5], ['silva, -ae (f)', 'woods', 9], ['avis, avis (m/f)', 'bird', 10], ['nāvis, nāvis (f)', 'ship', 16], ['epistula, -ae (f)', 'letter (correspondence)', 18], ['rūs, rūris (n)', 'country', 27], ['iūcundus, -a, -um', 'pleasant, delightful', 30], ['gaudium, -ī (n)', 'joy, gladness', 33]] },
  { key: 'ipa', abbr: 'IPA', lang: 'Phonetics', glyph: 'ʃ', title: 'International Phonetic Alphabet', by: 'The 2018 IPA chart, rebuilt natively', bk: '#332b29', ink: 'var(--ipa-ink)',
    facts: [['Edition', '2018'], ['Type', 'Reference']], notes: 'Consonants, vowels, diacritics and suprasegmentals',
    words: [['ʃ', 'voiceless postalveolar fricative', 'ship'], ['θ', 'voiceless dental fricative', 'thin'], ['ð', 'voiced dental fricative', 'this'], ['ŋ', 'voiced velar nasal', 'sing'], ['ʔ', 'glottal plosive', 'uh-oh'], ['ɹ', 'voiced alveolar approximant', 'red'], ['ɣ', 'voiced velar fricative', 'Spanish lago'], ['æ', 'near-open front unrounded vowel', 'cat']] }
];
const ROMAN = n => { const m = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };
const shuffleIcon = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 3.5h2c2.5 0 3.5 5 6 5h1"/><path d="M1.5 8.5h2c1 0 1.7-.8 2.3-1.8M7.8 4.3c.5-.5 1.1-.8 1.7-.8h1"/><path d="M9.3 2l1.5 1.5L9.3 5M9.3 7l1.5 1.5L9.3 10"/></svg>';
const shelf = $('#shelf');
SHELF.forEach(B => {
  const art = document.createElement('article'); art.className = 'book';
  art.style.setProperty('--bk', B.bk); art.style.setProperty('--bk-ink', B.ink);
  const lang = B.key === 'ltrg' ? 'grc' : B.key === 'ipa' ? 'und' : 'la';
  art.innerHTML = `
    <div class="cover"><span class="glyph" aria-hidden="true">${B.glyph}</span><span class="abbr">${B.abbr}</span><span class="lang">${B.lang}</span></div>
    <div class="book-body"><h3>${B.title}</h3><p class="by">${B.by}</p>
      <dl class="facts">${B.facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></div>
    <p class="book-notes">${B.notes}</p>
    <div class="sample"><div class="sample-k"><span>${B.key === 'ipa' ? 'Symbol' : 'From the word list'}</span></div>
      <div class="sample-w" aria-live="polite"></div>
      <button type="button" class="another">${shuffleIcon}Another ${B.key === 'ipa' ? 'symbol' : 'word'}</button></div>`;
  const w = $('.sample-w', art); let idx = Math.floor(Math.random() * B.words.length);
  const paint = () => {
    const [la, en, c] = B.words[idx];
    const chap = B.key === 'ipa' ? `As in ${c}` : B.key === 'llps' ? `Capitulum ${ROMAN(c)}` : `Chapter ${c}`;
    w.innerHTML = `<span class="la" lang="${lang}">${la}</span><span class="en">${en}</span><span class="ch">${chap}</span>`;
  };
  paint();
  $('.another', art).addEventListener('click', () => {
    let n; do { n = Math.floor(Math.random() * B.words.length); } while (n === idx && B.words.length > 1);
    idx = n;
    if (reduced) return paint();
    w.classList.add('swap'); setTimeout(() => { paint(); w.classList.remove('swap'); }, 180);
  });
  shelf.appendChild(art);
});

/* =====================================================================
   TIMELINE progress
   ===================================================================== */
const tl = $('#timeline');
if (tl) {
const fill = $('.tl .fill'), items = $$('li', tl);
function tlUpdate() {
  const r = tl.getBoundingClientRect(), mid = innerHeight * .62;
  const h = clamp((mid - r.top - 8) / (r.height - 16)) * (r.height - 16);
  fill.style.height = h + 'px';
  items.forEach(li => { const y = li.getBoundingClientRect().top + 10; li.classList.toggle('lit', y < mid && !li.classList.contains('next')); });
}
addEventListener('scroll', tlUpdate, { passive: true }); addEventListener('resize', tlUpdate); tlUpdate();
}

/* =====================================================================
   AUDIENCES
   ===================================================================== */
const ic = {
  book: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5c2.5-1 5-1 7 .5 2-1.5 4.5-1.5 7-.5v11c-2.5-1-5-1-7 .5-2-1.5-4.5-1.5-7-.5z"/><path d="M10 5v11"/></svg>',
  pen: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 3.5l3 3L7 16H4v-3z"/></svg>',
  bell: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13V9a5 5 0 0 1 10 0v4l1.5 2h-13z"/><path d="M8.5 17.5h3"/></svg>',
  wifi: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2.5 7.5a11 11 0 0 1 15 0M5 10.5a7.5 7.5 0 0 1 10 0M7.5 13.5a4 4 0 0 1 5 0"/><circle cx="10" cy="16.2" r=".9" fill="currentColor"/></svg>',
  chart: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 16V9M8.7 16V4M13.3 16v-5M18 16H2"/></svg>',
  hand: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l3.5 3.5a3 3 0 0 0 4.2 0L17 8.2a1.5 1.5 0 0 0-2.1-2.1L11 10"/><path d="M8 8l2.5-2.5a1.5 1.5 0 0 1 2.1 0"/></svg>',
  seal: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="5"/><path d="M7 12.2 6 18l4-2 4 2-1-5.8"/></svg>',
  code: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 6 3 10l4 4M13 6l4 4-4 4"/></svg>',
  check: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5 8 14.5 16 6"/></svg>',
  brush: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5 9 11"/><path d="M8 12c-2 0-3.5 1.2-3.5 3.5 0 .6-.5 1-1 1 1 1 2.5 1 3.5 1 2.5 0 3.5-1.7 3.5-3"/></svg>',
  school: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8l8-4 8 4-8 4z"/><path d="M5.5 9.8V14c1.2 1.2 2.8 1.8 4.5 1.8s3.3-.6 4.5-1.8V9.8"/></svg>'
};
const copyBox = (subject) => `<div class="copybox"><code>dictalearning@gmail.com</code><button type="button" data-copy="dictalearning@gmail.com">Copy</button></div>${subject ? `<span class="small-note">Subject line: “${subject}”</span>` : ''}`;
const AUD = [
  { id: 'students', label: 'Students', h: 'Study the words your class is on tonight',
    p: 'Every term is filed by chapter, so the playlist for tomorrow’s quiz takes a few taps. DICTA is free, with no account to set up.',
    cta: `<a class="btn btn-store" href="https://apps.apple.com/us/app/dicta-learning/id6751761814" target="_blank" rel="noopener"><span><span class="s1">Download on the</span><span class="s2">App Store</span></span></a>`,
    pts: [[ic.pen, 'Learn the form your teacher grades', 'Draw and Write check spelling, macrons and accents, so near-misses get caught before the quiz does.'],
      [ic.book, 'Star the hard words', 'Starred words collect in one list and follow you into every mode, from Cards to Multiplayer.'],
      [ic.bell, 'A word a day', 'A home-screen widget and optional daily reminders keep review going between classes.']] },
  { id: 'teachers', label: 'Teachers', h: 'A companion for the textbook you already teach',
    p: 'DICTA follows Learn to Read Latin, Learn to Read Greek and Lingua Latina chapter by chapter, so there’s nothing to set up. We are planning student testing at Collegiate and Regis and would like more classrooms to join.',
    cta: copyBox('Classroom pilot'),
    pts: [[ic.wifi, 'Whole-class games', 'Run a multiplayer round over the room’s Wi‑Fi with up to eight players, plus spectators.'],
      [ic.chart, 'Accuracy by term and chapter', 'Each student’s Stats screen shows which words and chapters they miss most.'],
      [ic.school, 'Matched to your syllabus', 'Chapter lists, principal parts and glosses follow the textbook’s own entries.']] },
  { id: 'publishers', label: 'Publishers', h: 'An unofficial companion today. We would like to make it official.',
    p: 'DICTA already supports three widely taught textbooks, chapter by chapter, and students use it alongside the printed book. We would like to work with publishers to make it an official companion.',
    cta: copyBox('Partnership') + '<span class="small-note">DICTA is independent and is not affiliated with or endorsed by any publisher.</span>',
    pts: [[ic.seal, 'Official word lists and audio', 'Build DICTA on your edition’s own vocabulary and pronunciations.'],
      [ic.school, 'Classroom pilots', 'Pilot DICTA with schools that teach your text, and share what we learn.'],
      [ic.book, 'More titles', 'The app is built to add books: a new title needs a word list, chapter structure and recognizer settings.']] },
  { id: 'team', label: 'Join the team', h: 'Build tools for the languages you are learning',
    p: 'We are high school students at Collegiate and Regis, and we are growing. You don’t need to be a programmer, but you do need to care about getting the details right.',
    cta: copyBox('Joining DICTA'),
    pts: [[ic.code, 'SwiftUI developers', 'Work on handwriting recognition, multiplayer, and the redesign coming next.'],
      [ic.check, 'Latin and Greek checkers', 'Proofread vocabulary, macrons, accents and paradigms against the textbooks.'],
      [ic.brush, 'Designers and school ambassadors', 'Help redesign the interface, or run testing groups at your school.']] }
];
const audTabs = $('#audTabs'), audPanel = $('#audPanel');
AUD.forEach((a, i) => {
  const b = document.createElement('button'); b.setAttribute('role', 'tab'); b.id = 'aud-' + a.id; b.textContent = a.label; b.setAttribute('aria-controls', 'audPanel');
  b.addEventListener('click', () => selectAud(i, true));
  b.addEventListener('keydown', e => {
    let n = null; if (e.key === 'ArrowRight') n = (i + 1) % AUD.length; if (e.key === 'ArrowLeft') n = (i - 1 + AUD.length) % AUD.length;
    if (n != null) { e.preventDefault(); selectAud(n, true); $('#aud-' + AUD[n].id).focus(); }
  });
  audTabs.appendChild(b);
});
function selectAud(i, user) {
  const a = AUD[i];
  $$('button', audTabs).forEach((b, j) => { b.setAttribute('aria-selected', String(j === i)); b.tabIndex = j === i ? 0 : -1; });
  audPanel.setAttribute('aria-labelledby', 'aud-' + a.id);
  audPanel.innerHTML = `<div class="aud-left"><h3>${a.h}</h3><p>${a.p}</p>${a.cta}</div>
    <div class="aud-points">${a.pts.map(([icon, t, d]) => `<div><span class="ic">${icon}</span><div><b>${t}</b><p>${d}</p></div></div>`).join('')}</div>`;
  if (user) store.set('dicta-aud', a.id);
}
const savedAud = AUD.findIndex(a => a.id === store.get('dicta-aud'));
selectAud(savedAud > -1 ? savedAud : 0, false);

/* =====================================================================
   TEAM + BOARD
   ===================================================================== */
const TEAM = [
  { n: 'Casper Lippman', i: 'CL', r: 'Founder · Collegiate ’27', c: 'var(--red-field)' },
  { n: 'Avaan Chamadia', i: 'AC', r: 'Developer · Collegiate ’28', c: 'var(--ltrg)' },
  { n: 'Ryan Keum', i: 'RK', r: 'Regis ’28', c: 'var(--llps-field)' },
  { n: 'Otto Gallipoli', i: 'OG', r: 'Collegiate ’27', c: '#5b4f8a' },
  { n: 'Hannah Kantowitz', i: 'HK', r: 'Co-founder · Grace Church ’26', c: '#2a2423' }
];
$('#teamGrid').innerHTML = TEAM.map(m => `<div class="member"><span class="mono" style="--mc:${m.c}" aria-hidden="true">${m.i}</span>
  <div><b>${m.n}</b><span class="role">${m.r}</span></div></div>`).join('');

const BOARD = [
  [1, 'Multiplayer competition mode', 'Casper', [6, 4, 2], 'done', 'Shipped · v1.10'],
  [3, 'Develop the website: shiny, sleek, informative', 'Casper → Ryan', [3, 5, 2], 'done', 'Shipped · this site'],
  [10, 'Sort cards into piles (know, don’t know, need review)', 'Avaan', [2, 7, 1], 'done', 'Shipped · v1.10'],
  [11, 'Add textbook grammar, endings, etc.', 'Avaan', [7, 8, 7], 'done', 'Shipped · v1.12'],
  [12, 'IPA / linguistics training tool as a new DICTA book', 'Casper', [4, 6, 2], 'done', 'Shipped · v1.11'],
  [15, 'Study Lockdown Mode (inspired by Opal)', 'Casper', [5, 3, 2], 'wait', 'Waiting'],
  [16, 'Short-form video scroller for vocab', 'Casper', [8, 4, 3], 'wait', 'Waiting'],
  [18, 'UI/UX redevelopment', 'Casper', [7, 7, 5], 'wait', 'Next'],
  [19, 'Diacritics optional setting', 'Ryan', [1, 3, 1], 'done', 'Shipped · v1.11']
];
const meterColors = ['var(--ink-3)', 'var(--ltrg)', 'var(--red)'];
$('#boardBody').innerHTML = BOARD.map(([n, idea, who, v, st, label]) => `<tr data-s="${st}">
  <td class="num">${String(n).padStart(2, '0')}</td><td class="idea">${idea}</td><td class="who">${who}</td>
  <td><span class="meter" aria-label="Difficulty ${v[0]}, benefit ${v[1]}, risk ${v[2]}">${v.map((x, k) => `<span><i style="--v:${x};--c:${meterColors[k]}"></i>${x}</span>`).join('')}</span></td>
  <td><span class="status ${st}">${label}</span></td></tr>`).join('');
$$('#boardFilters button').forEach(b => b.addEventListener('click', () => {
  $$('#boardFilters button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  const f = b.dataset.f;
  $$('#boardBody tr').forEach(tr => { const s = tr.dataset.s; tr.hidden = f === 'all' ? false : f === 'done' ? s !== 'done' : s === 'done'; });
}));

/* =====================================================================
   COPY BUTTONS, NAV
   ===================================================================== */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-copy]'); if (!b) return;
  const text = b.dataset.copy, code = b.parentElement.querySelector('code');
  const done = () => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1600); };
  const fallback = () => { const r = document.createRange(); r.selectNodeContents(code); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Selected'; setTimeout(() => { b.textContent = 'Copy'; }, 1600); };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (err) { fallback(); }
});

const links = $$('.nav-links a');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['modes', 'books', 'for', 'privacy', 'team'].forEach(id => io.observe(document.getElementById(id)));
}


})();
