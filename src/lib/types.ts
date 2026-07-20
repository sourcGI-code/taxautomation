export const CLIENT_STATUSES = [
  "booked",
  "intake_complete",
  "documents_received",
  "in_review",
  "ready_for_signature",
  "filed",
] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const ONBOARDING_STEPS = [
  "welcome_sent",
  "intake_pending",
  "intake_complete",
  "documents_pending",
  "documents_complete",
  "done",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface Client {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  status: ClientStatus;
  onboarding_step: OnboardingStep;
  magic_token: string | null;
  magic_token_expires_at: string | null;
  tax_year: number | null;
  staff_notes: string | null;
  signature_acknowledged_at: string | null;
  assigned_preparer_id?: string | null;
  assigned_preparer_name?: string | null;
  signature_typed_name?: string | null;
  signature_method?: string | null;
  signature_ip?: string | null;
  signature_user_agent?: string | null;
  signed_at?: string | null;
  efile_status?: string | null;
  docusign_envelope_id?: string | null;
  docusign_status?: string | null;
  mef_submission_id?: string | null;
  engagement_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
  retention_hold?: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ESignature {
  id: string;
  client_id: string;
  typed_name: string;
  method: string;
  consent_text: string;
  signature_data_url: string | null;
  ip: string | null;
  user_agent: string | null;
  signed_at: string;
  created_at: string;
}

export interface StaffMember {
  id: string;
  email: string;
  name: string;
  role: "owner" | "preparer" | "viewer";
  is_active: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  client_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  cal_event_id: string | null;
  created_at: string;
}

export interface IntakeForm {
  id: string;
  client_id: string;
  data: IntakeFormData;
  submitted_at: string | null;
  created_at: string;
}

export interface IntakeFormData {
  filing_status?: string;
  dependents?: number;
  has_w2?: boolean;
  has_1099?: boolean;
  has_investments?: boolean;
  has_rental_income?: boolean;
  has_business_income?: boolean;
  prior_year_filed?: boolean;
  additional_notes?: string;
  ssn_last_four?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface Document {
  id: string;
  client_id: string;
  name: string;
  /** Server-only; may be omitted on portal responses */
  file_path?: string;
  file_size: number | null;
  mime_type: string | null;
  category: string | null;
  uploaded_at: string;
  encrypted?: boolean;
  encryption_iv?: string | null;
  encryption_auth_tag?: string | null;
}

export interface Communication {
  id: string;
  client_id: string;
  channel: "email" | "sms" | "call";
  direction: "inbound" | "outbound";
  subject: string | null;
  body: string | null;
  status: string;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  client_id: string;
  action: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AvailabilityRule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
}

export interface BlockedDate {
  id: string;
  date: string;
  reason: string | null;
}

export interface TimeSlot {
  starts_at: string;
  ends_at: string;
}

export interface ClientWithRelations extends Client {
  appointments?: Appointment[];
  intake_forms?: IntakeForm[];
  documents?: Document[];
  communications?: Communication[];
  activity_log?: ActivityLogEntry[];
}
