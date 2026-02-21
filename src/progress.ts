import path from "path";

/**
 * Interface for progress reporting during duplicate file scanning.
 */
export interface ProgressReporter {
  /** Called when directory scanning begins */
  startScanning(): void;

  /** Called periodically during directory scanning with file count */
  updateScanning(filesFound: number): void;

  /** Called when directory scanning completes */
  endScanning(totalFiles: number): void;

  /** Called when file hashing begins */
  startHashing(totalFiles: number): void;

  /** Called periodically during hashing with progress */
  updateHashing(completed: number, total: number, currentFile?: string): void;

  /** Called when file hashing completes */
  endHashing(): void;
}

/**
 * Progress reporter that outputs to stderr with throttled updates.
 * Updates are throttled to avoid excessive I/O during fast operations.
 */
class StderrProgressReporter implements ProgressReporter {
  private lastUpdate = 0;
  private readonly UPDATE_INTERVAL_MS = 100; // Throttle to 10 updates/sec

  startScanning(): void {
    process.stderr.write('Scanning directory...\n');
  }

  updateScanning(filesFound: number): void {
    const now = Date.now();
    if (now - this.lastUpdate < this.UPDATE_INTERVAL_MS) return;
    this.lastUpdate = now;

    process.stderr.write(`\rFiles found: ${filesFound}`);
  }

  endScanning(totalFiles: number): void {
    process.stderr.write(`\rFiles found: ${totalFiles}\n`);
  }

  startHashing(totalFiles: number): void {
    process.stderr.write(`Hashing ${totalFiles} candidate files...\n`);
  }

  updateHashing(completed: number, total: number, currentFile?: string): void {
    const now = Date.now();
    if (now - this.lastUpdate < this.UPDATE_INTERVAL_MS) return;
    this.lastUpdate = now;

    const percent = ((completed / total) * 100).toFixed(1);
    const fileName = currentFile ? path.basename(currentFile) : '';
    const display = fileName
      ? `\rHashing: ${completed}/${total} (${percent}%) - ${fileName}`
      : `\rHashing: ${completed}/${total} (${percent}%)`;

    // Pad with spaces to clear previous line
    process.stderr.write(display + ' '.repeat(20));
  }

  endHashing(): void {
    process.stderr.write('\rHashing complete.' + ' '.repeat(50) + '\n');
  }
}

/**
 * No-op progress reporter that produces no output.
 * Used when progress reporting is disabled (e.g., when piping stdout).
 */
class NoOpProgressReporter implements ProgressReporter {
  startScanning(): void {}
  updateScanning(_filesFound: number): void {}
  endScanning(_totalFiles: number): void {}
  startHashing(_totalFiles: number): void {}
  updateHashing(_completed: number, _total: number, _currentFile?: string): void {}
  endHashing(): void {}
}

/**
 * Creates a progress reporter based on whether progress should be enabled.
 * Progress is enabled when outputting to a file or when stdout is a TTY.
 *
 * @param enabled - Whether to enable progress reporting
 * @returns A ProgressReporter instance
 */
export function createProgressReporter(enabled: boolean): ProgressReporter {
  return enabled ? new StderrProgressReporter() : new NoOpProgressReporter();
}
