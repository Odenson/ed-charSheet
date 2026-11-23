import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayLocal } from './today.js';

test('todayLocal formats the local calendar date as YYYY-MM-DD, zero-padded', () => {
  assert.equal(todayLocal(new Date(2026, 0, 5, 9, 30)), '2026-01-05');
  assert.equal(todayLocal(new Date(2026, 10, 23, 23, 59)), '2026-11-23');
});

test('todayLocal uses local time, not UTC (late evening stays the same day)', () => {
  assert.equal(todayLocal(new Date(2026, 5, 30, 23, 30)), '2026-06-30');
  assert.equal(todayLocal(new Date(2026, 5, 30, 0, 5)), '2026-06-30');
});
