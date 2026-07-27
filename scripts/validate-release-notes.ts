import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export const REQUIRED_RELEASE_NOTES_SECTIONS = [
  'Release Overview',
  'Security Highlights',
  'Performance Highlights',
  'Breaking Changes',
  'New Features',
  'Bug Fixes',
];

/**
 * Validates markdown structure of a release notes draft or template against standard sections.
 */
export function validateReleaseNotesContent(markdownContent: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!markdownContent || markdownContent.trim() === '') {
    errors.push('Release notes content cannot be empty.');
    return { valid: false, errors, warnings };
  }

  for (const section of REQUIRED_RELEASE_NOTES_SECTIONS) {
    if (!markdownContent.includes(section)) {
      errors.push(`Release notes is missing required section: "${section}"`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates Security Highlights section formatting and sign-offs.
 */
export function validateSecurityHighlights(markdownContent: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!markdownContent.includes('Security Highlights')) {
    errors.push('Security Highlights section is missing.');
    return { valid: false, errors, warnings };
  }

  const securityCheckpoints = [
    'Slither Static Analysis',
    'Dependency Audit',
    'Secret Scanning',
  ];

  for (const checkpoint of securityCheckpoints) {
    if (!markdownContent.includes(checkpoint)) {
      warnings.push(`Security Highlights is missing recommended checkpoint: "${checkpoint}"`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates Performance Highlights section formatting and metrics.
 */
export function validatePerformanceHighlights(markdownContent: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!markdownContent.includes('Performance Highlights')) {
    errors.push('Performance Highlights section is missing.');
    return { valid: false, errors, warnings };
  }

  const performanceTerms = ['Gas', 'Latency', 'Benchmark', 'Throughput', 'Optimization'];
  const hasPerfTerm = performanceTerms.some((term) =>
    markdownContent.toLowerCase().includes(term.toLowerCase())
  );

  if (!hasPerfTerm) {
    warnings.push('Performance Highlights section should mention measurable metrics (Gas, Latency, Throughput).');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates cliff.toml configuration for security and performance groups.
 */
export function validateCliffConfig(tomlContent: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!tomlContent || tomlContent.trim() === '') {
    errors.push('cliff.toml content cannot be empty.');
    return { valid: false, errors, warnings };
  }

  if (!tomlContent.includes('Security Highlights')) {
    errors.push('cliff.toml is missing group parser for "Security Highlights".');
  }

  if (!tomlContent.includes('Performance Highlights')) {
    errors.push('cliff.toml is missing group parser for "Performance Highlights".');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * CLI Runner for full repository release notes validation.
 */
export function runFullReleaseNotesValidation(rootDir: string = process.cwd()): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  const templatePath = resolve(rootDir, '.github/RELEASE_NOTES_TEMPLATE.md');
  if (!existsSync(templatePath)) {
    allErrors.push('.github/RELEASE_NOTES_TEMPLATE.md file does not exist.');
  } else {
    const content = readFileSync(templatePath, 'utf8');
    const resContent = validateReleaseNotesContent(content);
    allErrors.push(...resContent.errors);
    allWarnings.push(...resContent.warnings);

    const resSec = validateSecurityHighlights(content);
    allErrors.push(...resSec.errors);
    allWarnings.push(...resSec.warnings);

    const resPerf = validatePerformanceHighlights(content);
    allErrors.push(...resPerf.errors);
    allWarnings.push(...resPerf.warnings);
  }

  const cliffPath = resolve(rootDir, 'cliff.toml');
  if (existsSync(cliffPath)) {
    const resCliff = validateCliffConfig(readFileSync(cliffPath, 'utf8'));
    allErrors.push(...resCliff.errors);
    allWarnings.push(...resCliff.warnings);
  }

  return { valid: allErrors.length === 0, errors: allErrors, warnings: allWarnings };
}

if (require.main === module) {
  const result = runFullReleaseNotesValidation();
  if (!result.valid) {
    console.error('❌ Release notes validation failed:');
    result.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('✅ All release notes template and config checks passed successfully!');
  }
}
