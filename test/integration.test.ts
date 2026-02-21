import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildDuplicatesReport } from '../src/report';
import {
  createTempDir,
  cleanupTempDir,
  createTestFile,
  createDuplicateStructure
} from './setup';
import path from 'path';

describe('End-to-end duplicate detection', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should complete full workflow with known duplicates', async () => {
    const structure = await createDuplicateStructure(tempDir);

    const result = await buildDuplicatesReport(tempDir);

    expect(result.report).toBeTruthy();

    // Verify all duplicate files appear in report
    for (const group of structure.duplicates) {
      for (const file of group.files) {
        expect(result.report).toContain(file);
      }
    }

    // Verify unique files don't appear
    for (const uniqueFile of structure.unique) {
      expect(result.report).not.toContain(uniqueFile);
    }
  });

  it('should handle mix of duplicates and unique files', async () => {
    // Create some duplicates
    await createTestFile(path.join(tempDir, 'd1.txt'), 'duplicate');
    await createTestFile(path.join(tempDir, 'd2.txt'), 'duplicate');

    // Create some unique files
    await createTestFile(path.join(tempDir, 'u1.txt'), 'unique1');
    await createTestFile(path.join(tempDir, 'u2.txt'), 'unique2');

    const result = await buildDuplicatesReport(tempDir);

    expect(result.report).toBeTruthy();
    expect(result.report).toContain('d1.txt');
    expect(result.report).toContain('d2.txt');
    expect(result.report).not.toContain('u1.txt');
    expect(result.report).not.toContain('u2.txt');
  });

  it('should work with nested directory structure', async () => {
    await createTestFile(path.join(tempDir, 'root.txt'), 'content');
    await createTestFile(path.join(tempDir, 'level1/file.txt'), 'content');
    await createTestFile(path.join(tempDir, 'level1/level2/deep.txt'), 'content');

    const result = await buildDuplicatesReport(tempDir);

    expect(result.report).toBeTruthy();
    const hashCount = (result.report.match(/Hash:/g) || []).length;
    expect(hashCount).toBe(1); // All three files have same content

    const fileCount = (result.report.match(/^- /gm) || []).length;
    expect(fileCount).toBe(3);
  });

  it('should handle large number of files', async () => {
    // Create 50 files with some duplicates
    const content1 = 'content type 1';
    const content2 = 'content type 2';

    for (let i = 0; i < 25; i++) {
      await createTestFile(path.join(tempDir, `file${i}a.txt`), content1);
      await createTestFile(path.join(tempDir, `file${i}b.txt`), content2);
    }

    const result = await buildDuplicatesReport(tempDir);

    expect(result.report).toBeTruthy();
    // Should have 2 groups (content1 and content2)
    const hashCount = (result.report.match(/Hash:/g) || []).length;
    expect(hashCount).toBe(2);

    // Each group should have 25 files
    const fileCount = (result.report.match(/^- /gm) || []).length;
    expect(fileCount).toBe(50);
  });

  it('should work with extension filtering', async () => {
    await createTestFile(path.join(tempDir, 'doc1.txt'), 'content');
    await createTestFile(path.join(tempDir, 'doc2.txt'), 'content');
    await createTestFile(path.join(tempDir, 'image1.jpg'), 'content');
    await createTestFile(path.join(tempDir, 'image2.jpg'), 'content');

    const txtResult = await buildDuplicatesReport(tempDir, undefined, ['.txt']);
    expect(txtResult.report).toContain('.txt');
    expect(txtResult.report).not.toContain('.jpg');

    const jpgResult = await buildDuplicatesReport(tempDir, undefined, ['.jpg']);
    expect(jpgResult.report).not.toContain('.txt');
    expect(jpgResult.report).toContain('.jpg');
  });

  it('should exclude output file from scanning', async () => {
    const outputPath = path.join(tempDir, 'duplicates.txt');

    await createTestFile(path.join(tempDir, 'file1.txt'), 'content');
    await createTestFile(path.join(tempDir, 'file2.txt'), 'content');
    await createTestFile(outputPath, 'content'); // Same content as files being scanned

    const result = await buildDuplicatesReport(tempDir, outputPath);

    expect(result.report).toBeTruthy();
    expect(result.report).toContain('file1.txt');
    expect(result.report).toContain('file2.txt');
    expect(result.report).not.toContain('duplicates.txt');
  });

  it('should handle very small files', async () => {
    await createTestFile(path.join(tempDir, 'tiny1.txt'), 'a');
    await createTestFile(path.join(tempDir, 'tiny2.txt'), 'a');

    const result = await buildDuplicatesReport(tempDir);

    expect(result.report).toBeTruthy();
    expect(result.report).toContain('tiny1.txt');
    expect(result.report).toContain('tiny2.txt');
  });

  it('should handle empty files as duplicates', async () => {
    await createTestFile(path.join(tempDir, 'empty1.txt'), '');
    await createTestFile(path.join(tempDir, 'empty2.txt'), '');
    await createTestFile(path.join(tempDir, 'empty3.txt'), '');

    const result = await buildDuplicatesReport(tempDir);

    expect(result.report).toBeTruthy();
    const fileCount = (result.report.match(/^- /gm) || []).length;
    expect(fileCount).toBe(3);
  });
});
