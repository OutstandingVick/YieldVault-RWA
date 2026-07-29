import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validateBranchName,
  validatePRTitle,
  validatePRDescription,
  validateCodeowners,
  validateBranchProtection,
  validateCodeReviewStandardsDoc,
  runFullRepositoryValidation,
  VALID_BRANCH_PREFIXES,
  VALID_PR_TITLE_PREFIXES,
} from './validate-contribution-standards';

describe('Contribution Standards Validator Unit Tests', () => {
  describe('validateBranchName', () => {
    it('accepts valid feature branch names', () => {
      expect(validateBranchName('feat/937-add-contribution-standards').valid).toBe(true);
      expect(validateBranchName('fix/102-resolve-auth-crash').valid).toBe(true);
      expect(validateBranchName('docs/501-update-api-spec').valid).toBe(true);
      expect(validateBranchName('feature/issue-937-standards').valid).toBe(true);
      expect(validateBranchName('main').valid).toBe(true);
    });

    it('rejects invalid branch names without recognized prefix or description', () => {
      const res = validateBranchName('my-custom-branch');
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
    });

    it('rejects empty branch name', () => {
      const res = validateBranchName('');
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('Branch name cannot be empty.');
    });
  });

  describe('validatePRTitle', () => {
    it('accepts valid PR titles with proper prefixes', () => {
      expect(validatePRTitle('Feature: Add code review standards').valid).toBe(true);
      expect(validatePRTitle('Fix: Resolve rounding error in vault').valid).toBe(true);
      expect(validatePRTitle('Docs: Update onboarding checklist').valid).toBe(true);
      expect(validatePRTitle('General: Implement review standards').valid).toBe(true);
    });

    it('rejects PR titles with missing or invalid prefixes', () => {
      const res = validatePRTitle('Updated some code');
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('must start with a recognized type prefix');
    });

    it('rejects overly short PR titles', () => {
      const res = validatePRTitle('Fix: a');
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('at least 10 characters long');
    });
  });

  describe('validatePRDescription', () => {
    it('accepts PR descriptions containing all required sections', () => {
      const desc = `
### Goal
Adds contribution standards for PR reviews.

### Changes
- Created CODEOWNERS
- Added CODE_REVIEW_STANDARDS.md

### Testing
- Added unit tests
      `;
      expect(validatePRDescription(desc).valid).toBe(true);
    });

    it('rejects PR descriptions missing required sections', () => {
      const desc = '### Goal\nAdds feature.';
      const res = validatePRDescription(desc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('### Changes'))).toBe(true);
      expect(res.errors.some((e) => e.includes('### Testing'))).toBe(true);
    });
  });

  describe('validateCodeowners', () => {
    it('accepts valid CODEOWNERS content covering required paths', () => {
      const content = `
# CODEOWNERS
/contracts/ @team-contracts @security-team
/backend/ @team-backend
/frontend/ @team-frontend
      `;
      expect(validateCodeowners(content).valid).toBe(true);
    });

    it('rejects empty CODEOWNERS file', () => {
      const res = validateCodeowners('');
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('CODEOWNERS file cannot be empty.');
    });

    it('rejects CODEOWNERS missing required tier paths', () => {
      const content = '/contracts/ @team-contracts';
      const res = validateCodeowners(content);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('/backend/'))).toBe(true);
      expect(res.errors.some((e) => e.includes('/frontend/'))).toBe(true);
    });
  });

  describe('validateBranchProtection', () => {
    it('accepts valid branch-protection.json structure', () => {
      const json = JSON.stringify({
        required_status_checks: { strict: true, contexts: [] },
        required_pull_request_reviews: { required_approving_review_count: 1 },
      });
      expect(validateBranchProtection(json).valid).toBe(true);
    });

    it('rejects invalid JSON syntax', () => {
      const res = validateBranchProtection('{ invalid json');
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('Failed to parse branch-protection.json');
    });

    it('rejects branch protection with 0 approvals required', () => {
      const json = JSON.stringify({
        required_status_checks: { strict: true },
        required_pull_request_reviews: { required_approving_review_count: 0 },
      });
      const res = validateBranchProtection(json);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('must require at least 1 approving review count');
    });
  });

  describe('validateCodeReviewStandardsDoc', () => {
    it('validates repository docs/CODE_REVIEW_STANDARDS.md file', () => {
      const docPath = resolve(__dirname, '../docs/CODE_REVIEW_STANDARDS.md');
      expect(existsSync(docPath)).toBe(true);
      const markdown = readFileSync(docPath, 'utf8');
      const res = validateCodeReviewStandardsDoc(markdown);
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual([]);
    });
  });

  describe('runFullRepositoryValidation', () => {
    it('passes full repository verification on actual codebase files', () => {
      const rootDir = resolve(__dirname, '..');
      const result = runFullRepositoryValidation(rootDir);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
