// ConvertSports: the conversion model.
//
// Every performance is turned into one shared score S (shown as points, S × 1000),
// then the score is turned back into a performance in the other disciplines.
//
// 1. Age: the performance is age-graded to an open-class equivalent per discipline.
// 2. Body weight: the bench press is scored relative to body weight (DOTS formula).
//    Sex: times are scored against a sex-specific world-class reference, the bench
//    press through the sex-specific DOTS polynomial.
// 3. Score: times use S = (reference / time)^k, the bench press is linear in DOTS.
//
// The scale is calibrated on one anchor: a man, 25 years, 80 kg body weight, for whom
// 120 kg bench press = 56.5 s 100 m freestyle (long course) = 1:12 100 m breaststroke
// (long course) = 11.2 s 100 m sprint. Everything else follows from the formulas.
// It is an estimate for fun and comparison, not a competition standard.

export const LB_PER_KG = 2.2046226218;

/** The calibration anchor. Change these to re-tune the whole scale. */
export const ANCHOR = Object.freeze({
  sex: 'm',
  age: 25,
  bodyweight: 80,
  bench: 120,
  free: 56.5,
  breast: 72,
  sprint: 11.2,
});

// DOTS coefficients (a·x⁴ + b·x³ + c·x² + d·x + e), body weight in kg.
const DOTS = {
  m: { coef: [-0.000001093, 0.0007391293, -0.1918759221, 24.0900756, -307.75076], range: [40, 210] },
  f: { coef: [-0.0000010706, 0.0005158568, -0.1126655495, 13.6175032, -57.96288], range: [40, 150] },
};

/** Multiplier that turns a lift into its DOTS value: lift × dotsFactor. */
export function dotsFactor(bodyweight, sex) {
  const { coef, range } = DOTS[sex];
  const x = clamp(bodyweight, range[0], range[1]);
  const [a, b, c, d, e] = coef;
  return 500 / (a * x ** 4 + b * x ** 3 + c * x ** 2 + d * x + e);
}

// Age grading: 1 inside the peak years, losing a share per year before and after.
const AGE_CURVES = {
  strength: { peak: [23, 38], youth: 0.05, decline: 0.01 },
  swim: { peak: [19, 27], youth: 0.04, decline: 0.008 },
  sprint: { peak: [20, 29], youth: 0.04, decline: 0.009 },
};

export function ageFactor(curve, age) {
  const { peak, youth, decline } = AGE_CURVES[curve];
  let f = 1;
  if (age < peak[0]) f = (1 - youth) ** (peak[0] - age);
  else if (age > peak[1]) f = (1 - decline) ** (age - peak[1]);
  return Math.max(f, 0.25);
}

export const DISCIPLINES = Object.freeze({
  bench: {
    id: 'bench',
    name: 'Bankdrücken',
    sport: 'Gym',
    detail: 'Maximalgewicht, eine Wiederholung',
    kind: 'load',
    curve: 'strength',
    range: [5, 400], // kg
  },
  free: {
    id: 'free',
    name: '100 m Kraul',
    sport: 'Schwimmen',
    detail: 'Langbahn, 50-m-Becken',
    kind: 'time',
    curve: 'swim',
    reference: { m: 46.4, f: 51.71 },
    range: [40, 600],
  },
  breast: {
    id: 'breast',
    name: '100 m Brust',
    sport: 'Schwimmen',
    detail: 'Langbahn, 50-m-Becken',
    kind: 'time',
    curve: 'swim',
    reference: { m: 56.88, f: 64.13 },
    range: [50, 600],
  },
  sprint: {
    id: 'sprint',
    name: '100 m Sprint',
    sport: 'Leichtathletik',
    detail: 'Laufbahn, ohne Rückenwind',
    kind: 'time',
    curve: 'sprint',
    reference: { m: 9.58, f: 10.49 },
    range: [9, 60],
  },
});

export const ORDER = ['bench', 'free', 'breast', 'sprint'];

// ---- Calibration -----------------------------------------------------------
// Freestyle sets the anchor score with the classic cubic exponent; the other
// timed events get the exponent that puts their anchor time on the same score;
// the bench press gets the DOTS value that equals score 1.

const FREE_EXPONENT = 3;
const ANCHOR_SCORE = (DISCIPLINES.free.reference.m / ANCHOR.free) ** FREE_EXPONENT;

const EXPONENT = {
  free: FREE_EXPONENT,
  breast: Math.log(ANCHOR_SCORE) / Math.log(DISCIPLINES.breast.reference.m / ANCHOR.breast),
  sprint: Math.log(ANCHOR_SCORE) / Math.log(DISCIPLINES.sprint.reference.m / ANCHOR.sprint),
};

const DOTS_AT_SCORE_ONE = (ANCHOR.bench * dotsFactor(ANCHOR.bodyweight, ANCHOR.sex)) / ANCHOR_SCORE;

// ---- Score ------------------------------------------------------------------

/**
 * @param {string} id discipline id
 * @param {number} value kg for the bench press, seconds for timed events
 * @param {{sex: 'm'|'f', age: number, bodyweight: number}} athlete
 * @returns {number} score, 1 = world class
 */
export function toScore(id, value, athlete) {
  const d = DISCIPLINES[id];
  const f = ageFactor(d.curve, athlete.age);
  if (d.kind === 'load') {
    const openLoad = value / f;
    return (openLoad * dotsFactor(athlete.bodyweight, athlete.sex)) / DOTS_AT_SCORE_ONE;
  }
  const openTime = value * f;
  return (d.reference[athlete.sex] / openTime) ** EXPONENT[id];
}

/** Inverse of toScore. Returns kg or seconds. */
export function fromScore(id, score, athlete) {
  const d = DISCIPLINES[id];
  const f = ageFactor(d.curve, athlete.age);
  if (d.kind === 'load') {
    const openLoad = (score * DOTS_AT_SCORE_ONE) / dotsFactor(athlete.bodyweight, athlete.sex);
    return openLoad * f;
  }
  const openTime = d.reference[athlete.sex] / score ** (1 / EXPONENT[id]);
  return openTime / f;
}

/** Converts one performance into all disciplines. */
export function convert(id, value, athlete) {
  const score = toScore(id, value, athlete);
  const results = ORDER.map((key) => ({
    id: key,
    value: key === id ? value : fromScore(key, score, athlete),
    source: key === id,
  }));
  return { score, points: Math.round(score * 1000), results };
}

export const LEVELS = [
  { min: 0, name: 'Einsteiger' },
  { min: 300, name: 'Hobby' },
  { min: 450, name: 'Ambitioniert' },
  { min: 600, name: 'Leistungssport' },
  { min: 750, name: 'National' },
  { min: 900, name: 'Weltklasse' },
];

export function levelFor(points) {
  let level = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) level = l;
  return level.name;
}

// ---- Input and output ------------------------------------------------------

/**
 * Reads a time the way swimmers and sprinters write it:
 * "56,5", "56.50", "1:12", "1:12,00". For swimming, "1,12" reads as 1:12.
 * @returns {{seconds: number, reinterpreted: boolean} | null}
 */
export function parseTime(raw, id) {
  const s = String(raw).trim().replace(/\s+/g, '').replace(/s$/i, '');
  if (!s) return null;
  let m = s.match(/^(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (m) {
    const sec = Number(`${m[2]}.${m[3] ?? 0}`);
    if (sec >= 60) return null;
    return { seconds: Number(m[1]) * 60 + sec, reinterpreted: false };
  }
  m = s.match(/^(\d{1,3})(?:[.,](\d{1,3}))?$/);
  if (!m) return null;
  const seconds = Number(`${m[1]}.${m[2] ?? 0}`);
  const isSwim = DISCIPLINES[id]?.curve === 'swim';
  // "1,12" for a 100 m swim cannot be seconds; swimmers mean 1:12.
  if (isSwim && seconds < 20 && m[2] && m[2].length === 2 && Number(m[2]) < 60) {
    return { seconds: Number(m[1]) * 60 + Number(m[2]), reinterpreted: true };
  }
  return { seconds, reinterpreted: false };
}

export function parseNumber(raw) {
  const s = String(raw).trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** 72 → "1:12,00", 56.5 → "56,50" */
export function formatTime(seconds) {
  const hundredths = Math.round(seconds * 100);
  const min = Math.floor(hundredths / 6000);
  const rest = (hundredths - min * 6000) / 100;
  const sec = rest.toFixed(2).replace('.', ',');
  return min > 0 ? `${min}:${sec.padStart(5, '0')}` : sec;
}

/** kg → display number in the chosen unit, rounded to the plate step. */
export function formatLoad(kg, unit) {
  if (unit === 'lb') return String(Math.round(kg * LB_PER_KG));
  const rounded = Math.round(kg * 2) / 2;
  return rounded.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}
