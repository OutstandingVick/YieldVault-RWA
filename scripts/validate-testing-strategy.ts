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
];

const REQUIRED_LAYER_HEADINGS = ['### Unit', '### Integration', '### E2E'];

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

  if (!markdownContent.includes('Playwright')) {
    errors.push('Testing strategy doc must reference Playwright for browser E2E coverage.');
  }

  if (!markdownContent.includes('npm run test:e2e')) {
    errors.push('Testing strategy doc must include the E2E command for browser journeys.');
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
