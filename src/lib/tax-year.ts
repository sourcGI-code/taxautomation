/**
 * Default US individual tax year:
 * - Jan–Apr: prior calendar year (current filing season)
 * - May–Dec: prior calendar year still common; can override via TAX_YEAR env
 */
export function getDefaultTaxYear(now = new Date()): number {
  if (process.env.TAX_YEAR) {
    const parsed = parseInt(process.env.TAX_YEAR, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return now.getFullYear() - 1;
}
