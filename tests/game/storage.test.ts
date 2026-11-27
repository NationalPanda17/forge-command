import { describe, expect, it } from 'vitest';
import { STORAGE_SOFT_LIMIT, storageUse, storageWarning } from '../../src/game/saves';

/** A stand-in for the browser's storage. */
function store(items: Record<string, string>): Pick<Storage, 'length' | 'key' | 'getItem'> {
  const keys = Object.keys(items);
  return { length: keys.length, key: (i) => keys[i] ?? null, getItem: (k) => items[k] ?? null };
}

describe('save storage', () => {
  it('counts only this game’s saves, keys included', () => {
    // Arrange
    const s = store({ 'forge-command-save': 'x'.repeat(100), 'forge-command-slot:a': 'y'.repeat(50), 'another-site': 'z'.repeat(1000) });
    // Act and assert
    expect(storageUse(s)).toBe('forge-command-save'.length + 100 + 'forge-command-slot:a'.length + 50);
  });

  it('warns only once saves pass the soft limit', () => {
    // Act and assert
    expect(storageWarning(STORAGE_SOFT_LIMIT - 1)).toBeNull();
    expect(storageWarning(STORAGE_SOFT_LIMIT + 1)).toMatch(/delete old ones, or export them/);
  });
});
