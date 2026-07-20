import {
  emailLayout,
  emailButton,
  emailHeading,
  emailParagraph,
  emailInfoBox,
  emailChecklist,
  emailSmall,
  getPracticeConfig,
  escapeHtml,
} from "./email-layout";
import { STATUS_DESCRIPTIONS } from "../constants";
import type { ClientStatus } from "../types";

const NEXT_STEPS_AFTER_BOOKING = [
  "Complete your intake form (5 minutes)",
  "Upload W-2s, 1099s, and photo ID",
  "Review your info before your appointment",
];

const DOCUMENTS_CHECKLIST = [
  "W-2 forms from all employers",
  "1099 forms (interest, dividends, freelance)",
  "Photo ID (driver's license or passport)",
  "Prior year return (if applicable)",
  "Mortgage interest, donations, or other deductions",
];

export function welcomeEmail(name: string, portalUrl: string, appointmentDate: string) {
  const practice = getPracticeConfig();
  const firstName = escapeHtml(name.split(" ")[0]);

  return emailLayout({
    preheader: `Your appointment is confirmed for ${appointmentDate}. Complete your intake before your visit.`,
    body: `
      ${emailHeading(`Welcome, ${firstName}!`)}
      ${emailParagraph(`Thank you for booking with <strong>${escapeHtml(practice.name)}</strong>. Your appointment is confirmed and your secure client portal is ready.`)}
      ${emailInfoBox([
        { label: "Appointment", value: appointmentDate },
        { label: "Portal", value: "Ready — complete intake & upload docs" },
      ])}
      ${emailParagraph("<strong>Before your appointment, please:</strong>")}
      ${emailChecklist(NEXT_STEPS_AFTER_BOOKING)}
      ${emailButton(portalUrl, "Open Client Portal")}
      ${emailSmall("This link is unique to you and expires in 7 days. Do not share it with others.")}
    `,
  });
}

export function magicLinkEmail(name: string, portalUrl: string) {
  const firstName = escapeHtml(name.split(" ")[0]);

  return emailLayout({
    preheader: "Your secure login link to the client portal.",
    body: `
      ${emailHeading(`Hi ${firstName},`)}
      ${emailParagraph("Click the button below to access your secure client portal. You can view your status, complete forms, and upload documents.")}
      ${emailButton(portalUrl, "Access Client Portal")}
      ${emailSmall("This link expires in 7 days. If you didn't request this, you can safely ignore this email.")}
    `,
  });
}

export function statusUpdateEmail(
  name: string,
  status: string,
  statusKey: ClientStatus,
  portalUrl: string
) {
  const firstName = escapeHtml(name.split(" ")[0]);
  const description = STATUS_DESCRIPTIONS[statusKey];

  return emailLayout({
    preheader: `Your return status is now: ${status}`,
    body: `
      ${emailHeading(`Status Update`)}
      ${emailParagraph(`Hi ${firstName},`)}
      ${emailParagraph(`Your tax return status has been updated:`)}
      ${emailInfoBox([{ label: "Current Status", value: status }])}
      ${emailParagraph(description)}
      ${emailButton(portalUrl, "View in Portal")}
    `,
  });
}

export function intakeReceivedEmail(name: string, portalUrl: string) {
  const firstName = escapeHtml(name.split(" ")[0]);

  return emailLayout({
    preheader: "Intake received — please upload your tax documents.",
    body: `
      ${emailHeading("Intake Form Received")}
      ${emailParagraph(`Hi ${firstName}, thank you for completing your intake form.`)}
      ${emailParagraph("<strong>Next step:</strong> Upload your tax documents through the portal. Here's what we typically need:")}
      ${emailChecklist(DOCUMENTS_CHECKLIST)}
      ${emailButton(portalUrl, "Upload Documents")}
      ${emailSmall("You can upload PDF, JPG, or PNG files up to 10MB each.")}
    `,
  });
}

export function documentsReceivedEmail(name: string, portalUrl: string) {
  const firstName = escapeHtml(name.split(" ")[0]);

  return emailLayout({
    preheader: "We've received your documents and will begin review shortly.",
    body: `
      ${emailHeading("Documents Received")}
      ${emailParagraph(`Hi ${firstName}, we've received your uploaded documents.`)}
      ${emailParagraph("Our team will review everything and begin preparing your return. We'll notify you when there are updates or if we need anything else.")}
      ${emailButton(portalUrl, "View Portal")}
    `,
  });
}

export function readyForSignatureEmail(name: string, portalUrl: string) {
  const firstName = escapeHtml(name.split(" ")[0]);

  return emailLayout({
    preheader: "Your tax return is ready for your review and signature.",
    body: `
      ${emailHeading("Ready for Signature")}
      ${emailParagraph(`Hi ${firstName}, great news — your tax return is ready!`)}
      ${emailParagraph("Please log in to your portal to review the final return and provide your signature. If you have any questions, reply to this email or call our office.")}
      ${emailButton(portalUrl, "Review & Sign")}
    `,
  });
}

export function filedEmail(name: string, portalUrl: string) {
  const firstName = escapeHtml(name.split(" ")[0]);
  const practice = getPracticeConfig();

  return emailLayout({
    preheader: "Your tax return has been filed. Thank you!",
    body: `
      ${emailHeading("Return Filed Successfully")}
      ${emailParagraph(`Hi ${firstName}, your tax return has been filed with the IRS.`)}
      ${emailParagraph(`Thank you for choosing <strong>${escapeHtml(practice.name)}</strong>. A copy of your filed return is available in your portal for your records.`)}
      ${emailButton(portalUrl, "View Filed Return")}
      ${emailSmall("Keep this email for your records. We appreciate your business!")}
    `,
  });
}

export function reminderEmail(
  name: string,
  title: string,
  message: string,
  portalUrl: string,
  ctaLabel = "Open Client Portal"
) {
  const firstName = escapeHtml(name.split(" ")[0]);

  return emailLayout({
    preheader: message.replace(/<[^>]*>/g, "").slice(0, 100),
    body: `
      ${emailHeading(title)}
      ${emailParagraph(`Hi ${firstName},`)}
      ${emailParagraph(message)}
      ${emailButton(portalUrl, ctaLabel)}
    `,
  });
}

export function appointmentReminderEmail(
  name: string,
  appointmentDate: string,
  portalUrl: string
) {
  const firstName = escapeHtml(name.split(" ")[0]);

  return emailLayout({
    preheader: `Reminder: Your tax appointment is tomorrow at ${appointmentDate}`,
    body: `
      ${emailHeading("Appointment Reminder")}
      ${emailParagraph(`Hi ${firstName}, this is a friendly reminder about your upcoming appointment.`)}
      ${emailInfoBox([{ label: "When", value: appointmentDate }])}
      ${emailParagraph("If you haven't completed your intake form or uploaded documents yet, please do so before your visit to save time.")}
      ${emailButton(portalUrl, "Complete Intake & Upload Docs")}
    `,
  });
}

export function intakeReminderEmail(name: string, portalUrl: string, daysSinceBooking: number) {
  const firstName = escapeHtml(name.split(" ")[0]);

  return emailLayout({
    preheader: "Please complete your intake form before your appointment.",
    body: `
      ${emailHeading("Intake Form Reminder")}
      ${emailParagraph(`Hi ${firstName}, we noticed your intake form hasn't been completed yet.`)}
      ${emailParagraph(`Completing it now (takes about 5 minutes) helps us prepare for your appointment and speeds up the filing process.`)}
      ${emailButton(portalUrl, "Complete Intake Form")}
      ${emailSmall(`You booked ${daysSinceBooking} day${daysSinceBooking === 1 ? "" : "s"} ago.`)}
    `,
  });
}

export function documentReminderEmail(name: string, portalUrl: string) {
  const firstName = escapeHtml(name.split(" ")[0]);

  return emailLayout({
    preheader: "Don't forget to upload your tax documents.",
    body: `
      ${emailHeading("Document Upload Reminder")}
      ${emailParagraph(`Hi ${firstName}, your intake form is complete — thank you!`)}
      ${emailParagraph("We're still waiting on your tax documents. Please upload:")}
      ${emailChecklist(DOCUMENTS_CHECKLIST)}
      ${emailButton(portalUrl, "Upload Documents")}
    `,
  });
}

export function customMessageEmail(
  name: string,
  message: string,
  portalUrl: string,
  subject?: string
) {
  const firstName = escapeHtml(name.split(" ")[0]);

  return emailLayout({
    preheader: subject || message.slice(0, 100),
    body: `
      ${emailHeading(subject || "Message from Your Tax Preparer")}
      ${emailParagraph(`Hi ${firstName},`)}
      ${emailParagraph(escapeHtml(message))}
      ${emailButton(portalUrl, "Open Client Portal")}
    `,
  });
}
