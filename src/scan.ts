import fs from "fs";
import path from "path";

const fsp = fs.promises;

// Recursively traverse directories and invoke onFile for regular files only.
export async function walkDirectory(
  rootDir: string,
  onFile: (filePath: string) => Promise<void>
): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(rootDir, { withFileTypes: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error reading directory: ${rootDir}: ${message}`);
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    // Do not follow symbolic links to avoid cycles or unexpected paths.
    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      await walkDirectory(fullPath, onFile);
      continue;
    }

    if (entry.isFile()) {
      await onFile(fullPath);
    }
  }
}

export async function collectSizeGroups(
  rootDir: string,
  outputPath: string
): Promise<Map<number, string[]>> {
  const sizeGroups = new Map<number, string[]>();

  await walkDirectory(rootDir, async (filePath) => {
    if (filePath === outputPath) {
      return;
    }

    let stats: fs.Stats;
    try {
      stats = await fsp.stat(filePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error stating file: ${filePath}: ${message}`);
      return;
    }

    if (!stats.isFile()) {
      return;
    }

    const size = stats.size;
    const group = sizeGroups.get(size);
    if (group) {
      group.push(filePath);
    } else {
      sizeGroups.set(size, [filePath]);
    }
  });

  return sizeGroups;
}
