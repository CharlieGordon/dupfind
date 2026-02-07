import os from "os";

export const OUTPUT_FILE_NAME = "duplicates.txt";
export const HASH_CONCURRENCY = Math.max(2, Math.min(8, os.cpus().length || 2));
