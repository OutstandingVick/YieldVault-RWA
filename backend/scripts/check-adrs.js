#!/usr/bin/env node
/**
 * scripts/check-adrs.js
 *
 * CI script that validates Architecture Decision Records (ADRs).
 * Run via `node scripts/check-adrs.js` or as part of `ci:governance`.
 *
 * Checks enforced:
 *  1. Every .md file in docs/architecture-decision-records/ (except README.md
 *     and template.md) must match the naming convention ADR-NNN-<slug>.md.
 *  2. Every ADR file must contain the required front-matter fields:
 *     Status, Date, and at least one level-2 heading.
 *  3. The index table in README.md must contain an entry for every ADR file
 *     (prevents silent omissions from the index).
 *  4. ADR numbers must be unique (no two files with the same NNN).
 *
 * Exit 0 on success, exit 1 on any violation (with descriptive messages).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ADR_DIR = path.resolve(__dirname, '../../docs/architecture-decision-records');
const README_PATH = path.join(ADR_DIR, 'README.md');

const EXCLUDED = new Set(['README.md', 'template.md']);
const FILE_PATTERN = /^ADR-(\d{3,})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

let errors = 0;

function fail(msg) {
  console.error(`  ❌ ${msg}`);
  errors++;
}

function ok(msg) {
  console.log(`  ✅ ${msg}`);
}

// ── 1. Read all ADR files ───────────────────────────────────────────────────

const allFiles = fs.readdirSync(ADR_DIR).filter(f => f.endsWith('.md'));
const adrFiles = allFiles.filter(f => !EXCLUDED.has(f));

// ── 2. Naming convention ────────────────────────────────────────────────────

console.log('\nChecking ADR file naming conventions…');
const validAdrFiles = [];

for (const file of adrFiles) {
  if (!FILE_PATTERN.test(file)) {
    fail(`"${file}" does not match naming convention ADR-NNN-<slug>.md (lowercase, hyphens)`);
  } else {
    ok(file);
    validAdrFiles.push(file);
  }
}

// ── 3. Unique ADR numbers ───────────────────────────────────────────────────

console.log('\nChecking ADR number uniqueness…');
const numberMap = new Map();

for (const file of validAdrFiles) {
  const match = FILE_PATTERN.exec(file);
  const num = match[1];
  if (numberMap.has(num)) {
    fail(`ADR number ${num} is used by both "${numberMap.get(num)}" and "${file}"`);
  } else {
    numberMap.set(num, file);
  }
}

if (errors === 0) ok('All ADR numbers are unique');

// ── 4. Required front-matter fields ────────────────────────────────────────

console.log('\nChecking ADR front-matter fields…');

for (const file of validAdrFiles) {
  const content = fs.readFileSync(path.join(ADR_DIR, file), 'utf8');

  const hasStatus = /\*\*Status:\*\*/.test(content);
  const hasDate   = /\*\*Date:\*\*/.test(content);
  const hasH2     = /^## /m.test(content);

  if (!hasStatus) fail(`"${file}" is missing required **Status:** field`);
  if (!hasDate)   fail(`"${file}" is missing required **Date:** field`);
  if (!hasH2)     fail(`"${file}" has no level-2 (##) sections`);

  if (hasStatus && hasDate && hasH2) ok(`${file} — front-matter OK`);
}

// ── 5. Index completeness ───────────────────────────────────────────────────

console.log('\nChecking README.md index completeness…');

const readmeContent = fs.readFileSync(README_PATH, 'utf8');

for (const file of validAdrFiles) {
  // Check that the ADR filename (without .md) or a link to it appears in README
  const slug = file.replace(/\.md$/, '');
  if (!readmeContent.includes(slug) && !readmeContent.includes(file)) {
    fail(`"${file}" is not listed in the README.md index table`);
  } else {
    ok(`${file} is in README index`);
  }
}

// ── Result ──────────────────────────────────────────────────────────────────

console.log();
if (errors > 0) {
  console.error(`ADR check failed with ${errors} error(s).\n`);
  process.exit(1);
} else {
  console.log(`ADR check passed. ${validAdrFiles.length} ADR(s) validated.\n`);
  process.exit(0);
}
