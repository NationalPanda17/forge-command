import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CASES, runCase, type GoldenRecord } from './cases';

// The records live beside this file. `npm run golden:update` (UPDATE_GOLDEN=1) writes them; otherwise the test compares.
const DIR = join(dirname(fileURLToPath(import.meta.url)), 'records');
const UPDATE = process.env.UPDATE_GOLDEN === '1';

describe('golden masters', () => {
  for (const c of CASES) {
    it(`${c.name} plays exactly as recorded (${c.covers})`, () => {
      // Arrange
      const file = join(DIR, `${c.name}.json`);
      // Act
      const got = runCase(c);
      if (UPDATE || !existsSync(file)) {
        mkdirSync(DIR, { recursive: true });
        writeFileSync(file, JSON.stringify(got, null, 1) + '\n');
        if (!UPDATE) throw new Error(`No golden record for ${c.name}: written now. Check it in, then run the tests again.`);
        return;
      }
      const want = JSON.parse(readFileSync(file, 'utf8')) as GoldenRecord;
      // Assert: month by month first, so a failure names the first month that differs.
      for (let i = 0; i < Math.max(want.months.length, got.months.length); i++) expect(got.months[i], `${c.name}, month ${i + 1}`).toEqual(want.months[i]);
      expect(got.finalHash, `${c.name}: the final state differs although every monthly figure matches`).toBe(want.finalHash);
    });
  }
});
