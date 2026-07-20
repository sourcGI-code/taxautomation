export const MEF_STATUSES = [
  "draft",
  "validated",
  "ready_to_transmit",
  "transmitting",
  "accepted",
  "rejected",
  "exception",
  "cancelled",
] as const;

export type MefStatus = (typeof MEF_STATUSES)[number];

export const MEF_FORM_TYPES = ["1040", "1040-SR", "1040-NR"] as const;
export type MefFormType = (typeof MEF_FORM_TYPES)[number];

export type MefEnvironment = "sandbox" | "production";

export type MefValidationIssue = {
  code: string;
  severity: "error" | "warning";
  path: string;
  message: string;
};

export type MefReturnPayload = {
  taxYear: number;
  formType: MefFormType;
  taxpayer: {
    firstName: string;
    lastName: string;
    ssnLastFour?: string;
    ssnFull?: string; // never log; only used in-memory for package
    dateOfBirth?: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    filingStatus: string;
    email?: string;
    phone?: string;
  };
  spouse?: {
    firstName: string;
    lastName: string;
    ssnLastFour?: string;
  };
  income: {
    wages?: number;
    interest?: number;
    dividends?: number;
    businessIncome?: number;
    capitalGains?: number;
    otherIncome?: number;
  };
  deductions: {
    standardOrItemized: "standard" | "itemized";
    amount?: number;
  };
  tax: {
    totalTax?: number;
    withholdings?: number;
    estimatedPayments?: number;
    refundOrOwe?: number;
  };
  bank?: {
    routingNumber?: string;
    accountNumberLast4?: string;
    accountType?: "checking" | "savings";
  };
  preparer: {
    name: string;
    ptin?: string;
    efin?: string;
    firmName?: string;
  };
};

export type MefSubmissionRow = {
  id: string;
  client_id: string;
  tax_year: number;
  form_type: string;
  submission_id: string | null;
  transmission_id: string | null;
  status: MefStatus;
  package_xml: string | null;
  manifest_xml: string | null;
  validation_errors: MefValidationIssue[];
  validation_warnings: MefValidationIssue[];
  ack_xml: string | null;
  ack_code: string | null;
  ack_message: string | null;
  efin: string | null;
  etin: string | null;
  environment: MefEnvironment;
  prepared_by: string | null;
  transmitted_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
