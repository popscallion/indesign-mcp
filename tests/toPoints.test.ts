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

test('plain numbers pass through unchanged', () => {
  expect(toPoints(100, 'x', 200, 400)).toBe(100);
  expect(toPoints('72', 'y', 200, 400)).toBe(72);
});

test('throws error for unsupported values', () => {
  expect(() => toPoints('10mm', 'x', 200, 400)).toThrow('Unsupported coordinate value: 10mm');
  expect(() => toPoints('1in', 'y', 200, 400)).toThrow('Unsupported coordinate value: 1in');
  expect(() => toPoints('invalid', 'x', 200, 400)).toThrow('Unsupported coordinate value: invalid');
}); 