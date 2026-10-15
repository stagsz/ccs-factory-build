// CCS Factory Build - dashboard server path logic. Pure functions, no IO.

import path from "node:path";

/**
 * Map a request pathname of the form /jobs/<id>/<file>.md to an absolute file
 * path inside <root>/factory/jobs. Returns null if the pathname is not a job
 * file, is malformed, or would resolve outside the jobs directory.
 * Backslashes are treated as separators on every platform, so a path that would
 * escape on Windows is rejected on Linux too.
 */
export function resolveJobFile(root, pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/jobs/")) return null;
  const jobsDir = path.join(root, "factory", "jobs");
  let decoded;
  try {
    decoded = decodeURIComponent(pathname.slice(5));
  } catch {
    return null;
  }
  const candidate = path.resolve(jobsDir, "." + decoded.replaceAll("\\", "/"));
  if (candidate.startsWith(jobsDir + path.sep) && candidate.endsWith(".md")) return candidate;
  return null;
}
