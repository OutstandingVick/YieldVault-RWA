import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_SECTIONS = [
  '## Principles',
  '## Test Layers',
  '## Ownership Rules',
  '## Fixture Strategy',
  '## Coverage Expectations By Feature Type',
  '## What Belongs In Each Layer',
  '## Recommended Commands',
  '## Review Checklist',
  '## Core Playwright User Flows',
  '## Cypress Smoke Suite',
  '## Accessibility Testing',
  '## Security Testing',
  '## Load & Performance Testing',
  '## Fuzz & Property-Based Testing (Contracts)',
  '## CI Pipeline Integration',
  '## Coverage Thresholds',
  '## Tools & Frameworks Overview',
];

const REQUIRED_LAYER_HEADINGS = ['### Unit', '### Integration', '### E2E'];

const REQUIRED_REFERENCES = [
  { term: 'Playwright', message: 'Testing strategy doc must reference Playwright for browser E2E coverage.' },
  { term: 'npm run test:e2e', message: 'Testing strategy doc must include the E2E command for browser journeys.' },
  { term: 'axe-core', message: 'Testing strategy doc must reference axe-core for accessibility testing.' },
  { term: 'k6', message: 'Testing strategy doc must reference k6 for load testing.' },
  { term: 'proptest', message: 'Testing strategy doc must reference proptest for contract property-based testing.' },
  { term: 'cargo-fuzz', message: 'Testing strategy doc must reference cargo-fuzz for coverage-guided fuzzing.' },
  { term: 'Cypress', message: 'Testing strategy doc must reference Cypress for smoke testing.' },
];

export function validateTestingStrategyDoc(markdownContent: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!markdownContent || markdownContent.trim() === '') {
    errors.push('Testing strategy document cannot be empty.');
    return { valid: false, errors, warnings };
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!markdownContent.includes(section)) {
      errors.push(`Testing strategy doc is missing required section: "${section}"`);
    }
  }

  for (const heading of REQUIRED_LAYER_HEADINGS) {
    if (!markdownContent.includes(heading)) {
      errors.push(`Testing strategy doc is missing layer heading: "${heading}"`);
    }
  }

  for (const ref of REQUIRED_REFERENCES) {
    if (!markdownContent.includes(ref.term)) {
      errors.push(ref.message);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function runFullTestingStrategyValidation(rootDir: string = process.cwd()): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const docPath = resolve(rootDir, 'docs/TESTING_STRATEGY.md');
  if (!existsSync(docPath)) {
    errors.push('docs/TESTING_STRATEGY.md file does not exist.');
    return { valid: false, errors, warnings };
  }

  const result = validateTestingStrategyDoc(readFileSync(docPath, 'utf8'));
  errors.push(...result.errors);
  warnings.push(...result.warnings);

  return { valid: errors.length === 0, errors, warnings };
}

if (require.main === module) {
  const result = runFullTestingStrategyValidation();
  if (!result.valid) {
    console.error('❌ Testing strategy validation failed:');
    result.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('✅ Testing strategy validation passed successfully!');
  }
}
