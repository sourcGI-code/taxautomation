import type { ClientStatus } from "./types";

export const STATUS_LABELS: Record<ClientStatus, string> = {
  booked: "Booked",
  intake_complete: "Intake Complete",
  documents_received: "Documents Received",
  in_review: "In Review",
  ready_for_signature: "Ready for Signature",
  filed: "Filed",
};

export const STATUS_DESCRIPTIONS: Record<ClientStatus, string> = {
  booked: "Your appointment is scheduled. Please complete your intake form.",
  intake_complete: "Intake received. Please upload your tax documents.",
  documents_received: "We have your documents and will begin review shortly.",
  in_review: "Your return is being prepared by our team.",
  ready_for_signature: "Your return is ready. Please review and sign.",
  filed: "Your return has been filed. Thank you!",
};

export const STATUS_COLORS: Record<ClientStatus, string> = {
  booked: "bg-blue-100 text-blue-800",
  intake_complete: "bg-indigo-100 text-indigo-800",
  documents_received: "bg-purple-100 text-purple-800",
  in_review: "bg-amber-100 text-amber-800",
  ready_for_signature: "bg-orange-100 text-orange-800",
  filed: "bg-green-100 text-green-800",
};

export const STATUS_ORDER: ClientStatus[] = [
  "booked",
  "intake_complete",
  "documents_received",
  "in_review",
  "ready_for_signature",
  "filed",
];

export const REQUIRED_DOCUMENTS = [
  { id: "w2", label: "W-2 Forms", description: "From all employers" },
  { id: "1099", label: "1099 Forms", description: "Interest, dividends, freelance" },
  { id: "id", label: "Photo ID", description: "Driver's license or passport" },
  { id: "prior_return", label: "Prior Year Return", description: "If applicable" },
  { id: "other", label: "Other Documents", description: "Mortgage interest, donations, etc." },
];

export const FILING_STATUS_OPTIONS = [
  "Single",
  "Married Filing Jointly",
  "Married Filing Separately",
  "Head of Household",
  "Qualifying Widow(er)",
];
