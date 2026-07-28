import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validateSprintLabel,
  validateIssueTaxonomyLabel,
  validateIssueTemplate,
  validateSprintAndTriageDocs,
  runFullSprintAndTriageValidation,
  VALID_TYPES,
  VALID_SCOPES,
  VALID_PRIORITIES,
  VALID_STATUSES,
} from './validate-sprint-and-triage-conventions';

describe('Sprint & Triage Conventions Validator Unit Tests', () => {
  describe('validateSprintLabel', () => {
    it('accepts valid sprint label formats', () => {
      expect(validateSprintLabel('sprint: 2026-W30').valid).toBe(true);
      expect(validateSprintLabel('sprint: 2026-W52').valid).toBe(true);
      expect(validateSprintLabel('sprint: current').valid).toBe(true);
      expect(validateSprintLabel('sprint: next').valid).toBe(true);
      expect(validateSprintLabel('sprint: backlog').valid).toBe(true);
    });

    it('rejects invalid sprint label formats', () => {
      expect(validateSprintLabel('sprint-2026').valid).toBe(false);
      expect(validateSprintLabel('sprint: 26-W30').valid).toBe(false);
      expect(validateSprintLabel('sprint: invalid').valid).toBe(false);
      expect(validateSprintLabel('').valid).toBe(false);
    });
  });

  describe('validateIssueTaxonomyLabel', () => {
    it('accepts valid taxonomy labels across types, scopes, priorities, and statuses', () => {
      expect(validateIssueTaxonomyLabel('type: feature').valid).toBe(true);
      expect(validateIssueTaxonomyLabel('scope: contracts').valid).toBe(true);
      expect(validateIssueTaxonomyLabel('priority: p0-critical').valid).toBe(true);
      expect(validateIssueTaxonomyLabel('status: needs-triage').valid).toBe(true);
      expect(validateIssueTaxonomyLabel('sprint: 2026-W30').valid).toBe(true);
      expect(validateIssueTaxonomyLabel('epic: vault-v2').valid).toBe(true);
    });

    it('rejects invalid prefixed taxonomy labels', () => {
      expect(validateIssueTaxonomyLabel('type: invalid-type').valid).toBe(false);
      expect(validateIssueTaxonomyLabel('scope: invalid-scope').valid).toBe(false);
      expect(validateIssueTaxonomyLabel('priority: p99-urgent').valid).toBe(false);
      expect(validateIssueTaxonomyLabel('status: invalid-status').valid).toBe(false);
    });

    it('warns on uncategorized labels', () => {
      const res = validateIssueTaxonomyLabel('random-custom-label');
      expect(res.valid).toBe(true);
      expect(res.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateIssueTemplate', () => {
    it('accepts valid issue template format with frontmatter', () => {
      const markdown = `---
name: Bug Report
about: Report a bug
title: 'Fix: [Short description]'
---
## Description
      `;
      expect(validateIssueTemplate(markdown, 'bug_report.md').valid).toBe(true);
    });

    it('rejects issue templates missing frontmatter or required metadata', () => {
      const noFrontmatter = '## Description without frontmatter';
      expect(validateIssueTemplate(noFrontmatter, 'bug_report.md').valid).toBe(false);
    });
  });

  describe('validateSprintAndTriageDocs', () => {
    it('validates repository docs/SPRINT_AND_TRIAGE_CONVENTIONS.md file', () => {
      const docPath = resolve(__dirname, '../docs/SPRINT_AND_TRIAGE_CONVENTIONS.md');
      expect(existsSync(docPath)).toBe(true);
      const markdown = readFileSync(docPath, 'utf8');
      expect(validateSprintAndTriageDocs(markdown).valid).toBe(true);
    });
  });

  describe('runFullSprintAndTriageValidation', () => {
    it('passes full repository verification on actual codebase files', () => {
      const rootDir = resolve(__dirname, '..');
      const result = runFullSprintAndTriageValidation(rootDir);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
