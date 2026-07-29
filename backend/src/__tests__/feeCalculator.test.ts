// src/__tests__/feeCalculator.test.ts
import { getDeterministicBaseFee } from '../feeCalculator';

describe('getDeterministicBaseFee', () => {
  const originalEnv = process.env.FIXED_BASE_FEE;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.FIXED_BASE_FEE = originalEnv;
    } else {
      delete process.env.FIXED_BASE_FEE;
    }
  });

  test('returns default when env not set', () => {
    delete process.env.FIXED_BASE_FEE;
    expect(getDeterministicBaseFee()).toBe('100');
  });

  test('returns env value when set', () => {
    process.env.FIXED_BASE_FEE = '250';
    expect(getDeterministicBaseFee()).toBe('250');
  });

  test('throws on invalid env value', () => {
    process.env.FIXED_BASE_FEE = 'abc';
    expect(() => getDeterministicBaseFee()).toThrow('FIXED_BASE_FEE must be a positive integer string');
  });
});
