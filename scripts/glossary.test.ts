import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const glossaryPath = resolve(__dirname, '../docs/GLOSSARY.md');

describe('GLOSSARY.md documentation verification', () => {
  it('glossary file exists and is non-empty', () => {
    expect(existsSync(glossaryPath), 'GLOSSARY.md should exist in docs/').toBe(true);
    const content = readFileSync(glossaryPath, 'utf8');
    expect(content.length).toBeGreaterThan(1000);
  });

  it('contains title and table of contents', () => {
    const content = readFileSync(glossaryPath, 'utf8');
    expect(content).toContain('# YieldVault-RWA — Domain Glossary');
    expect(content).toContain('## Table of Contents');
  });

  it('all table of contents section headers exist in the document', () => {
    const content = readFileSync(glossaryPath, 'utf8');
    const tocSectionMatch = content.match(/## Table of Contents\s+([\s\S]*?)\s+---/);
    expect(tocSectionMatch).not.toBeNull();
    
    if (tocSectionMatch) {
      const tocItems = tocSectionMatch[1].match(/- \[(.*?)\]\(#(.*?)\)/g) || [];
      expect(tocItems.length).toBeGreaterThan(10);

      for (const item of tocItems) {
        const linkMatch = item.match(/- \[(.*?)\]\(#(.*?)\)/);
        if (linkMatch) {
          const title = linkMatch[1];
          expect(content, `Document should contain header: ${title}`).toContain(`## ${title}`);
        }
      }
    }
  });

  it('contains core Real-World Asset (RWA) terms and definitions', () => {
    const content = readFileSync(glossaryPath, 'utf8');
    const requiredRwaTerms = [
      'RWA (Real-World Asset)',
      'Tokenization',
      'Underlying Asset',
      'Custodian',
      'NAV (Net Asset Value)',
      'Treasury Bill (T-Bill)',
      'Sovereign Debt',
      'Proof of Reserve (PoR)',
      'Off-Chain Settlement',
      'CUSIP / ISIN',
      'Delivery-versus-Payment (DvP)',
      'Bankruptcy-Remote SPV',
      'Fractional RWA Ownership',
    ];

    for (const term of requiredRwaTerms) {
      expect(content, `GLOSSARY.md should define RWA term: ${term}`).toContain(`**${term}**`);
    }
  });

  it('contains core Vault-specific terms and definitions', () => {
    const content = readFileSync(glossaryPath, 'utf8');
    const requiredVaultTerms = [
      'Vault',
      'ERC-4626',
      'Vault State',
      'Idle Funds',
      'Invested Funds',
      'Underlying Token',
      'yvUSDC',
      'Share',
      'Share Price',
      'Strategy',
      'StrategyTrait',
      'BENJI Strategy',
      'Korean Sovereign Debt Strategy',
      'Yield Accrual',
      'Socialized Yield',
      'Oracle',
      'SecureWhitelist',
      'FeeBps',
      'Shipment',
      'Asset Provenance',
    ];

    for (const term of requiredVaultTerms) {
      expect(content, `GLOSSARY.md should define Vault term: ${term}`).toContain(`**${term}**`);
    }
  });
});
