import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export const VALID_BRANCH_PREFIXES = [
  'feat/',
  'fix/',
  'docs/',
  'refactor/',
  'chore/',
  'test/',
  'hotfix/',
  'release/',
  'feature/',
];

export const VALID_PR_TITLE_PREFIXES = [
  'Feature:',
  'Fix:',
  'Docs:',
  'Chore:',
  'Refactor:',
  'Test:',
  'Security:',
  'General:',
  'Perf:',
  'CI:',
];

export const REQUIRED_PR_SECTIONS = [
  '### Goal',
  '### Changes',
  '### Testing',
];

export const REQUIRED_REVIEW_COMMENT_PREFIXES = [
  'blocking:',
  'security:',
  'suggestion:',
  'nit:',
  'question:',
  'optional:',
];

/**
 * Validates a Git branch name against contribution standards.
 */
export function validateBranchName(branchName: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!branchName || branchName.trim() === '') {
    errors.push('Branch name cannot be empty.');
    return { valid: false, errors, warnings };
  }

  const trimmed = branchName.trim();
  if (['main', 'master', 'develop', 'staging'].includes(trimmed)) {
    return { valid: true, errors, warnings };
  }

  const hasValidPrefix = VALID_BRANCH_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
  if (!hasValidPrefix) {
    errors.push(
      `Branch name "${trimmed}" must start with one of: ${VALID_BRANCH_PREFIXES.join(', ')}`
    );
  }

  const parts = trimmed.split('/');
  if (parts.length < 2 || !parts[1]) {
    errors.push(`Branch name "${trimmed}" must follow pattern: <prefix>/<issue-number>-<short-description>`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates a Pull Request title against formatting standards.
 */
export function validatePRTitle(title: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!title || title.trim() === '') {
    errors.push('PR title cannot be empty.');
    return { valid: false, errors, warnings };
  }

  const trimmed = title.trim();
  const hasValidPrefix = VALID_PR_TITLE_PREFIXES.some((prefix) =>
    trimmed.toLowerCase().startsWith(prefix.toLowerCase())
  );

  if (!hasValidPrefix) {
    errors.push(
      `PR title "${trimmed}" must start with a recognized type prefix: ${VALID_PR_TITLE_PREFIXES.join(', ')}`
    );
  }

  if (trimmed.length < 10) {
    errors.push('PR title should be at least 10 characters long for descriptive clarity.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates PR description body against required template sections.
 */
export function validatePRDescription(description: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!description || description.trim() === '') {
    errors.push('PR description cannot be empty.');
    return { valid: false, errors, warnings };
  }

  for (const section of REQUIRED_PR_SECTIONS) {
    if (!description.includes(section)) {
      errors.push(`PR description is missing required section: "${section}"`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates syntax and essential path coverage in .github/CODEOWNERS.
 */
export function validateCodeowners(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content || content.trim() === '') {
    errors.push('CODEOWNERS file cannot be empty.');
    return { valid: false, errors, warnings };
  }

  const lines = content.split('\n');
  let ruleCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const tokens = line.split(/\s+/);
    if (tokens.length < 2) {
      errors.push(`Line ${i + 1} in CODEOWNERS is invalid. Rule must specify a pattern and at least one owner.`);
    } else {
      ruleCount++;
      const owners = tokens.slice(1);
      const invalidOwners = owners.filter(
        (owner) => !owner.startsWith('@') && !owner.includes('@')
      );
      if (invalidOwners.length > 0) {
        warnings.push(`Line ${i + 1} has owners that may be invalid: ${invalidOwners.join(', ')}`);
      }
    }
  }

  if (ruleCount === 0) {
    errors.push('CODEOWNERS contains no active owner rules.');
  }

  const requiredPaths = ['/contracts/', '/backend/', '/frontend/'];
  for (const reqPath of requiredPaths) {
    if (!content.includes(reqPath)) {
      errors.push(`CODEOWNERS is missing explicit rule for required tier path: "${reqPath}"`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates branch protection configuration schema.
 */
export function validateBranchProtection(jsonContent: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const config = JSON.parse(jsonContent);
    if (typeof config !== 'object' || config === null) {
      errors.push('branch-protection.json must be a valid JSON object.');
      return { valid: false, errors, warnings };
    }

    if (!config.required_pull_request_reviews) {
      errors.push('branch-protection.json is missing "required_pull_request_reviews" configuration.');
    } else {
      const reviews = config.required_pull_request_reviews;
      if (typeof reviews.required_approving_review_count !== 'number' || reviews.required_approving_review_count < 1) {
        errors.push('branch-protection.json must require at least 1 approving review count.');
      }
    }

    if (!config.required_status_checks) {
      errors.push('branch-protection.json is missing "required_status_checks" configuration.');
    }
  } catch (err) {
    errors.push(`Failed to parse branch-protection.json: ${(err as Error).message}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates the contents of docs/CODE_REVIEW_STANDARDS.md.
 */
export function validateCodeReviewStandardsDoc(markdownContent: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!markdownContent || markdownContent.trim() === '') {
    errors.push('CODE_REVIEW_STANDARDS.md cannot be empty.');
    return { valid: false, errors, warnings };
  }

  const requiredHeadings = [
    'Review SLAs & Turnaround Expectations',
    'Approval Requirements by Component Criticality',
    'Contributor / Author Guidelines',
    'Reviewer Expectations & Feedback Guidelines',
    'CODEOWNERS & Automated Approvals',
  ];

  for (const heading of requiredHeadings) {
    if (!markdownContent.includes(heading)) {
      errors.push(`CODE_REVIEW_STANDARDS.md is missing required section: "${heading}"`);
    }
  }

  for (const prefix of REQUIRED_REVIEW_COMMENT_PREFIXES) {
    if (!markdownContent.includes(prefix)) {
      errors.push(`CODE_REVIEW_STANDARDS.md is missing review comment prefix definition: "${prefix}"`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * CLI Runner for contribution standards validation.
 */
export function runFullRepositoryValidation(rootDir: string = process.cwd()): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  const codeownersPath = resolve(rootDir, '.github/CODEOWNERS');
  if (!existsSync(codeownersPath)) {
    allErrors.push('.github/CODEOWNERS file does not exist.');
  } else {
    const res = validateCodeowners(readFileSync(codeownersPath, 'utf8'));
    allErrors.push(...res.errors);
    allWarnings.push(...res.warnings);
  }

  const standardsDocPath = resolve(rootDir, 'docs/CODE_REVIEW_STANDARDS.md');
  if (!existsSync(standardsDocPath)) {
    allErrors.push('docs/CODE_REVIEW_STANDARDS.md file does not exist.');
  } else {
    const res = validateCodeReviewStandardsDoc(readFileSync(standardsDocPath, 'utf8'));
    allErrors.push(...res.errors);
    allWarnings.push(...res.warnings);
  }

  const branchProtectionPath = resolve(rootDir, 'branch-protection.json');
  if (existsSync(branchProtectionPath)) {
    const res = validateBranchProtection(readFileSync(branchProtectionPath, 'utf8'));
    allErrors.push(...res.errors);
    allWarnings.push(...res.warnings);
  }

  return { valid: allErrors.length === 0, errors: allErrors, warnings: allWarnings };
}

if (require.main === module) {
  const result = runFullRepositoryValidation();
  if (!result.valid) {
    console.error('❌ Contribution standards validation failed:');
    result.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('✅ All contribution standards checks passed successfully!');
  }
}
