import {
  DISCIPLINES, ORDER, LB_PER_KG, convert, parseTime, parseNumber, formatTime, formatLoad,
} from './model.js?v=202611092336';

const STEPS = ['age', 'weight', 'sex', 'sport', 'value', 'result'];
const INPUT_STEPS = STEPS.length - 1;

const form = document.getElementById('wizard');
const $ = (id) => document.getElementById(id);
const sections = Object.fromEntries(STEPS.map((s) => [s, form.querySelector(`[data-step="${s}"]`)]));

const QUESTION = {
  bench: { q: 'Wie viel drückst du?', placeholder: '120', hint: 'Dein Maximalgewicht für eine Wiederholung.' },
  free: { q: 'Deine Zeit über 100 m Kraul?', placeholder: '56,5', hint: 'Langbahn, zum Beispiel 56,5 oder 1:02,30.' },
  breast: { q: 'Deine Zeit über 100 m Brust?', placeholder: '1:12', hint: 'Langbahn, zum Beispiel 1:12 oder 1:12,00.' },
  sprint: { q: 'Deine Zeit über 100 m Sprint?', placeholder: '11,2', hint: 'Zum Beispiel 11,2 oder 11,20.' },
};

const radio = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value;
const unit = () => radio('unit') ?? 'kg';
const unitLabel = () => (unit() === 'lb' ? 'lbs' : 'kg');

let current = 'age';

// ---- Navigation ------------------------------------------------------------

function show(step, { push = true } = {}) {
  current = step;
  for (const [name, el] of Object.entries(sections)) el.hidden = name !== step;

  const i = STEPS.indexOf(step);
  $('progress').hidden = false;
  $('back').hidden = i === 0;
  $('progress-fill').style.transform = `scaleX(${Math.min(i + 1, INPUT_STEPS) / INPUT_STEPS})`;
  $('progress-text').textContent = step === 'result' ? 'Ergebnis' : `Schritt ${i + 1} von ${INPUT_STEPS}`;

  if (step === 'value') prepareValueStep();
  if (step === 'result') renderResult();

  if (push) history.pushState({ step }, '', `#${step}`);

  const input = sections[step].querySelector('input:not([type="radio"])');
  const checked = sections[step].querySelector('input[type="radio"]:checked');
  if (input) input.focus({ preventScroll: true });
  else if (checked) checked.focus({ preventScroll: true });
  else sections[step].querySelector('h1').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function next() {
  if (!validate(current)) return;
  show(STEPS[STEPS.indexOf(current) + 1]);
}

function back() {
  const i = STEPS.indexOf(current);
  if (i > 0) show(STEPS[i - 1]);
}

// ---- Validation --------------------------------------------------------------

function fail(input, help, message) {
  input.setAttribute('aria-invalid', 'true');
  help.textContent = message;
  help.classList.add('help--error');
  input.focus();
  return false;
}

function clear(input, help, text = '') {
  input.removeAttribute('aria-invalid');
  help.textContent = text;
  help.classList.remove('help--error');
}

function readAge() {
  const n = Number($('age').value.trim());
  return Number.isInteger(n) && n >= 10 && n <= 100 ? n : null;
}

function readBodyweightKg() {
  const n = parseNumber($('bodyweight').value);
  if (n == null) return null;
  const kg = unit() === 'lb' ? n / LB_PER_KG : n;
  return kg >= 30 && kg <= 250 ? kg : null;
}

function readValue() {
  const id = radio('from');
  const d = DISCIPLINES[id];
  const raw = $('value').value;
  if (d.kind === 'load') {
    const n = parseNumber(raw);
    if (n == null) return { error: `Schreib nur die Zahl, zum Beispiel ${unit() === 'lb' ? '265' : '120'}.` };
    const kg = unit() === 'lb' ? n / LB_PER_KG : n;
    if (kg < d.range[0] || kg > d.range[1]) {
      return { error: `Bitte zwischen ${formatLoad(d.range[0], unit())} und ${formatLoad(d.range[1], unit())} ${unitLabel()}.` };
    }
    return { value: kg };
  }
  const t = parseTime(raw, id);
  if (!t) return { error: `So lesen wir die Zeit nicht. ${QUESTION[id].hint}` };
  if (t.seconds < d.range[0] || t.seconds > d.range[1]) {
    return { error: `Bitte eine Zeit zwischen ${formatTime(d.range[0])} und ${formatTime(d.range[1])}.` };
  }
  return { value: t.seconds, reinterpreted: t.reinterpreted };
}

function validate(step) {
  if (step === 'age') {
    if (readAge() == null) return fail($('age'), $('age-help'), 'Gib ein Alter zwischen 10 und 100 ein.');
    clear($('age'), $('age-help'));
  }
  if (step === 'weight') {
    if (readBodyweightKg() == null) {
      return fail($('bodyweight'), $('bodyweight-help'), `Gib dein Gewicht in ${unitLabel()} ein, zum Beispiel ${unit() === 'lb' ? '176' : '80'}.`);
    }
    clear($('bodyweight'), $('bodyweight-help'));
  }
  if (step === 'value') {
    const r = readValue();
    if (r.error) return fail($('value'), $('value-help'), r.error);
    clear($('value'), $('value-help'));
  }
  return true;
}

// ---- Steps -----------------------------------------------------------------

function prepareValueStep() {
  const id = radio('from');
  const d = DISCIPLINES[id];
  const q = QUESTION[id];
  $('q-value').textContent = q.q;
  $('value').placeholder = d.kind === 'load' && unit() === 'lb' ? '265' : q.placeholder;
  $('value-unit').textContent = d.kind === 'load' ? unitLabel() : id === 'sprint' ? 's' : '';
  if (!$('value').hasAttribute('aria-invalid')) $('value-help').textContent = q.hint;
}

function formatResult(id, v) {
  if (DISCIPLINES[id].kind === 'load') return { figure: formatLoad(v, unit()), unit: unitLabel() };
  return { figure: formatTime(v), unit: v < 60 ? 's' : 'min' };
}

function renderResult() {
  const from = radio('from');
  const { value } = readValue();
  const athlete = { sex: radio('sex'), age: readAge(), bodyweight: readBodyweightKg() };
  const { results } = convert(from, value, athlete);

  const mine = formatResult(from, value);
  const where = DISCIPLINES[from].kind === 'load' ? `im ${DISCIPLINES[from].name}` : `über ${DISCIPLINES[from].name}`;
  $('q-result').textContent = `Deine ${mine.figure} ${mine.unit} ${where} entsprechen`;

  $('results').innerHTML = results.filter((r) => !r.source).map((r) => {
    const d = DISCIPLINES[r.id];
    const f = formatResult(r.id, r.value);
    const picto = document.querySelector(`[data-picto="${r.id}"]`).outerHTML;
    return `<li class="result">
      ${picto}
      <span class="result__name">${d.name}<span class="result__detail">${d.detail}</span></span>
      <span class="result__value"><span class="result__figure">${f.figure}</span> <span class="result__unit">${f.unit}</span></span>
    </li>`;
  }).join('');
}

// ---- Events ----------------------------------------------------------------

form.addEventListener('submit', (e) => { e.preventDefault(); next(); });

form.addEventListener('change', (e) => {
  const t = e.target;
  if (t.name === 'sex' || t.name === 'from') {
    if (t.name === 'from') { $('value').value = ''; clear($('value'), $('value-help')); }
    show(t.name === 'sex' ? 'sport' : 'value');
  }
  if (t.name === 'unit') {
    document.querySelectorAll('[data-unit-label]').forEach((n) => { n.textContent = unitLabel(); });
    const n = parseNumber($('bodyweight').value);
    if (n != null) $('bodyweight').value = String(Math.round(unit() === 'lb' ? n * LB_PER_KG : n / LB_PER_KG));
    $('bodyweight').placeholder = unit() === 'lb' ? '176' : '80';
    $('bodyweight').focus();
  }
});

// A click on an already chosen option still moves on.
form.addEventListener('click', (e) => {
  const label = e.target.closest('label.choice');
  if (!label) return;
  const input = $(label.htmlFor);
  if (input.checked) { e.preventDefault(); show(input.name === 'sex' ? 'sport' : 'value'); }
});

form.addEventListener('input', (e) => {
  if (e.target.hasAttribute('aria-invalid')) {
    e.target.removeAttribute('aria-invalid');
    const help = $(e.target.getAttribute('aria-describedby'));
    help.classList.remove('help--error');
    help.textContent = e.target.id === 'value' ? QUESTION[radio('from')].hint : '';
  }
});

$('back').addEventListener('click', () => history.back());
$('other-sport').addEventListener('click', () => show('sport'));
$('restart').addEventListener('click', () => {
  form.reset();
  for (const id of ['age', 'bodyweight', 'value']) $(id).removeAttribute('aria-invalid');
  document.querySelectorAll('[data-unit-label]').forEach((n) => { n.textContent = 'kg'; });
  show('age');
});

window.addEventListener('popstate', (e) => {
  const step = e.state?.step;
  if (!step) return show('age', { push: false });
  // Never land on a step whose earlier answers are missing.
  for (const s of STEPS.slice(0, STEPS.indexOf(step))) {
    if ((s === 'age' && readAge() == null) || (s === 'weight' && readBodyweightKg() == null)
      || (s === 'sex' && !radio('sex')) || (s === 'sport' && !radio('from'))
      || (s === 'value' && readValue().error)) return show(s, { push: false });
  }
  show(step, { push: false });
});

history.replaceState({ step: 'age' }, '', location.pathname + location.search);
show('age', { push: false });
