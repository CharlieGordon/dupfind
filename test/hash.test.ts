import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hashFile, mapWithConcurrency } from '../src/hash';
import { createTempDir, cleanupTempDir, createTestFile } from './setup';
import path from 'path';

describe('hashFile', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should produce same hash for identical content', async () => {
    const file1 = path.join(tempDir, 'file1.txt');
    const file2 = path.join(tempDir, 'file2.txt');
    const content = 'Hello, World!';

    await createTestFile(file1, content);
    await createTestFile(file2, content);

    const hash1 = await hashFile(file1);
    const hash2 = await hashFile(file2);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
  });

  it('should produce different hashes for different content', async () => {
    const file1 = path.join(tempDir, 'file1.txt');
    const file2 = path.join(tempDir, 'file2.txt');

    await createTestFile(file1, 'Content A');
    await createTestFile(file2, 'Content B');

    const hash1 = await hashFile(file1);
    const hash2 = await hashFile(file2);

    expect(hash1).not.toBe(hash2);
  });

  it('should hash binary content correctly', async () => {
    const file = path.join(tempDir, 'binary.dat');
    const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);

    await createTestFile(file, binaryContent);

    const hash = await hashFile(file);
    expect(hash).toHaveLength(64);
  });

  it('should handle large files', async () => {
    const file = path.join(tempDir, 'large.txt');
    // Create a ~1MB file
    const largeContent = 'x'.repeat(1024 * 1024);

    await createTestFile(file, largeContent);

    const hash = await hashFile(file);
    expect(hash).toHaveLength(64);
  });

  it('should reject non-existent files', async () => {
    const nonExistent = path.join(tempDir, 'does-not-exist.txt');

    await expect(hashFile(nonExistent)).rejects.toThrow();
  });

  it('should produce expected hash for known content', async () => {
    const file = path.join(tempDir, 'test.txt');
    await createTestFile(file, 'test');

    const hash = await hashFile(file);
    // SHA-256 of "test" is known
    expect(hash).toBe('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
  });
});

describe('mapWithConcurrency', () => {
  it('should process all items', async () => {
    const items = [1, 2, 3, 4, 5];
    const result = await mapWithConcurrency(
      items,
      2,
      async (item) => item * 2
    );

    expect(result.results).toEqual([2, 4, 6, 8, 10]);
    expect(result.errors).toEqual([]);
  });

  it('should respect concurrency limit', async () => {
    let concurrentCount = 0;
    let maxConcurrent = 0;

    const items = Array.from({ length: 10 }, (_, i) => i);

    await mapWithConcurrency(
      items,
      3,
      async (item) => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);

        await new Promise(resolve => setTimeout(resolve, 10));

        concurrentCount--;
        return item * 2;
      }
    );

    expect(maxConcurrent).toBeLessThanOrEqual(3);
    expect(maxConcurrent).toBeGreaterThan(0);
  });

  it('should preserve order of results', async () => {
    const items = [5, 1, 3, 2, 4];
    const result = await mapWithConcurrency(
      items,
      2,
      async (item) => {
        // Random delay to simulate async work
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        return item * 10;
      }
    );

    expect(result.results).toEqual([50, 10, 30, 20, 40]);
    expect(result.errors).toEqual([]);
  });

  it('should handle mapper errors gracefully and track them', async () => {
    const items = [1, 2, 3, 4, 5];
    const result = await mapWithConcurrency(
      items,
      2,
      async (item) => {
        if (item === 3) {
          throw new Error('Failed on 3');
        }
        return item * 2;
      }
    );

    expect(result.results[0]).toBe(2);
    expect(result.results[1]).toBe(4);
    expect(result.results[2]).toBeNull(); // Failed item returns null
    expect(result.results[3]).toBe(8);
    expect(result.results[4]).toBe(10);

    // Verify error was tracked
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].index).toBe(2);
    expect(result.errors[0].item).toBe(3);
    expect(result.errors[0].error.message).toBe('Failed on 3');
  });

  it('should handle empty array', async () => {
    const result = await mapWithConcurrency([], 2, async (item) => item);
    expect(result.results).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('should work with concurrency of 1', async () => {
    const items = [1, 2, 3];
    const result = await mapWithConcurrency(
      items,
      1,
      async (item) => item * 2
    );

    expect(result.results).toEqual([2, 4, 6]);
    expect(result.errors).toEqual([]);
  });

  it('should handle null return values from mapper', async () => {
    const items = [1, 2, 3];
    const result = await mapWithConcurrency(
      items,
      2,
      async (item) => (item === 2 ? null : item * 2)
    );

    expect(result.results[0]).toBe(2);
    expect(result.results[1]).toBeNull();
    expect(result.results[2]).toBe(6);
    expect(result.errors).toEqual([]);
  });

  it('should call progress callback if provided', async () => {
    const items = [1, 2, 3];
    const progressCalls: Array<{ completed: number; item: number }> = [];

    await mapWithConcurrency(
      items,
      2,
      async (item) => item * 2,
      (completed, item) => {
        progressCalls.push({ completed, item });
      }
    );

    expect(progressCalls).toHaveLength(3);
    expect(progressCalls[2].completed).toBe(3);
  });
});
