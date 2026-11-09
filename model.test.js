import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANCHOR, convert, toScore, fromScore, parseTime, formatTime, formatLoad, levelFor, ageFactor,
} from './model.js';

const anchor = { sex: ANCHOR.sex, age: ANCHOR.age, bodyweight: ANCHOR.bodyweight };
const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('the anchor performances all land on the same score', () => {
  const s = toScore('bench', 120, anchor);
  close(toScore('free', 56.5, anchor), s, 1e-9);
  close(toScore('breast', 72, anchor), s, 1e-9);
  close(toScore('sprint', 11.2, anchor), s, 1e-9);
});

test('120 kg bench converts to 56.5 / 1:12 / 11.2', () => {
  const { results, points } = convert('bench', 120, anchor);
  const by = Object.fromEntries(results.map((r) => [r.id, r.value]));
  close(by.free, 56.5);
  close(by.breast, 72);
  close(by.sprint, 11.2);
  assert.equal(points, 554);
  assert.equal(levelFor(points), 'Ambitioniert');
});

test('fromScore inverts toScore for every discipline and athlete', () => {
  for (const athlete of [anchor, { sex: 'f', age: 41, bodyweight: 63 }, { sex: 'm', age: 16, bodyweight: 105 }]) {
    for (const [id, v] of [['bench', 90], ['free', 70], ['breast', 85], ['sprint', 13]]) {
      close(fromScore(id, toScore(id, v, athlete), athlete), v, 1e-6);
    }
  }
});

test('stronger means faster, heavier body weight means slower for the same lift', () => {
  const a = convert('bench', 140, anchor).results.find((r) => r.id === 'free').value;
  assert.ok(a < 56.5);
  const heavy = convert('bench', 120, { ...anchor, bodyweight: 110 }).results.find((r) => r.id === 'free').value;
  assert.ok(heavy > 56.5);
});

test('age grading is 1 at peak and lower outside it', () => {
  assert.equal(ageFactor('swim', 25), 1);
  assert.ok(ageFactor('swim', 50) < 1);
  assert.ok(ageFactor('strength', 14) < 1);
});

test('parseTime reads the common notations', () => {
  assert.deepEqual(parseTime('56,5', 'free'), { seconds: 56.5, reinterpreted: false });
  assert.deepEqual(parseTime('1:12', 'breast'), { seconds: 72, reinterpreted: false });
  assert.deepEqual(parseTime('1:12,00', 'breast'), { seconds: 72, reinterpreted: false });
  assert.deepEqual(parseTime('1,12', 'breast'), { seconds: 72, reinterpreted: true });
  assert.deepEqual(parseTime('11,2', 'sprint'), { seconds: 11.2, reinterpreted: false });
  assert.deepEqual(parseTime('11.20 s', 'sprint'), { seconds: 11.2, reinterpreted: false });
  assert.equal(parseTime('1:75', 'free'), null);
  assert.equal(parseTime('schnell', 'free'), null);
});

test('formatting', () => {
  assert.equal(formatTime(72), '1:12,00');
  assert.equal(formatTime(56.5), '56,50');
  assert.equal(formatTime(65.004), '1:05,00');
  assert.equal(formatLoad(122.4, 'kg'), '122,5');
  assert.equal(formatLoad(120, 'lb'), '265');
});
