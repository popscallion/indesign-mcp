import { expect, test } from '@jest/globals';
import { toPoints } from '../src/utils/coords.js';

test('percentage converts correctly', () => {
  expect(toPoints('50%', 'x', 200, 400)).toBe(100);
  expect(toPoints('25%', 'y', 200, 400)).toBe(100);
});

test('center keyword converts correctly', () => {
  expect(toPoints('center', 'x', 300, 600)).toBe(150);
  expect(toPoints('center', 'y', 300, 600)).toBe(300);
}); 