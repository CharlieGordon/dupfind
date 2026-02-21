import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Creates an isolated temporary directory for testing.
 * Returns the absolute path to the temp directory.
 */
export async function createTempDir(prefix = 'dupfind-test-'): Promise<string> {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
  return tmpDir;
}

/**
 * Recursively removes a directory and all its contents.
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
  try {
    await fs.promises.rm(dirPath, { recursive: true, force: true });
  } catch (err) {
    // Ignore cleanup errors
    console.warn(`Failed to cleanup temp dir ${dirPath}:`, err);
  }
}

/**
 * Creates a file with specified content at the given path.
 * Creates parent directories if they don't exist.
 */
export async function createTestFile(
  filePath: string,
  content: string | Buffer
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(filePath, content);
}

/**
 * Creates a known duplicate file structure for testing.
 * Returns an object with paths to duplicate and unique files.
 */
export async function createDuplicateStructure(baseDir: string): Promise<{
  duplicates: { content: string; files: string[] }[];
  unique: string[];
}> {
  // Create some duplicate files
  const file1 = path.join(baseDir, 'file1.txt');
  const file1Copy = path.join(baseDir, 'file1-copy.txt');
  const file1Copy2 = path.join(baseDir, 'subdir', 'file1-copy2.txt');

  await createTestFile(file1, 'Hello, World!');
  await createTestFile(file1Copy, 'Hello, World!');
  await createTestFile(file1Copy2, 'Hello, World!');

  const file2 = path.join(baseDir, 'file2.txt');
  const file2Copy = path.join(baseDir, 'subdir', 'file2-copy.txt');

  await createTestFile(file2, 'Different content here');
  await createTestFile(file2Copy, 'Different content here');

  // Create some unique files
  const unique1 = path.join(baseDir, 'unique1.txt');
  const unique2 = path.join(baseDir, 'subdir', 'unique2.txt');

  await createTestFile(unique1, 'Unique content 1');
  await createTestFile(unique2, 'Unique content 2');

  return {
    duplicates: [
      {
        content: 'Hello, World!',
        files: [file1, file1Copy, file1Copy2]
      },
      {
        content: 'Different content here',
        files: [file2, file2Copy]
      }
    ],
    unique: [unique1, unique2]
  };
}

/**
 * Creates a symbolic link at linkPath pointing to targetPath.
 * Used for testing symlink handling behavior.
 */
export async function createSymlink(
  targetPath: string,
  linkPath: string
): Promise<void> {
  await fs.promises.symlink(targetPath, linkPath);
}

/**
 * Makes a file read-only (removes write permissions).
 * Used for testing permission error handling.
 */
export async function makeReadOnly(filePath: string): Promise<void> {
  await fs.promises.chmod(filePath, 0o444);
}

/**
 * Makes a file writable again (restores write permissions).
 */
export async function makeWritable(filePath: string): Promise<void> {
  await fs.promises.chmod(filePath, 0o644);
}
