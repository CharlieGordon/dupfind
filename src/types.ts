/**
 * Result of hashing a single file.
 */
export interface HashResult {
  filePath: string;
  hash: string;
}

/**
 * Error that occurred while hashing a file.
 */
export interface HashError {
  filePath: string;
  error: string;
}

/**
 * Statistics collected during a duplicate file scan.
 */
export interface ScanStats {
  /** Total number of files discovered during directory scan */
  filesScanned: number;
  /** Number of files that were hashed (only files with matching sizes) */
  filesHashed: number;
  /** Number of files that failed to hash */
  hashErrors: number;
  /** Number of duplicate groups found */
  duplicateGroups: number;
  /** Total number of duplicate files (sum across all groups) */
  duplicateFiles: number;
  /** Total bytes wasted by duplicates (sum of size × (count - 1) for each group) */
  wastedBytes: number;
}

/**
 * Complete result of building a duplicates report.
 */
export interface ReportResult {
  /** Formatted report text (empty string if no duplicates found) */
  report: string;
  /** List of files that failed to hash */
  errors: HashError[];
  /** Statistics about the scan */
  stats: ScanStats;
}

/**
 * Result of mapping items with concurrency, including both successes and errors.
 */
export interface MappedResult<R> {
  /** Array of results (null for failed items) */
  results: (R | null)[];
  /** Array of errors that occurred during mapping */
  errors: Array<{
    /** Index of the item that failed */
    index: number;
    /** The item that failed */
    item: any;
    /** The error that occurred */
    error: Error;
  }>;
}
