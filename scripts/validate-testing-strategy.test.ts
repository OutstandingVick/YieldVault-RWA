import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runFullTestingStrategyValidation, validateTestingStrategyDoc } from './validate-testing-strategy';

describe('testing strategy validator', () => {
  it('accepts a testing strategy document with required sections', () => {
    const markdown = `
# YieldVault-RWA Testing Strategy

## Principles
- Keep tests close to the code they validate.

## Test Layers
| Layer | Purpose | Owned by | Typical locations | Primary commands |
| --- | --- | --- | --- | --- |
| Unit | Local logic | Owner | src/**/*.test.ts | npm test |

## Ownership Rules
- Frontend tests are owned by the UI team.

## Fixture Strategy
- Keep fixtures local to the suite.

## Coverage Expectations By Feature Type
| Feature type | Required coverage |
| --- | --- |
| Utility | Unit tests |

## What Belongs In Each Layer
### Unit
Use unit tests for deterministic logic.

### Integration
Use integration tests for cross-module behavior.

### E2E
Use E2E tests for browser journeys.

## Recommended Commands
- npm run test
- npm run test:e2e

## Review Checklist
- The test scope matches the behavior under change.

## Core Playwright User Flows
| Flow | Spec | What it proves |
| --- | --- | --- |
| Dashboard | dashboard-load.spec.ts | App loads correctly |

## Cypress Smoke Suite
Cypress smoke tests provide lightweight first-pass verification.

## Accessibility Testing
Accessibility tests use axe-core to audit rendered component trees.

## Security Testing
Security-focused tests validate defenses against common vulnerability classes.

## Load & Performance Testing
Load tests use k6 and target the staging backend.

## Fuzz & Property-Based Testing (Contracts)
Coverage-guided fuzz targets use cargo-fuzz. Property-based tests use proptest.

## CI Pipeline Integration
CI workflows run on every PR and on schedule.

## Coverage Thresholds
Coverage is enforced at the CI level.

## Tools & Frameworks Overview
| Tool | Layer(s) | Purpose |
| --- | --- | --- |
| Vitest | Frontend unit/integration | Component, hook, utility tests |
`;

    const result = validateTestingStrategyDoc(markdown);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a document that is missing required sections', () => {
    const result = validateTestingStrategyDoc('# YieldVault-RWA Testing Strategy\n\n## Principles\n');

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('Test Layers'))).toBe(true);
    expect(result.errors.some((error) => error.includes('Recommended Commands'))).toBe(true);
  });

  it('accepts the repository testing strategy document', () => {
    const docPath = resolve(__dirname, '../docs/TESTING_STRATEGY.md');
    expect(existsSync(docPath)).toBe(true);

    const markdown = readFileSync(docPath, 'utf8');
    const result = validateTestingStrategyDoc(markdown);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('passes the full repository validation for the testing strategy doc', () => {
    const rootDir = resolve(__dirname, '..');
    const result = runFullTestingStrategyValidation(rootDir);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
