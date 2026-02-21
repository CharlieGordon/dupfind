import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildDuplicatesReport } from '../src/report';
import {
  createTempDir,
  cleanupTempDir,
  createTestFile,
  createDuplicateStructure
} from './setup';
import path from 'path';

describe('buildDuplicatesReport', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should identify duplicates correctly', async () => {
    await createDuplicateStructure(tempDir);

    const result = await buildDuplicatesReport(tempDir);

    expect(result.report).toBeTruthy();
    expect(result.report).toContain('Hash:');
    // Should find at least 2 duplicate groups
    const hashCount = (result.report.match(/Hash:/g) || []).length;
    expect(hashCount).toBeGreaterThanOrEqual(2);
    expect(result.stats.duplicateGroups).toBeGreaterThanOrEqual(2);
    expect(result.errors).toEqual([]);
  });

  it('should return empty report when no duplicates found', async () => {
    await createTestFile(path.join(tempDir, 'unique1.txt'), 'content1');
    await createTestFile(path.join(tempDir, 'unique2.txt'), 'content2');
    await createTestFile(path.join(tempDir, 'unique3.txt'), 'content3');

    const result = await buildDuplicatesReport(tempDir);

    expect(result.report).toBe('');
    expect(result.stats.duplicateGroups).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('should exclude specified path', async () => {
    const file1 = path.join(tempDir, 'file1.txt');
    const file2 = path.join(tempDir, 'file2.txt');
    const exclude = path.join(tempDir, 'exclude.txt');

    await createTestFile(file1, 'duplicate content');
    await createTestFile(file2, 'duplicate content');
    await createTestFile(exclude, 'duplicate content');

    const result = await buildDuplicatesReport(tempDir, exclude);

    expect(result.report).toBeTruthy();
    expect(result.report).toContain(file1);
    expect(result.report).toContain(file2);
    expect(result.report).not.toContain(exclude);
  });

  it('should filter by extensions', async () => {
    await createTestFile(path.join(tempDir, 'file1.txt'), 'content');
    await createTestFile(path.join(tempDir, 'file2.txt'), 'content');
    await createTestFile(path.join(tempDir, 'file3.jpg'), 'content');

    const result = await buildDuplicatesReport(tempDir, undefined, ['.txt']);

    expect(result.report).toBeTruthy();
    expect(result.report).toContain('.txt');
    expect(result.report).not.toContain('.jpg');
  });

  it('should handle empty directory', async () => {
    const result = await buildDuplicatesReport(tempDir);
    expect(result.report).toBe('');
    expect(result.stats.filesScanned).toBe(0);
  });

  it('should show file paths in report', async () => {
    const file1 = path.join(tempDir, 'file1.txt');
    const file2 = path.join(tempDir, 'file2.txt');

    await createTestFile(file1, 'duplicate');
    await createTestFile(file2, 'duplicate');

    const result = await buildDuplicatesReport(tempDir);

    expect(result.report).toContain(file1);
    expect(result.report).toContain(file2);
  });

  it('should group files with same content hash together', async () => {
    const content = 'same content';
    await createTestFile(path.join(tempDir, 'a.txt'), content);
    await createTestFile(path.join(tempDir, 'b.txt'), content);
    await createTestFile(path.join(tempDir, 'c.txt'), content);

    const result = await buildDuplicatesReport(tempDir);

    // All three files should be under the same hash
    const lines = result.report.split('\n');
    const hashLine = lines.findIndex(line => line.startsWith('Hash:'));
    expect(hashLine).toBeGreaterThanOrEqual(0);

    // Count files under this hash (lines starting with '- ')
    let fileCount = 0;
    for (let i = hashLine + 1; i < lines.length && lines[i].startsWith('- '); i++) {
      fileCount++;
    }
    expect(fileCount).toBe(3);
  });

  it('should not report single files as duplicates', async () => {
    await createTestFile(path.join(tempDir, 'file1.txt'), 'content1');
    await createTestFile(path.join(tempDir, 'file2.txt'), 'content2');
    await createTestFile(path.join(tempDir, 'file3.txt'), 'content3');

    const result = await buildDuplicatesReport(tempDir);

    expect(result.report).toBe('');
  });

  it('should handle multiple duplicate groups', async () => {
    // Group 1: three files with same content
    await createTestFile(path.join(tempDir, 'a1.txt'), 'group A');
    await createTestFile(path.join(tempDir, 'a2.txt'), 'group A');
    await createTestFile(path.join(tempDir, 'a3.txt'), 'group A');

    // Group 2: two files with same content
    await createTestFile(path.join(tempDir, 'b1.txt'), 'group B');
    await createTestFile(path.join(tempDir, 'b2.txt'), 'group B');

    const result = await buildDuplicatesReport(tempDir);

    const hashCount = (result.report.match(/Hash:/g) || []).length;
    expect(hashCount).toBe(2);
  });

  it('should handle binary files', async () => {
    const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff]);

    await createTestFile(path.join(tempDir, 'binary1.dat'), binaryContent);
    await createTestFile(path.join(tempDir, 'binary2.dat'), binaryContent);

    const result = await buildDuplicatesReport(tempDir);

    expect(result.report).toBeTruthy();
    expect(result.report).toContain('binary1.dat');
    expect(result.report).toContain('binary2.dat');
  });
});
