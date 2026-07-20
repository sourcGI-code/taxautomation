import { getPracticeConfig } from "./email-layout";
import { getAppUrl } from "../utils";

function firstName(name: string): string {
  return name.split(" ")[0];
}

function practiceName(): string {
  return getPracticeConfig().name;
}

function portalShortUrl(): string {
  return getAppUrl("/portal");
}

export const smsTemplates = {
  bookingConfirmation(name: string, appointmentDate: string) {
    return `Hi ${firstName(name)}, your ${practiceName()} appointment is confirmed for ${appointmentDate}. Check your email for portal access to complete intake & upload docs.`;
  },

  magicLinkSent(name: string) {
    return `Hi ${firstName(name)}, your ${practiceName()} portal login link was sent to your email. Check your inbox to access your account.`;
  },

  statusUpdate(name: string, status: string) {
    return `${practiceName()}: Hi ${firstName(name)}, your return status is now "${status}". View details: ${portalShortUrl()}`;
  },

  intakeReceived(name: string) {
    return `Hi ${firstName(name)}, we received your intake form! Next step: upload your tax docs at ${portalShortUrl()}`;
  },

  documentsReceived(name: string) {
    return `Hi ${firstName(name)}, we've received your documents and will begin review. We'll notify you of any updates. - ${practiceName()}`;
  },

  readyForSignature(name: string) {
    return `${practiceName()}: Hi ${firstName(name)}, your return is ready for review & signature! Log in: ${portalShortUrl()}`;
  },

  filed(name: string) {
    return `Hi ${firstName(name)}, your tax return has been filed! Thank you for choosing ${practiceName()}. View your portal: ${portalShortUrl()}`;
  },

  appointmentReminder(name: string, appointmentDate: string) {
    return `Reminder: Hi ${firstName(name)}, your tax appointment is tomorrow (${appointmentDate}). Complete intake & upload docs beforehand: ${portalShortUrl()}`;
  },

  intakeReminder(name: string) {
    return `Hi ${firstName(name)}, please complete your intake form before your appointment: ${portalShortUrl()} - ${practiceName()}`;
  },

  documentReminder(name: string) {
    return `Hi ${firstName(name)}, we're still waiting on your tax documents. Upload here: ${portalShortUrl()} - ${practiceName()}`;
  },

  customReminder(name: string, message: string) {
    return `Hi ${firstName(name)}, ${message} - ${practiceName()}`;
  },
};

export type SmsTemplateKey = keyof typeof smsTemplates;
