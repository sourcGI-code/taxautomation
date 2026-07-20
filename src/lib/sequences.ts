import type { ClientStatus } from "./types";

export interface SequenceStep {
  key: string;
  delayHours: number;
  channels: ("email" | "sms")[];
  description: string;
}

export interface SequenceDefinition {
  id: string;
  name: string;
  trigger: string;
  steps: SequenceStep[];
}

/** Automated sequences triggered by client events */
export const SEQUENCES: SequenceDefinition[] = [
  {
    id: "onboarding",
    name: "Post-Booking Onboarding",
    trigger: "booking_created",
    steps: [
      {
        key: "welcome",
        delayHours: 0,
        channels: ["email", "sms"],
        description: "Welcome email + SMS with portal link",
      },
      {
        key: "intake_reminder_1",
        delayHours: 24,
        channels: ["email", "sms"],
        description: "Intake form reminder (24h after booking)",
      },
      {
        key: "intake_reminder_2",
        delayHours: 72,
        channels: ["email"],
        description: "Intake form reminder (3 days after booking)",
      },
    ],
  },
  {
    id: "post_intake",
    name: "Post-Intake Document Collection",
    trigger: "intake_submitted",
    steps: [
      {
        key: "intake_received",
        delayHours: 0,
        channels: ["email", "sms"],
        description: "Intake received + upload docs prompt",
      },
      {
        key: "document_reminder_1",
        delayHours: 48,
        channels: ["email", "sms"],
        description: "Document upload reminder (2 days)",
      },
      {
        key: "document_reminder_2",
        delayHours: 120,
        channels: ["email"],
        description: "Document upload reminder (5 days)",
      },
    ],
  },
  {
    id: "appointment",
    name: "Appointment Reminders",
    trigger: "booking_created",
    steps: [
      {
        key: "appointment_reminder_24h",
        delayHours: -24,
        channels: ["email", "sms"],
        description: "24-hour appointment reminder (relative to appointment time)",
      },
    ],
  },
];

/** Status-specific email templates */
export const STATUS_EMAIL_MAP: Partial<Record<ClientStatus, string>> = {
  intake_complete: "intake_received",
  documents_received: "documents_received",
  ready_for_signature: "ready_for_signature",
  filed: "filed",
};

export const STATUS_SMS_MAP: Partial<Record<ClientStatus, keyof typeof import("./sms").smsTemplates>> = {
  intake_complete: "intakeReceived",
  documents_received: "documentsReceived",
  ready_for_signature: "readyForSignature",
  filed: "filed",
};

/** Reminder sequence keys checked by cron */
export const CRON_SEQUENCE_KEYS = {
  INTAKE_REMINDER_1: "intake_reminder_1",
  INTAKE_REMINDER_2: "intake_reminder_2",
  DOCUMENT_REMINDER_1: "document_reminder_1",
  DOCUMENT_REMINDER_2: "document_reminder_2",
  APPOINTMENT_REMINDER_24H: "appointment_reminder_24h",
} as const;
