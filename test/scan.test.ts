import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { walkDirectory, collectSizeGroups } from '../src/scan';
import {
  createTempDir,
  cleanupTempDir,
  createTestFile,
  createSymlink
} from './setup';
import path from 'path';

describe('walkDirectory', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should find all files in directory tree', async () => {
    await createTestFile(path.join(tempDir, 'file1.txt'), 'content1');
    await createTestFile(path.join(tempDir, 'subdir/file2.txt'), 'content2');
    await createTestFile(path.join(tempDir, 'subdir/nested/file3.txt'), 'content3');

    const foundFiles: string[] = [];
    await walkDirectory(tempDir, async (filePath) => {
      foundFiles.push(filePath);
    });

    expect(foundFiles).toHaveLength(3);
    expect(foundFiles).toContain(path.join(tempDir, 'file1.txt'));
    expect(foundFiles).toContain(path.join(tempDir, 'subdir/file2.txt'));
    expect(foundFiles).toContain(path.join(tempDir, 'subdir/nested/file3.txt'));
  });

  it('should handle empty directory', async () => {
    const foundFiles: string[] = [];
    await walkDirectory(tempDir, async (filePath) => {
      foundFiles.push(filePath);
    });

    expect(foundFiles).toHaveLength(0);
  });

  it('should skip symbolic links', async () => {
    const realFile = path.join(tempDir, 'real.txt');
    const link = path.join(tempDir, 'link.txt');

    await createTestFile(realFile, 'content');
    await createSymlink(realFile, link);

    const foundFiles: string[] = [];
    await walkDirectory(tempDir, async (filePath) => {
      foundFiles.push(filePath);
    });

    // Should only find the real file, not the symlink
    expect(foundFiles).toHaveLength(1);
    expect(foundFiles[0]).toBe(realFile);
  });

  it('should handle directory with only subdirectories', async () => {
    await createTestFile(path.join(tempDir, 'subdir/file.txt'), 'content');

    const foundFiles: string[] = [];
    await walkDirectory(tempDir, async (filePath) => {
      foundFiles.push(filePath);
    });

    expect(foundFiles).toHaveLength(1);
  });

  it('should invoke callback for each file', async () => {
    await createTestFile(path.join(tempDir, 'a.txt'), 'a');
    await createTestFile(path.join(tempDir, 'b.txt'), 'b');
    await createTestFile(path.join(tempDir, 'c.txt'), 'c');

    let callbackCount = 0;
    await walkDirectory(tempDir, async () => {
      callbackCount++;
    });

    expect(callbackCount).toBe(3);
  });
});

describe('collectSizeGroups', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should group files by size', async () => {
    await createTestFile(path.join(tempDir, 'small1.txt'), 'hi');
    await createTestFile(path.join(tempDir, 'small2.txt'), 'yo');
    await createTestFile(path.join(tempDir, 'large.txt'), 'hello world');

    const sizeGroups = await collectSizeGroups(tempDir);

    expect(sizeGroups.size).toBe(2);
    // Files with 2 bytes
    expect(sizeGroups.get(2)).toHaveLength(2);
    // File with 11 bytes
    expect(sizeGroups.get(11)).toHaveLength(1);
  });

  it('should exclude specified path', async () => {
    const file1 = path.join(tempDir, 'file1.txt');
    const file2 = path.join(tempDir, 'file2.txt');
    const exclude = path.join(tempDir, 'exclude.txt');

    await createTestFile(file1, 'content');
    await createTestFile(file2, 'content');
    await createTestFile(exclude, 'content');

    const sizeGroups = await collectSizeGroups(tempDir, exclude);

    const group = sizeGroups.get(7); // "content" is 7 bytes
    expect(group).toBeDefined();
    expect(group).toHaveLength(2);
    expect(group).toContain(file1);
    expect(group).toContain(file2);
    expect(group).not.toContain(exclude);
  });

  it('should filter by extensions', async () => {
    await createTestFile(path.join(tempDir, 'file1.txt'), 'content');
    await createTestFile(path.join(tempDir, 'file2.txt'), 'content');
    await createTestFile(path.join(tempDir, 'file3.jpg'), 'content');
    await createTestFile(path.join(tempDir, 'file4.png'), 'content');

    const sizeGroups = await collectSizeGroups(tempDir, undefined, ['.txt']);

    // Should only collect .txt files
    const group = sizeGroups.get(7);
    expect(group).toBeDefined();
    expect(group).toHaveLength(2);
  });

  it('should handle extension filtering case-insensitively', async () => {
    await createTestFile(path.join(tempDir, 'file1.TXT'), 'content');
    await createTestFile(path.join(tempDir, 'file2.txt'), 'content');
    await createTestFile(path.join(tempDir, 'file3.Txt'), 'content');

    const sizeGroups = await collectSizeGroups(tempDir, undefined, ['.txt']);

    const group = sizeGroups.get(7);
    expect(group).toBeDefined();
    expect(group).toHaveLength(3);
  });

  it('should handle multiple extensions', async () => {
    await createTestFile(path.join(tempDir, 'file1.txt'), 'content');
    await createTestFile(path.join(tempDir, 'file2.jpg'), 'content');
    await createTestFile(path.join(tempDir, 'file3.png'), 'content');
    await createTestFile(path.join(tempDir, 'file4.pdf'), 'content');

    const sizeGroups = await collectSizeGroups(tempDir, undefined, ['.txt', '.jpg']);

    const group = sizeGroups.get(7);
    expect(group).toBeDefined();
    expect(group).toHaveLength(2);
    expect(group?.some(f => f.endsWith('.txt'))).toBe(true);
    expect(group?.some(f => f.endsWith('.jpg'))).toBe(true);
    expect(group?.some(f => f.endsWith('.png'))).toBe(false);
  });

  it('should handle empty directory', async () => {
    const sizeGroups = await collectSizeGroups(tempDir);
    expect(sizeGroups.size).toBe(0);
  });

  it('should handle files of same content (same size)', async () => {
    const content = 'identical content';
    await createTestFile(path.join(tempDir, 'a.txt'), content);
    await createTestFile(path.join(tempDir, 'b.txt'), content);
    await createTestFile(path.join(tempDir, 'c.txt'), content);

    const sizeGroups = await collectSizeGroups(tempDir);

    const size = Buffer.byteLength(content);
    const group = sizeGroups.get(size);
    expect(group).toBeDefined();
    expect(group).toHaveLength(3);
  });

  it('should handle zero-byte files', async () => {
    await createTestFile(path.join(tempDir, 'empty1.txt'), '');
    await createTestFile(path.join(tempDir, 'empty2.txt'), '');

    const sizeGroups = await collectSizeGroups(tempDir);

    const group = sizeGroups.get(0);
    expect(group).toBeDefined();
    expect(group).toHaveLength(2);
  });
});
