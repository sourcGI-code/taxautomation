import type { MefReturnPayload, MefValidationIssue } from "./types";
import { MEF_FORM_TYPES } from "./types";

const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

function issue(
  code: string,
  severity: "error" | "warning",
  path: string,
  message: string
): MefValidationIssue {
  return { code, severity, path, message };
}

/**
 * Business-rule validation approximating MeF schema + IRS basic checks.
 * Not a substitute for IRS ATS/PATS certification testing.
 */
export function validateMefReturn(
  payload: MefReturnPayload
): { ok: boolean; errors: MefValidationIssue[]; warnings: MefValidationIssue[] } {
  const errors: MefValidationIssue[] = [];
  const warnings: MefValidationIssue[] = [];

  const year = payload.taxYear;
  const current = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2020 || year > current + 1) {
    errors.push(issue("MEF-TY-01", "error", "taxYear", "Tax year is out of acceptable range"));
  }

  if (!MEF_FORM_TYPES.includes(payload.formType)) {
    errors.push(issue("MEF-FT-01", "error", "formType", "Unsupported form type for this transmitter"));
  }

  const t = payload.taxpayer;
  if (!t?.firstName?.trim() || t.firstName.length < 1) {
    errors.push(issue("MEF-TP-01", "error", "taxpayer.firstName", "Taxpayer first name required"));
  }
  if (!t?.lastName?.trim() || t.lastName.length < 1) {
    errors.push(issue("MEF-TP-02", "error", "taxpayer.lastName", "Taxpayer last name required"));
  }
  if (!t?.address?.street?.trim()) {
    errors.push(issue("MEF-TP-03", "error", "taxpayer.address.street", "Street address required"));
  }
  if (!t?.address?.city?.trim()) {
    errors.push(issue("MEF-TP-04", "error", "taxpayer.address.city", "City required"));
  }
  if (!t?.address?.state || !US_STATES.has(t.address.state.toUpperCase())) {
    errors.push(issue("MEF-TP-05", "error", "taxpayer.address.state", "Valid US state required"));
  }
  if (!t?.address?.zip || !/^\d{5}(-\d{4})?$/.test(t.address.zip)) {
    errors.push(issue("MEF-TP-06", "error", "taxpayer.address.zip", "ZIP must be 12345 or 12345-6789"));
  }
  if (!t?.filingStatus?.trim()) {
    errors.push(issue("MEF-TP-07", "error", "taxpayer.filingStatus", "Filing status required"));
  }

  // SSN: full for package, last-four acceptable in draft with warning
  if (t.ssnFull) {
    const digits = t.ssnFull.replace(/\D/g, "");
    if (digits.length !== 9 || /^(\d)\1{8}$/.test(digits)) {
      errors.push(issue("MEF-SSN-01", "error", "taxpayer.ssnFull", "SSN must be 9 valid digits"));
    }
    if (digits.startsWith("000") || digits.slice(3, 5) === "00" || digits.slice(5) === "0000") {
      errors.push(issue("MEF-SSN-02", "error", "taxpayer.ssnFull", "SSN fails IRS basic validity checks"));
    }
  } else if (t.ssnLastFour && /^\d{4}$/.test(t.ssnLastFour)) {
    warnings.push(
      issue(
        "MEF-SSN-03",
        "warning",
        "taxpayer.ssnFull",
        "Only last-four present — full SSN required before production transmit"
      )
    );
  } else {
    errors.push(
      issue("MEF-SSN-04", "error", "taxpayer.ssnFull", "SSN required (full or last four for draft)")
    );
  }

  if (
    /married/i.test(t.filingStatus) &&
    /joint/i.test(t.filingStatus) &&
    !payload.spouse?.lastName
  ) {
    errors.push(
      issue("MEF-SP-01", "error", "spouse", "Spouse information required for MFJ")
    );
  }

  const wages = payload.income?.wages ?? 0;
  const totalIncome =
    wages +
    (payload.income?.interest ?? 0) +
    (payload.income?.dividends ?? 0) +
    (payload.income?.businessIncome ?? 0) +
    (payload.income?.capitalGains ?? 0) +
    (payload.income?.otherIncome ?? 0);

  if (totalIncome < 0) {
    errors.push(issue("MEF-INC-01", "error", "income", "Total income cannot be negative"));
  }
  if (totalIncome === 0) {
    warnings.push(issue("MEF-INC-02", "warning", "income", "Total income is zero"));
  }

  if (!payload.deductions?.standardOrItemized) {
    errors.push(
      issue("MEF-DED-01", "error", "deductions", "Must choose standard or itemized deduction")
    );
  }

  if (!payload.preparer?.name?.trim()) {
    errors.push(issue("MEF-PR-01", "error", "preparer.name", "Preparer name required"));
  }
  if (payload.preparer?.ptin && !/^P\d{8}$/i.test(payload.preparer.ptin)) {
    errors.push(issue("MEF-PR-02", "error", "preparer.ptin", "PTIN format must be P########"));
  }
  if (payload.preparer?.efin && !/^\d{6}$/.test(payload.preparer.efin)) {
    errors.push(issue("MEF-PR-03", "error", "preparer.efin", "EFIN must be 6 digits"));
  }

  if (payload.bank?.routingNumber) {
    if (!/^\d{9}$/.test(payload.bank.routingNumber)) {
      errors.push(issue("MEF-BNK-01", "error", "bank.routingNumber", "Routing number must be 9 digits"));
    } else if (!validRoutingChecksum(payload.bank.routingNumber)) {
      errors.push(issue("MEF-BNK-02", "error", "bank.routingNumber", "Routing number checksum failed"));
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** ABA routing number checksum */
export function validRoutingChecksum(routing: string): boolean {
  if (!/^\d{9}$/.test(routing)) return false;
  const d = routing.split("").map(Number);
  const sum =
    3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8]);
  return sum % 10 === 0;
}

/**
 * Gate for production IRS transmit — legal + technical prerequisites.
 */
export function assertProductionMefReady(): { ok: boolean; gaps: string[] } {
  const gaps: string[] = [];
  if (!process.env.IRS_EFIN?.trim()) gaps.push("IRS_EFIN missing (Electronic Filing Identification Number)");
  if (!process.env.IRS_ETIN?.trim()) gaps.push("IRS_ETIN missing (Electronic Transmitter Identification Number)");
  if (!process.env.IRS_MEF_ENDPOINT?.trim()) gaps.push("IRS_MEF_ENDPOINT missing (A2A/MeF gateway URL)");
  if (!process.env.IRS_MEF_CLIENT_CERT_PATH?.trim() && !process.env.IRS_MEF_CLIENT_CERT_PEM?.trim()) {
    gaps.push("IRS client certificate missing (IRS_MEF_CLIENT_CERT_PATH or PEM)");
  }
  if (process.env.IRS_MEF_PRODUCTION !== "true") {
    gaps.push('Set IRS_MEF_PRODUCTION=true only after IRS ATS/PATS certification and ERO approval');
  }
  if (!process.env.IRS_ERO_LEGAL_NAME?.trim()) {
    gaps.push("IRS_ERO_LEGAL_NAME missing — ERO / firm legal name required");
  }
  return { ok: gaps.length === 0, gaps };
}
