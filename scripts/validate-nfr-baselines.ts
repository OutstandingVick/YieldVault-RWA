import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface NFRTierConfig {
  tier: string;
  name: string;
  slo: {
    availability_percent: number;
    latency_p95_read_ms?: number;
    latency_p95_write_ms?: number;
  };
  rto_minutes: number;
  rpo_minutes: number;
}

/**
 * Validates the structure and sanity bounds of nfr-baselines.json.
 */
export function validateNFRJsonSpec(jsonContent: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const spec = JSON.parse(jsonContent);
    if (!spec || typeof spec !== 'object') {
      errors.push('nfr-baselines.json must be a valid JSON object.');
      return { valid: false, errors, warnings };
    }

    if (!Array.isArray(spec.tiers) || spec.tiers.length < 3) {
      errors.push('nfr-baselines.json must contain at least 3 criticality tiers.');
      return { valid: false, errors, warnings };
    }

    for (const t of spec.tiers as NFRTierConfig[]) {
      if (!t.tier || !t.name) {
        errors.push('Every tier must have a "tier" identifier and "name".');
      }

      if (typeof t.slo?.availability_percent !== 'number' || t.slo.availability_percent < 99.0 || t.slo.availability_percent > 100.0) {
        errors.push(`Tier "${t.tier}" has invalid availability SLO: ${t.slo?.availability_percent}% (must be between 99.0% and 100%).`);
      }

      if (typeof t.rto_minutes !== 'number' || t.rto_minutes < 0 || t.rto_minutes > 120) {
        errors.push(`Tier "${t.tier}" has invalid RTO: ${t.rto_minutes} minutes (must be between 0 and 120 mins).`);
      }

      if (typeof t.rpo_minutes !== 'number' || t.rpo_minutes < 0 || t.rpo_minutes > 60) {
        errors.push(`Tier "${t.tier}" has invalid RPO: ${t.rpo_minutes} minutes (must be between 0 and 60 mins).`);
      }
    }

    if (!spec.error_budget_policy || !spec.error_budget_policy.fast_burn || !spec.error_budget_policy.slow_burn) {
      errors.push('nfr-baselines.json is missing required "error_budget_policy" fast_burn / slow_burn definitions.');
    }
  } catch (err) {
    errors.push(`Failed to parse nfr-baselines.json: ${(err as Error).message}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates section completeness in docs/NFR_BASELINES.md.
 */
export function validateNFRDocContent(markdownContent: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!markdownContent || markdownContent.trim() === '') {
    errors.push('NFR_BASELINES.md content cannot be empty.');
    return { valid: false, errors, warnings };
  }

  const requiredHeadings = [
    'Non-Functional Requirement (NFR) Baselines',
    'Overview & Tier Taxonomy',
    'Service Level Objectives (SLO) & Service Level Indicators (SLI)',
    'Disaster Recovery Baselines: RTO & RPO',
    'Error Budget Policy & Alert Burn Rates',
    'Security & Compliance NFR Baselines',
  ];

  for (const heading of requiredHeadings) {
    if (!markdownContent.includes(heading)) {
      errors.push(`NFR_BASELINES.md is missing required section: "${heading}"`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates alignment between NFR baselines JSON and monitoring observability docs.
 */
export function validateObservabilityAlignment(nfrJson: string, observabilityDoc: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (nfrJson.includes('200') && !observabilityDoc.includes('200')) {
    warnings.push('Observability documentation should reference the 200 ms read P95 latency SLO.');
  }

  if (nfrJson.includes('500') && !observabilityDoc.includes('500')) {
    warnings.push('Observability documentation should reference the 500 ms write P95 latency SLO.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * CLI Runner for full repository NFR baselines validation.
 */
export function runFullNFRValidation(rootDir: string = process.cwd()): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  const jsonPath = resolve(rootDir, 'docs/nfr-baselines.json');
  let jsonContent = '';
  if (!existsSync(jsonPath)) {
    allErrors.push('docs/nfr-baselines.json file does not exist.');
  } else {
    jsonContent = readFileSync(jsonPath, 'utf8');
    const resJson = validateNFRJsonSpec(jsonContent);
    allErrors.push(...resJson.errors);
    allWarnings.push(...resJson.warnings);
  }

  const docPath = resolve(rootDir, 'docs/NFR_BASELINES.md');
  if (!existsSync(docPath)) {
    allErrors.push('docs/NFR_BASELINES.md file does not exist.');
  } else {
    const docContent = readFileSync(docPath, 'utf8');
    const resDoc = validateNFRDocContent(docContent);
    allErrors.push(...resDoc.errors);
    allWarnings.push(...resDoc.warnings);

    const obsPath = resolve(rootDir, 'docs/MONITORING_OBSERVABILITY.md');
    if (existsSync(obsPath) && jsonContent) {
      const obsContent = readFileSync(obsPath, 'utf8');
      const resAlign = validateObservabilityAlignment(jsonContent, obsContent);
      allErrors.push(...resAlign.errors);
      allWarnings.push(...resAlign.warnings);
    }
  }

  return { valid: allErrors.length === 0, errors: allErrors, warnings: allWarnings };
}

if (require.main === module) {
  const result = runFullNFRValidation();
  if (!result.valid) {
    console.error('❌ NFR baselines validation failed:');
    result.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('✅ All NFR baselines (SLO, RTO, RPO) checks passed successfully!');
  }
}
