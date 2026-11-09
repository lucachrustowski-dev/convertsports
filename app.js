import {
  DISCIPLINES, ORDER, LB_PER_KG, convert, levelFor, parseTime, parseNumber, formatTime, formatLoad,
} from './model.js';

const form = document.getElementById('converter');
const $ = (id) => document.getElementById(id);
const els = {
  age: $('age'), bodyweight: $('bodyweight'), value: $('value'),
  ageHelp: $('age-help'), bwHelp: $('bodyweight-help'), valueHelp: $('value-help'),
  valueLabel: $('value-label'), valueUnit: $('value-unit'),
  score: $('score'), points: $('score-points'), level: $('score-level'),
  body: $('results-body'),
};

const COPY = {
  bench: { label: 'Maximalgewicht im Bankdrücken', hint: 'Eine saubere Wiederholung, Gewicht inklusive Stange.' },
  free: { label: 'Deine Zeit über 100 m Kraul', hint: 'Schreib die Zeit als 56,5 oder 1:02,30.' },
  breast: { label: 'Deine Zeit über 100 m Brust', hint: 'Schreib die Zeit als 1:12 oder 1:12,00.' },
  sprint: { label: 'Deine Zeit über 100 m Sprint', hint: 'Schreib die Zeit als 11,2 oder 11,20.' },
};

const picto = (id) => document.querySelector(`label[for="from-${id}"] .picto`)?.outerHTML ?? '';
const radio = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value;

let lastUnit = radio('unit');
let lastFrom = radio('from');

function readState() {
  return {
    age: els.age.value.trim(),
    bodyweight: els.bodyweight.value.trim(),
    sex: radio('sex'),
    unit: radio('unit'),
    from: radio('from'),
    value: els.value.value.trim(),
  };
}

function setInvalid(input, help, message) {
  input.toggleAttribute('aria-invalid', Boolean(message));
  if (message) help.textContent = message;
  return !message;
}

function formatValue(id, v, unit) {
  return DISCIPLINES[id].kind === 'load' ? formatLoad(v, unit) : formatTime(v);
}

function unitFor(id, unit, value) {
  if (DISCIPLINES[id].kind === 'load') return unit === 'lb' ? 'lbs' : 'kg';
  return value < 60 ? 's' : '';
}

function renderEmpty(message, isError = false) {
  els.score.hidden = true;
  els.body.innerHTML = `<tr><td colspan="2" class="results__state${isError ? ' results__state--error' : ''}">${message}</td></tr>`;
}

function render() {
  const s = readState();
  const d = DISCIPLINES[s.from];
  const unitLabel = s.unit === 'lb' ? 'lbs' : 'kg';
  document.querySelectorAll('[data-unit-label]').forEach((n) => { n.textContent = unitLabel; });
  els.valueLabel.textContent = COPY[s.from].label;
  els.valueUnit.textContent = d.kind === 'load' ? unitLabel : s.from === 'sprint' ? 's' : '';

  // Profile
  const age = Number(s.age);
  const ageOk = setInvalid(els.age, els.ageHelp,
    !s.age || !Number.isFinite(age) || age < 10 || age > 100 ? 'Gib ein Alter zwischen 10 und 100 ein.' : '');
  if (ageOk) els.ageHelp.textContent = '';

  const bwRaw = parseNumber(s.bodyweight);
  const bwKg = bwRaw == null ? null : s.unit === 'lb' ? bwRaw / LB_PER_KG : bwRaw;
  const bwOk = setInvalid(els.bodyweight, els.bwHelp,
    bwKg == null || bwKg < 30 || bwKg > 250
      ? `Gib dein Gewicht in ${unitLabel} ein, zum Beispiel ${s.unit === 'lb' ? '176' : '80'}.` : '');
  if (bwOk) els.bwHelp.textContent = '';

  // Performance
  let value = null;
  let hint = COPY[s.from].hint;
  let error = '';
  if (s.value) {
    if (d.kind === 'load') {
      const n = parseNumber(s.value);
      value = n == null ? null : s.unit === 'lb' ? n / LB_PER_KG : n;
      if (value == null) error = `Das lesen wir nicht als Gewicht. Schreib nur die Zahl, zum Beispiel ${s.unit === 'lb' ? '265' : '120'}.`;
    } else {
      const t = parseTime(s.value, s.from);
      value = t?.seconds ?? null;
      if (value == null) error = `So lesen wir die Zeit nicht. ${COPY[s.from].hint}`;
      else if (t.reinterpreted) hint = `Gelesen als ${formatTime(value)}.`;
    }
    if (value != null && (value < d.range[0] || value > d.range[1])) {
      error = d.kind === 'load'
        ? `Das liegt außerhalb dessen, was wir umrechnen: ${formatLoad(d.range[0], s.unit)} bis ${formatLoad(d.range[1], s.unit)} ${unitLabel}.`
        : `Das liegt außerhalb dessen, was wir umrechnen: ${formatTime(d.range[0])} bis ${formatTime(d.range[1])}.`;
      value = null;
    }
  }
  els.value.toggleAttribute('aria-invalid', Boolean(error));
  els.valueHelp.textContent = error || hint;
  els.valueHelp.classList.toggle('help--error', Boolean(error));

  writeUrl(s);

  if (!s.value) return renderEmpty('Trag deine Leistung ein, dann steht hier dein Gegenwert im Gym, im Wasser und auf der Bahn.');
  if (error) return renderEmpty('Noch kein Ergebnis: die Eingabe links passt nicht.', true);
  if (!ageOk || !bwOk) return renderEmpty('Noch kein Ergebnis: prüf Alter und Gewicht oben.', true);

  const athlete = { sex: s.sex, age, bodyweight: bwKg };
  const { points, results } = convert(s.from, value, athlete);
  els.points.textContent = points.toLocaleString('de-DE');
  els.level.textContent = levelFor(points);
  els.score.hidden = false;

  els.body.innerHTML = results.map((r) => {
    const dd = DISCIPLINES[r.id];
    return `<tr class="${r.source ? 'is-source' : ''}">
      <th scope="row">
        <span class="row-sport">${picto(r.id)}<span><span class="row-sport__name">${dd.name}</span><span class="row-sport__meta">${r.source ? 'Deine Eingabe' : dd.detail}</span></span></span>
      </th>
      <td class="num"><span class="time">${formatValue(r.id, r.value, s.unit)}</span> <span class="time-unit">${unitFor(r.id, s.unit, r.value)}</span></td>
    </tr>`;
  }).join('');
}

// Keep the numbers when the unit flips, and clear the value when the discipline changes.
function onChange(e) {
  const s = readState();
  if (e.target.name === 'unit' && s.unit !== lastUnit) {
    const factor = s.unit === 'lb' ? LB_PER_KG : 1 / LB_PER_KG;
    const bw = parseNumber(s.bodyweight);
    if (bw != null) els.bodyweight.value = String(Math.round(bw * factor));
    if (DISCIPLINES[s.from].kind === 'load') {
      const v = parseNumber(s.value);
      if (v != null) els.value.value = formatLoad(s.unit === 'lb' ? v : v / LB_PER_KG, s.unit);
    }
    lastUnit = s.unit;
  }
  if (e.target.name === 'from' && s.from !== lastFrom) {
    // Carry the current equivalent over, so switching discipline keeps your level.
    const row = [...els.body.querySelectorAll('tr')][ORDER.indexOf(s.from)];
    const carried = row?.querySelector('.time')?.textContent;
    els.value.value = carried ?? '';
    lastFrom = s.from;
  }
  render();
}

// ---- URL state -------------------------------------------------------------

function writeUrl(s) {
  const p = new URLSearchParams({ from: s.from, v: s.value, age: s.age, bw: s.bodyweight, sex: s.sex, unit: s.unit });
  history.replaceState(null, '', `?${p}`);
}

function readUrl() {
  const p = new URLSearchParams(location.search);
  const check = (name, v) => {
    const el = form.querySelector(`input[name="${name}"][value="${CSS.escape(v)}"]`);
    if (el) el.checked = true;
  };
  if (p.has('sex')) check('sex', p.get('sex'));
  if (p.has('unit')) check('unit', p.get('unit'));
  if (p.has('from') && ORDER.includes(p.get('from'))) check('from', p.get('from'));
  if (p.has('age')) els.age.value = p.get('age');
  if (p.has('bw')) els.bodyweight.value = p.get('bw');
  if (p.has('v')) els.value.value = p.get('v');
  lastUnit = radio('unit');
  lastFrom = radio('from');
}

form.addEventListener('submit', (e) => e.preventDefault());
form.addEventListener('input', (e) => { if (e.target.type !== 'radio') render(); });
form.addEventListener('change', (e) => { if (e.target.type === 'radio') onChange(e); });

readUrl();
render();
