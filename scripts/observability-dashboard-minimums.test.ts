import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const checklistPath = resolve(__dirname, '../docs/observability-dashboard-minimums.json');

describe('observability dashboard minimums', () => {
  it('defines required logs, metrics, and traces entries', () => {
    const checklist = JSON.parse(readFileSync(checklistPath, 'utf8')) as {
      pillars: string[];
      minimums: Array<{ id: string; pillar: string; required: boolean }>;
    };

    expect(checklist.pillars).toEqual(['logs', 'metrics', 'traces']);

    for (const pillar of checklist.pillars) {
      const required = checklist.minimums.filter((m) => m.pillar === pillar && m.required);
      expect(required.length, `expected required minimums for ${pillar}`).toBeGreaterThan(0);
    }

    const ids = checklist.minimums.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
