'use strict';
const VAPID_PUBLIC = 'BKfIaLd5y-KtyffIbjNZhhHyGEyyAaNveNG9OvCT_TA497aAGTFJa0WWyHqG_gIf9-1lGnJ5d1OmN97pqfgVYbs';
const KEY = 'shahpari';

// ---------- state ----------
const blank = {
  tasks: [], goals: [], periods: [], pills: [], pillLog: {}, meals: {},
  settings: { morning: '08:00' },
  ui: { tab: 'overview', scope: 'day', taskSeg: 'short', healthSeg: 'period', cal: { task: true, goal: true, period: true, pill: false, meal: false } },
};
let S = {};
try { S = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
S = { ...blank, ...S, settings: { ...blank.settings, ...S.settings }, ui: { ...blank.ui, ...S.ui } };
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
const U = {}; // per-session UI state: sheet, anim, sel, calM, mw, showDone

// ---------- dates (stored as local YYYY-MM-DD, shown in Jalali via Intl) ----------
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => new Date(+s.slice(0, 4), s.slice(5, 7) - 1, +s.slice(8, 10));
const add = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const today = () => iso(new Date());
const diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const jpf = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', { day: 'numeric' });
const jday = s => +jpf.formatToParts(parse(s)).find(p => p.type === 'day').value;
const fa = (s, o) => parse(s).toLocaleDateString('fa-IR-u-ca-persian', o);
const num = n => n.toLocaleString('fa-IR');
const faDigits = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const week = s => Array.from({ length: 7 }, (_, i) => add(s, i)); // rolling: from s onward, no past-day noise
const monthDays = s => {
  const days = [];
  for (let d = add(s, 1 - jday(s)); days.length < 28 || jday(d) !== 1; d = add(d, 1)) days.push(d);
  return days;
};
const dateLabel = s => ({ 0: 'امروز', 1: 'فردا', [-1]: 'دیروز' })[diff(today(), s)] ?? fa(s, { weekday: 'long', day: 'numeric', month: 'long' });

const h = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const task = id => S.tasks.find(x => x.id === id);
const goal = id => S.goals.find(x => x.id === id);
const pill = id => S.pills.find(x => x.id === id);
const byTime = (a, b) => (a.time || '99').localeCompare(b.time || '99');
const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;

// ---------- period ----------
function periodInfo() {
  const P = [...S.periods].sort((a, b) => a.start.localeCompare(b.start));
  const ended = P.filter(p => p.end);
  const len = ended.length ? Math.round(ended.reduce((n, p) => n + diff(p.start, p.end) + 1, 0) / ended.length) : 5;
  const gaps = P.slice(1).map((p, i) => diff(P[i].start, p.start)).filter(g => g > 14 && g < 60).slice(-6);
  const cycle = gaps.length ? Math.round(gaps.reduce((a, b) => a + b) / gaps.length) : 28;
  const days = new Set(), pred = new Set(), t = today();
  for (const p of P) for (let d = p.start, end = p.end || add(p.start, len - 1); d <= end; d = add(d, 1)) days.add(d);
  const last = P.at(-1), next = last && add(last.start, cycle);
  if (last) for (let k = 1; k <= 6; k++) for (let i = 0; i < len; i++) {
    const d = add(last.start, cycle * k + i);
    if (d >= t && !days.has(d)) pred.add(d);
  }
  const ongoing = last && !last.end && last.start <= t && diff(last.start, t) < 10;
  return { P, cycle, days, pred, last, next, ongoing };
}
function periodHero(I) {
  const t = today();
  if (!I.last) return { big: '—', cap: 'هنوز ثبتی نیست', prog: 0 };
  const prog = Math.min(1, (diff(I.last.start, t) + 1) / I.cycle);
  if (I.days.has(t)) return { big: num(diff(I.P.findLast(p => p.start <= t).start, t) + 1), cap: 'روزِ پریود', prog };
  const d = diff(t, I.next);
  return d > 0 ? { big: num(d), cap: 'روز تا پریود بعدی', prog }
    : d === 0 ? { big: 'امروز', cap: 'شروع احتمالی', prog: 1 }
    : { big: num(-d), cap: 'روز تأخیر', prog: 1 };
}

// ---------- ui kit (iOS inset-grouped lists) ----------
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="M10 6h10M10 12h10M10 18h10M3.5 6 5 7.5 7.5 5M3.5 12 5 13.5 7.5 11M3.5 18 5 19.5 7.5 17"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  fork: '<path d="M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17 21V3c-2.2 1.6-3 4.5-3 8h3"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  plusc: '<circle cx="12" cy="12" r="9.5"/><path d="M12 8v8M8 12h8"/>',
  minusc: '<circle cx="12" cy="12" r="9.5"/><path d="M8 12h8"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  drop: '<path d="M12 3.5s6 6.3 6 10.5a6 6 0 0 1-12 0c0-4.2 6-10.5 6-10.5z"/>',
  pill: '<g transform="rotate(-45 12 12)"><rect x="3" y="8.5" width="18" height="7" rx="3.5"/><path d="M12 8.5v7"/></g>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r=".8"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4M7 11H5v10h14V11h-2"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24">${ICONS[n]}</svg>`;
const lead = (n, c) => `<span class="lead" style="background:${c}">${ic(n)}</span>`;
const group = (header, rows, footer = '') =>
  `<section class="group">${header ? `<div class="gh">${header}</div>` : ''}<div class="list">${rows}</div>${footer ? `<div class="gf">${footer}</div>` : ''}</section>`;
const cell = (main, { pre = '', trail = '', a = '', cls = '' } = {}) =>
  `<div class="cell ${cls} ${a ? 'tap' : ''}" ${a}>${pre}<div class="body"><div class="main">${main}</div>${trail}</div></div>`;
const empty = text => cell(`<span class="sec">${text}</span>`);
const titled = (title, sub, subCls = '') => `<div class="title">${title}</div>${sub ? `<div class="subtitle ${subCls}">${sub}</div>` : ''}`;
const seg = (k, v, label) => `<button class="${S.ui[k] === v ? 'on' : ''}" data-a="seg" data-k="${k}" data-v="${v}">${label}</button>`;
const addRow = (kind, ph, d = '', id = '') =>
  `<form class="cell add-row" data-add="${kind}" data-d="${d}" ${id ? `data-id="${id}"` : ''}><span class="plus">${ic('plusc')}</span><div class="body"><input class="plain" type="text" name="v" placeholder="${ph}" enterkeyhint="done" autocomplete="off"></div></form>`;
const header = (title, actions = '', eyebrow = '') => `${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<header class="lt"><h1>${title}</h1>${actions}</header>`;
const open = (k, id = '') => `data-a="open" data-k="${k}" data-id="${id}"`;
// native picker stays (invisible, on top) but the label shows the Jalali date
const jdate = (v, attrs) => `<label class="pick jpick">${v ? fa(v, { day: 'numeric', month: 'short', year: 'numeric' }) : '<span class="sec">انتخاب</span>'}<input type="date" value="${v || ''}" ${attrs}></label>`;
const dateField = (x, f) => `${x[f] ? `<button class="clear" data-a="clearDate" data-id="${x.id}">${ic('minusc')}</button>` : ''}${jdate(x[f], `data-f="${f}" data-id="${x.id}"`)}`;

function taskRow(x, showDate) {
  const late = x.date && x.date < today() && !x.done;
  const sub = [(showDate || late) && x.date && dateLabel(x.date), x.time && faDigits(x.time)].filter(Boolean).join('، ');
  return `<div class="cell tap ${x.done ? 'done' : ''}" ${open('task', x.id)}>
    <button class="check ${x.done ? 'on' : ''}" data-a="toggleTask" data-id="${x.id}"></button>
    <div class="body"><div class="main">${titled(h(x.title), sub, late ? 'late' : '')}</div></div></div>`;
}

const pillSlots = () => S.pills.flatMap(p => p.times.map(time => ({ p, time, k: `${p.id}@${time}` }))).sort(byTime);
const pillRows = d => pillSlots().map(({ p, time, k }) => {
  const on = S.pillLog[d]?.[k];
  return `<div class="cell ${on ? 'done' : ''}"><button class="check blue ${on ? 'on' : ''}" data-a="pill" data-k="${k}" data-d="${d}"></button>
    <div class="body"><div class="main">${titled(h(p.name), faDigits(time))}</div></div></div>`;
}).join('');

const MEALS = [['cook', 'چی بپزم'], ['b', 'صبحانه'], ['l', 'ناهار'], ['d', 'شام']];
const mealRows = d => MEALS.filter(([k]) => S.meals[d]?.[k]).map(([k, l]) => cell(`<span class="flabel">${l}</span>${h(S.meals[d][k])}`)).join('');
const nextSteps = () => S.goals.map(g => [g, g.steps.find(s => !s.done)]).filter(([, s]) => s).map(([g, s]) =>
  `<div class="cell"><button class="check purple" data-a="step" data-id="${g.id}" data-i="${g.steps.indexOf(s)}"></button><div class="body"><div class="main">${titled(h(s.t), h(g.title))}</div></div></div>`).join('');

// ---------- tabs ----------
function overview() {
  const t = today(), hr = new Date().getHours();
  const hello = hr < 12 ? 'صبح بخیر' : hr < 17 ? 'روز بخیر' : 'عصر بخیر';
  return header(hello, `<button class="icon-btn" ${open('settings')}>${ic('sliders')}${needsCopy() ? '<i class="badge-dot"></i>' : ''}</button>`,
      fa(t, { weekday: 'long', day: 'numeric', month: 'long' }))
    + (standalone ? '' : group('', cell('برای نصب، دکمهٔ اشتراک‌گذاری سافاری رو بزن و <b>Add to Home Screen</b> رو انتخاب کن.', { pre: lead('share', 'var(--blue)') })))
    + `<div class="seg">${seg('scope', 'day', 'امروز')}${seg('scope', 'week', 'هفت روز آینده')}</div>`
    + (S.ui.scope === 'day' ? overviewDay(t) : overviewWeek(t));
}

const tile = (icon, color, n, label, attrs) =>
  `<button class="tile" ${attrs}><span class="dot" style="background:${color}">${ic(icon)}</span><span class="n">${n}</span><span class="l">${label}</span></button>`;

function overviewDay(t) {
  const late = S.tasks.filter(x => !x.done && x.date && x.date < t);
  const todays = S.tasks.filter(x => x.date === t).sort((a, b) => a.done - b.done || byTime(a, b));
  const undated = S.tasks.filter(x => !x.done && !x.date);
  const left = late.length + todays.filter(x => !x.done).length;
  const slots = pillSlots(), taken = slots.filter(s => S.pillLog[t]?.[s.k]).length;
  const P = periodHero(periodInfo()), steps = nextSteps(), meals = mealRows(t);
  return `<div class="tiles">
      ${tile('list', 'var(--accent)', num(left), 'کار مونده', 'data-a="go" data-v="tasks" data-s="taskSeg" data-sv="short"')}
      ${tile('pill', 'var(--blue)', slots.length ? `${num(taken)}/${num(slots.length)}` : '—', 'قرص امروز', 'data-a="go" data-v="health" data-s="healthSeg" data-sv="pill"')}
      ${tile('drop', 'var(--pink)', P.big, P.cap, 'data-a="go" data-v="health" data-s="healthSeg" data-sv="period"')}
      ${tile('target', 'var(--purple)', num(S.goals.length), 'هدف', 'data-a="go" data-v="tasks" data-s="taskSeg" data-sv="long"')}
    </div>`
    + group('کارهای امروز', addRow('task', 'کار جدید', t) + [...late, ...todays].map(x => taskRow(x)).join(''),
      todays.length && !left ? 'همهٔ کارهای امروز انجام شد 🎉' : '')
    + (slots.length ? group('قرص‌ها', pillRows(t)) : '')
    + group('غذای امروز', meals || cell('<span class="accent">برنامه‌ریزی غذا</span>', { a: 'data-a="go" data-v="meals"' }))
    + (steps ? group('قدم بعدی هدف‌ها', steps) : '')
    + (undated.length ? group('هر وقت شد', undated.map(x => taskRow(x)).join('')) : '');
}

function overviewWeek(t) {
  const I = periodInfo(), late = S.tasks.filter(x => !x.done && x.date && x.date < t);
  return (late.length ? group('عقب‌افتاده', late.map(x => taskRow(x, true)).join('')) : '') + week(t).map(d => {
    const m = S.meals[d], food = m && [m.cook, m.l && `ناهار: ${m.l}`, m.d && `شام: ${m.d}`].filter(Boolean).join('، ');
    const rows = S.tasks.filter(x => x.date === d).sort(byTime).map(x => taskRow(x)).join('')
      + S.goals.filter(g => g.date === d).map(g => cell(h(g.title), { pre: lead('target', 'var(--purple)'), a: open('goal', g.id) })).join('')
      + (I.days.has(d) ? cell('پریود', { pre: lead('drop', 'var(--pink)') }) : I.pred.has(d) ? cell('<span class="sec">احتمال پریود</span>', { pre: lead('drop', 'var(--pink)') }) : '')
      + (food ? cell(h(food), { pre: lead('fork', 'var(--orange)') }) : '');
    return group(dateLabel(d), rows || empty('برنامه‌ای نیست'));
  }).join('');
}

function tasksTab() {
  return header('کارها') + `<div class="seg">${seg('taskSeg', 'short', 'کارهای کوتاه')}${seg('taskSeg', 'long', 'هدف‌های بلند')}</div>`
    + (S.ui.taskSeg === 'short' ? shortTasks() : goalsView());
}

function shortTasks() {
  const t = today(), pending = S.tasks.filter(x => !x.done), done = S.tasks.filter(x => x.done);
  const groups = [
    ['عقب‌افتاده', pending.filter(x => x.date && x.date < t)],
    ['امروز', pending.filter(x => x.date === t).sort(byTime)],
    ['بعداً', pending.filter(x => x.date > t).sort((a, b) => a.date.localeCompare(b.date))],
    ['بی‌تاریخ', pending.filter(x => !x.date)],
  ];
  return group('', addRow('task', 'کار جدید'), pending.length ? '' : 'هیچ کاری نمونده ✨')
    + groups.filter(g => g[1].length).map(([n, xs]) => group(n, xs.map(x => taskRow(x, n === 'بعداً')).join(''))).join('')
    + (done.length ? group('', cell(`<span class="accent">${U.showDone ? 'پنهان کردن' : 'نمایش'} انجام‌شده‌ها (${num(done.length)})</span>`, { a: 'data-a="showDone"' })
      + (U.showDone ? done.map(x => taskRow(x, true)).join('') + cell('<span class="danger">پاک کردن انجام‌شده‌ها</span>', { a: 'data-a="clearDone"' }) : '')) : '');
}

function goalsView() {
  return group('', addRow('goal', 'هدف جدید'), S.goals.length ? '' : 'هدف‌های بزرگ رو به قدم‌های کوچیک بشکن.')
    + S.goals.map(g => {
      const n = g.steps.length, k = g.steps.filter(s => s.done).length;
      return `<section class="group"><div class="gh tap" ${open('goal', g.id)}>${h(g.title)}${n && k === n ? ' 🎉' : ''}<span class="gh-more">${ic('left')}</span></div><div class="list">
        ${n || g.date ? cell(`<div class="bar"><i style="width:${n ? k / n * 100 : 0}%"></i></div>`,
          { trail: `<span class="trail">${n ? `${num(k)} از ${num(n)}` : ''}${g.date ? `، ${fa(g.date, { day: 'numeric', month: 'short' })}` : ''}</span>` }) : ''}
        ${g.steps.map((s, i) => `<div class="cell ${s.done ? 'done' : ''}"><button class="check purple ${s.done ? 'on' : ''}" data-a="step" data-id="${g.id}" data-i="${i}"></button><div class="body"><div class="main">${h(s.t)}</div></div></div>`).join('')}
        ${addRow('step', 'قدم کوچیک بعدی', '', g.id)}</div></section>`;
    }).join('');
}

const CAL_TYPES = [['task', 'کارها', 'var(--accent)'], ['goal', 'هدف‌ها', 'var(--purple)'], ['period', 'پریود', 'var(--pink)'], ['pill', 'قرص', 'var(--blue)'], ['meal', 'غذا', 'var(--orange)']];
function calendarTab() {
  const t = today(); U.calM ??= t; U.sel ??= t;
  const days = monthDays(U.calM), I = periodInfo(), sh = S.ui.cal, sel = U.sel;
  const lead0 = (parse(days[0]).getDay() + 1) % 7;
  const cells = days.map(d => {
    const dots = CAL_TYPES.filter(([k]) => sh[k] && k !== 'period' && (
      k === 'task' ? S.tasks.some(x => x.date === d) : k === 'goal' ? S.goals.some(g => g.date === d)
        : k === 'pill' ? Object.values(S.pillLog[d] || {}).some(Boolean) : MEALS.some(([m]) => S.meals[d]?.[m])));
    const cls = [d === t && 'today', d === sel && 'sel', sh.period && I.days.has(d) && 'per', sh.period && I.pred.has(d) && 'pred'].filter(Boolean).join(' ');
    return `<button class="d ${cls}" data-a="sel" data-d="${d}"><span class="n">${num(jday(d))}</span><span class="dots">${dots.map(c => `<i style="background:${c[2]}"></i>`).join('')}</span></button>`;
  });
  const rows = (sh.task ? addRow('task', 'کار جدید برای این روز', sel) + S.tasks.filter(x => x.date === sel).sort(byTime).map(x => taskRow(x)).join('') : '')
    + (sh.goal ? S.goals.filter(g => g.date === sel).map(g => cell(h(g.title), { pre: lead('target', 'var(--purple)'), a: open('goal', g.id) })).join('') : '')
    + (sh.period && I.days.has(sel) ? cell('پریود', { pre: lead('drop', 'var(--pink)') }) : sh.period && I.pred.has(sel) ? cell('<span class="sec">احتمال پریود</span>', { pre: lead('drop', 'var(--pink)') }) : '')
    + (sh.pill ? pillRows(sel) : '')
    + (sh.meal ? mealRows(sel) : '');
  return header(fa(days[0], { month: 'long', year: 'numeric' }),
      `${days.includes(t) ? '' : '<button class="link" data-a="calToday">امروز</button>'}
       <button class="icon-btn" data-a="month" data-n="-1">${ic('right')}</button><button class="icon-btn" data-a="month" data-n="1">${ic('left')}</button>`)
    + `<div class="chips">${CAL_TYPES.map(([k, l, c]) => `<button class="chip ${sh[k] ? 'on' : ''}" data-a="calT" data-k="${k}"><i style="background:${c}"></i>${l}</button>`).join('')}</div>
    <div class="list calbox"><div class="cal">${'شیدسچپج'.split('').map(c => `<div class="hd">${c}</div>`).join('')}${'<span></span>'.repeat(lead0)}${cells.join('')}</div></div>`
    + group(dateLabel(sel), rows || empty('چیزی نیست'));
}

function healthTab() {
  return header('سلامت') + `<div class="seg">${seg('healthSeg', 'period', 'پریود')}${seg('healthSeg', 'pill', 'قرص‌ها')}</div>`
    + (S.ui.healthSeg === 'period' ? periodView() : pillsView());
}

function periodView() {
  const I = periodInfo(), t = today(), H = periodHero(I);
  const hist = [...I.P].reverse().map(p => cell(titled(fa(p.start, { day: 'numeric', month: 'long', year: 'numeric' }),
      p.end ? `${num(diff(p.start, p.end) + 1)} روز` : 'پایان ثبت نشده'),
    { pre: `<button class="minus" data-a="delPeriod" data-d="${p.start}">${ic('minusc')}</button>`,
      trail: jdate(p.end, `min="${p.start}" max="${today()}" data-f="pend" data-d="${p.start}"`) })).join('');
  return `<div class="list hero">
      <div class="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" stroke="var(--fill)"/>
        <circle cx="60" cy="60" r="52" stroke="var(--pink)" stroke-dasharray="${(H.prog * 326.7).toFixed(1)} 400" transform="rotate(-90 60 60)"/></svg>
        <div class="ring-c"><div class="big">${H.big}</div><div class="cap">${H.cap}</div></div></div>
      ${I.next ? `<div class="sec" style="font-size:15px">پیش‌بینی بعدی ${fa(I.next, { weekday: 'long', day: 'numeric', month: 'long' })}، چرخه ${num(I.cycle)} روزه</div>` : ''}
      <button class="btn" data-a="${I.ongoing ? 'pEnd' : 'pStart'}">${I.ongoing ? 'پریودم امروز تموم شد' : 'پریودم امروز شروع شد'}</button>
    </div>`
    + group('ثبت شروع گذشته', cell('تاریخ شروع', { trail: jdate('', `max="${t}" data-f="addPeriod"`) }))
    + group('تاریخچه', hist || empty('هنوز چیزی ثبت نشده'), hist ? 'برای ثبت پایان، تاریخ سمت چپ رو انتخاب کن.' : '');
}

function pillsView() {
  return group('امروز', pillRows(today()) || empty('هنوز قرصی اضافه نشده'))
    + group('قرص‌های من', S.pills.map(p => cell(titled(h(p.name), p.times.map(faDigits).join('، ') || 'بدون ساعت'),
        { pre: lead('pill', 'var(--blue)'), a: open('pill', p.id), trail: `<span class="chev">${ic('left')}</span>` })).join('') + addRow('pill', 'قرص جدید'),
      needsCopy() ? 'ساعت‌ها عوض شده؛ از تنظیمات صفحهٔ خلاصه دوباره «کپی» بزن تا اعلان‌ها درست بیان.' : '');
}

function mealsTab() {
  U.mw ??= today();
  const days = week(U.mw);
  return header('غذا', `<button class="icon-btn" data-a="mweek" data-n="-7">${ic('right')}</button><button class="icon-btn" data-a="mweek" data-n="7">${ic('left')}</button>`,
      `${fa(days[0], { day: 'numeric', month: 'long' })} تا ${fa(days[6], { day: 'numeric', month: 'long' })}`)
    + days.map(d => group(dateLabel(d), MEALS.map(([k, l]) =>
      `<label class="cell"><div class="body"><span class="flabel">${l}</span><input class="plain" type="text" value="${h(S.meals[d]?.[k])}" data-meal="${d}" data-k="${k}" enterkeyhint="done"></div></label>`).join(''))).join('');
}

// ---------- sheets ----------
function taskSheet(x) {
  return group('', `<div class="cell"><div class="body"><input class="plain big-input" type="text" value="${h(x.title)}" data-f="title" data-id="${x.id}"></div></div>`)
    + group('', cell('تاریخ', { pre: lead('cal', 'var(--red)'), trail: dateField(x, 'date') })
      + (x.date ? cell('یادآوری', { pre: lead('bell', 'var(--orange)'), trail: `<input class="pick" type="time" value="${x.time || ''}" data-f="time" data-id="${x.id}">` }) : ''),
      'تاریخ و یادآوری اختیاری‌اند.')
    + group('', cell('<span class="danger">حذف کار</span>', { a: `data-a="delTask" data-id="${x.id}"`, cls: 'center' }));
}

function goalSheet(g) {
  return group('', `<div class="cell"><div class="body"><input class="plain big-input" type="text" value="${h(g.title)}" data-f="title" data-id="${g.id}"></div></div>`)
    + group('', cell('تاریخ هدف', { pre: lead('cal', 'var(--red)'), trail: dateField(g, 'date') }), 'اختیاری')
    + (g.steps.length ? group('قدم‌ها', g.steps.map((s, i) => cell(h(s.t), { pre: `<button class="minus" data-a="delStep" data-id="${g.id}" data-i="${i}">${ic('minusc')}</button>` })).join('')) : '')
    + group('', cell('<span class="danger">حذف هدف</span>', { a: `data-a="delGoal" data-id="${g.id}"`, cls: 'center' }));
}

function pillSheet(p) {
  return group('', `<div class="cell"><div class="body"><input class="plain big-input" type="text" value="${h(p.name)}" data-f="pname" data-id="${p.id}"></div></div>`)
    + group('ساعت‌ها', p.times.map(time => cell(faDigits(time), { pre: `<button class="minus" data-a="delTime" data-id="${p.id}" data-t="${time}">${ic('minusc')}</button>` })).join('')
      + `<form class="cell add-row" data-add="time" data-id="${p.id}"><span class="plus">${ic('plusc')}</span><div class="body"><div class="main">افزودن ساعت</div>
          <input class="pick" type="time" name="v" value="12:00" required><button class="link">افزودن</button></div></form>`)
    + group('', cell('<span class="danger">حذف قرص</span>', { a: `data-a="delPill" data-id="${p.id}"`, cls: 'center' }));
}

function settingsSheet() {
  return group('اعلان‌ها',
      (standalone ? '' : cell('<span class="sec">اول اپ رو به Home Screen اضافه کن.</span>', { pre: lead('share', 'var(--blue)') }))
      + cell('یادآوری صبح', { pre: lead('bell', 'var(--orange)'), trail: `<input class="pick" type="time" value="${S.settings.morning}" data-f="morning">` })
      + (S.sub
        ? cell('<span class="accent">کپی تنظیمات اعلان</span>', { a: 'data-a="copyCfg"', trail: needsCopy() ? '<span class="badge">به‌روزرسانی</span>' : '' })
        : cell('<span class="accent">روشن کردن اعلان‌ها</span>', { a: 'data-a="enablePush"' })),
      S.sub ? 'متن کپی‌شده رو برای کسی که اپ رو راه انداخته بفرست (GitHub secret: SHAHPARI_PUSH). هر بار ساعت صبح یا قرص‌ها عوض شد، دوباره کپی کن.'
        : 'هر صبح و سر ساعت قرص‌ها یادت میندازه.')
    + group('پشتیبان', cell('<span class="accent">ذخیرهٔ فایل پشتیبان</span>', { a: 'data-a="export"' })
      + `<label class="cell tap"><div class="body"><div class="main accent">بازگردانی از فایل</div></div><input type="file" accept=".json,application/json" data-f="import" hidden></label>`,
      `همه‌چیز فقط روی همین گوشی ذخیره می‌شه.${S.backupAt ? ` آخرین پشتیبان: ${dateLabel(S.backupAt)}` : ''}`);
}

function sheet() {
  const [k, id] = U.sheet || [];
  const x = { task, goal, pill }[k]?.(id);
  const [title, body] = k === 'settings' ? ['تنظیمات', settingsSheet()]
    : !x ? [] : k === 'task' ? ['جزئیات', taskSheet(x)] : k === 'goal' ? ['هدف', goalSheet(x)] : ['قرص', pillSheet(x)];
  if (!body) return (U.sheet = null, '');
  return `<div class="sheet-wrap ${U.anim ? 'anim' : ''}"><div class="backdrop" data-a="close"></div><div class="sheet">
    <div class="grabber"></div><div class="sheet-bar"><span></span><b>${title}</b><button class="link bold" data-a="close">تمام</button></div>
    ${body}</div></div>`;
}

// ---------- notifications (pushed by the GitHub Actions cron, see .github/workflows/notify.yml) ----------
function pushConfig() {
  if (!S.sub) return '';
  const schedule = [
    { t: S.settings.morning, body: 'صبح بخیر 🌸 یه نگاه به برنامهٔ امروزت بنداز' },
    ...S.pills.flatMap(p => p.times.map(t => ({ t, body: `وقت ${p.name} 💊` }))),
  ];
  return JSON.stringify({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, sub: S.sub, schedule });
}
const needsCopy = () => S.sub && pushConfig() !== S.copied;

async function enablePush() {
  if (!('PushManager' in window)) return alert('اول اپ رو به صفحهٔ اصلی (Home Screen) اضافه کن و از اونجا بازش کن.');
  if (await Notification.requestPermission() !== 'granted') return alert('اجازهٔ اعلان داده نشد. از تنظیمات آیفون ← اعلان‌ها ← شاه‌پری روشنش کن.');
  const reg = await navigator.serviceWorker.ready;
  const key = Uint8Array.from(atob(VAPID_PUBLIC.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  S.sub = sub.toJSON();
}

async function exportData() {
  const file = new File([JSON.stringify(S)], `shahpari-${today()}.json`, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch { return; }
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = file.name; a.click();
  }
  S.backupAt = today();
}

async function importData(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch {}
  if (!Array.isArray(data?.tasks)) return alert('این فایل پشتیبان شاه‌پری نیست.');
  if (!confirm('همهٔ اطلاعات فعلی با فایل پشتیبان جایگزین بشه؟')) return;
  localStorage.setItem(KEY, JSON.stringify(data));
  location.reload();
}

// ---------- events ----------
const A = {
  tab: d => { S.ui.tab = d.v; U.sheet = null; scrollTo(0, 0); },
  go: d => { S.ui.tab = d.v; if (d.s) S.ui[d.s] = d.sv; scrollTo(0, 0); },
  seg: d => { S.ui[d.k] = d.v; },
  open: d => { U.sheet = [d.k, d.id]; U.anim = true; },
  close: () => { U.sheet = null; },
  toggleTask: d => { const x = task(d.id); x.done = !x.done; },
  delTask: d => { if (confirm('این کار حذف بشه؟')) { S.tasks = S.tasks.filter(x => x.id !== d.id); U.sheet = null; } },
  clearDate: d => { const x = task(d.id) || goal(d.id); x.date = x.time = undefined; },
  showDone: () => { U.showDone = !U.showDone; },
  clearDone: () => { if (confirm('همهٔ کارهای انجام‌شده پاک بشن؟')) S.tasks = S.tasks.filter(x => !x.done); },
  delGoal: d => { if (confirm('این هدف حذف بشه؟')) { S.goals = S.goals.filter(g => g.id !== d.id); U.sheet = null; } },
  step: d => { const s = goal(d.id).steps[d.i]; s.done = !s.done; },
  delStep: d => { goal(d.id).steps.splice(d.i, 1); },
  sel: d => { U.sel = d.d; },
  month: d => { const m = monthDays(U.calM); U.calM = d.n < 0 ? add(m[0], -1) : add(m.at(-1), 1); },
  calToday: () => { U.calM = U.sel = today(); },
  calT: d => { S.ui.cal[d.k] = !S.ui.cal[d.k]; },
  pill: d => { const l = S.pillLog[d.d] ??= {}; l[d.k] = !l[d.k]; },
  delPill: d => { if (confirm('این قرص حذف بشه؟')) { S.pills = S.pills.filter(p => p.id !== d.id); U.sheet = null; } },
  delTime: d => { const p = pill(d.id); p.times = p.times.filter(x => x !== d.t); },
  pStart: () => { if (!S.periods.some(p => p.start === today())) S.periods.push({ start: today() }); },
  pEnd: () => { periodInfo().last.end = today(); },
  delPeriod: d => { if (confirm('این مورد حذف بشه؟')) S.periods = S.periods.filter(p => p.start !== d.d); },
  mweek: d => { U.mw = add(U.mw, +d.n); },
  enablePush,
  copyCfg: async () => { const c = pushConfig(); await navigator.clipboard.writeText(c); S.copied = c; alert('کپی شد ✓'); },
  export: exportData,
};

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  await A[el.dataset.a](el.dataset);
  save(); render();
});

// field edits save quietly (no re-render) so iOS pickers/keyboards stay open
document.addEventListener('change', e => {
  const el = e.target, f = el.dataset.f;
  if (!f) return;
  if (f === 'import') return el.files[0] && importData(el.files[0]);
  if (f === 'morning') S.settings.morning = el.value || '08:00';
  else if (f === 'pname') { const p = pill(el.dataset.id); p.name = el.value.trim() || p.name; }
  else if (f === 'addPeriod') { if (el.value && !S.periods.some(p => p.start === el.value)) S.periods.push({ start: el.value }); }
  else if (f === 'pend') {
    const p = S.periods.find(p => p.start === el.dataset.d);
    p.end = el.value >= p.start ? el.value : undefined;
  } else {
    const x = task(el.dataset.id) || goal(el.dataset.id);
    x[f] = el.value.trim() || (f === 'title' ? x.title : undefined);
    if (!x.date) x.time = undefined;
  }
  save();
  if (el.type === 'date') render(); // refresh Jalali labels / reminder row
});

document.addEventListener('input', e => {
  const el = e.target;
  if (!el.dataset.meal) return;
  (S.meals[el.dataset.meal] ??= {})[el.dataset.k] = el.value;
  save();
});

document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, k = f.dataset.add, v = f.v.value.trim();
  if (!v) return;
  if (k === 'task') S.tasks.push({ id: uid(), title: v, date: f.dataset.d || undefined });
  if (k === 'goal') S.goals.push({ id: uid(), title: v, steps: [] });
  if (k === 'step') goal(f.dataset.id).steps.push({ t: v });
  if (k === 'pill') { const id = uid(); S.pills.push({ id, name: v, times: ['09:00'] }); U.sheet = ['pill', id]; U.anim = true; }
  if (k === 'time') { const p = pill(f.dataset.id); if (!p.times.includes(v)) p.times = [...p.times, v].sort(); }
  save(); render();
  if (['task', 'goal', 'step'].includes(k)) // keep keyboard up for rapid entry
    document.querySelector(`form[data-add="${k}"]${f.dataset.id ? `[data-id="${f.dataset.id}"]` : ''} input`)?.focus();
});

// ---------- render ----------
const TABS = [['overview', 'home', 'خلاصه'], ['tasks', 'list', 'کارها'], ['calendar', 'cal', 'تقویم'], ['health', 'heart', 'سلامت'], ['meals', 'fork', 'غذا']];
const VIEWS = { overview, tasks: tasksTab, calendar: calendarTab, health: healthTab, meals: mealsTab };
function render() {
  document.getElementById('main').innerHTML = VIEWS[S.ui.tab]();
  document.getElementById('nav').innerHTML = TABS.map(([k, i, l]) => `<button class="${S.ui.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}">${ic(i)}<span>${l}</span></button>`).join('');
  document.getElementById('sheet').innerHTML = sheet();
  document.documentElement.classList.toggle('lock', !!U.sheet);
  U.anim = false; // slide-up only on open, not on re-renders inside the sheet
}

// first open of the day lands on the overview
const wake = () => {
  if (S.lastOpen !== today()) { S.ui.tab = 'overview'; S.ui.scope = 'day'; S.lastOpen = today(); U.calM = U.sel = U.mw = undefined; save(); }
  render();
};
wake();
document.addEventListener('visibilitychange', () => document.hidden || wake());
navigator.serviceWorker?.register('sw.js');
navigator.storage?.persist?.();
