import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validateReleaseNotesContent,
  validateSecurityHighlights,
  validatePerformanceHighlights,
  validateCliffConfig,
  runFullReleaseNotesValidation,
} from './validate-release-notes';

describe('Release Notes Template & Config Validator Unit Tests', () => {
  describe('validateReleaseNotesContent', () => {
    it('accepts valid release notes content containing all required sections', () => {
      const markdown = `
# Release Overview
Release summary.

# Security Highlights
Security fixes.

# Performance Highlights
Gas optimizations.

# Breaking Changes
Migration guide.

# New Features
Feature entries.

# Bug Fixes
Fix entries.
      `;
      expect(validateReleaseNotesContent(markdown).valid).toBe(true);
    });

    it('rejects release notes missing required sections', () => {
      const markdown = '# Release Overview\nSummary.';
      const res = validateReleaseNotesContent(markdown);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Security Highlights'))).toBe(true);
      expect(res.errors.some((e) => e.includes('Performance Highlights'))).toBe(true);
    });
  });

  describe('validateSecurityHighlights', () => {
    it('accepts valid security highlights section with checkpoints', () => {
      const markdown = `
## Security Highlights
- Slither Static Analysis: Passed
- Dependency Audit: 0 High
- Secret Scanning: Clean
      `;
      expect(validateSecurityHighlights(markdown).valid).toBe(true);
    });

    it('rejects content missing Security Highlights heading', () => {
      const res = validateSecurityHighlights('No security section here');
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('Security Highlights section is missing');
    });
  });

  describe('validatePerformanceHighlights', () => {
    it('accepts performance highlights with quantitative terms', () => {
      const markdown = '## Performance Highlights\n- Gas reduced by 15%';
      expect(validatePerformanceHighlights(markdown).valid).toBe(true);
    });

    it('warns when performance section lacks quantitative terms', () => {
      const markdown = '## Performance Highlights\n- Made things better.';
      const res = validatePerformanceHighlights(markdown);
      expect(res.valid).toBe(true);
      expect(res.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateCliffConfig', () => {
    it('accepts valid cliff.toml configuration', () => {
      const toml = `
commit_parsers = [
  { message = "^sec", group = "Security Highlights" },
  { message = "^perf", group = "Performance Highlights" },
]
      `;
      expect(validateCliffConfig(toml).valid).toBe(true);
    });

    it('rejects cliff.toml missing required groups', () => {
      const toml = 'commit_parsers = []';
      const res = validateCliffConfig(toml);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Security Highlights'))).toBe(true);
    });
  });

  describe('runFullReleaseNotesValidation', () => {
    it('passes full repository verification on actual codebase files', () => {
      const rootDir = resolve(__dirname, '..');
      const result = runFullReleaseNotesValidation(rootDir);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
