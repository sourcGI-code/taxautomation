import { createAdminClient } from "./supabase/admin";
import { sendEmail } from "./email";
import { sendSms } from "./sms";
import { getPortalUrl } from "./utils-portal";
import {
  welcomeEmail,
  magicLinkEmail,
  statusUpdateEmail,
  intakeReceivedEmail,
  documentsReceivedEmail,
  readyForSignatureEmail,
  filedEmail,
  appointmentReminderEmail,
  intakeReminderEmail,
  documentReminderEmail,
  customMessageEmail,
} from "./templates/emails";
import { smsTemplates } from "./templates/sms";
import { STATUS_LABELS } from "./constants";
import { STATUS_EMAIL_MAP, STATUS_SMS_MAP, CRON_SEQUENCE_KEYS } from "./sequences";
import { formatDateTime } from "./utils";
import { getMagicLinkTtlMinutes } from "./security";
import type { Client, ClientStatus } from "./types";
import { v4 as uuidv4 } from "uuid";
import { differenceInHours, differenceInDays, addHours, isBefore, isAfter } from "date-fns";

export async function logCommunication({
  clientId,
  channel,
  subject,
  body,
  status = "sent",
}: {
  clientId: string;
  channel: "email" | "sms" | "call";
  subject?: string;
  body?: string;
  status?: string;
}) {
  const supabase = createAdminClient();
  await supabase.from("communications").insert({
    client_id: clientId,
    channel,
    direction: "outbound",
    subject,
    body,
    status,
  });
}

export async function logActivity({
  clientId,
  action,
  description,
  metadata,
}: {
  clientId: string;
  action: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  await supabase.from("activity_log").insert({
    client_id: clientId,
    action,
    description,
    metadata,
  });
}

async function wasNotificationSent(
  clientId: string,
  sequenceKey: string,
  channel: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("notification_log")
    .select("id")
    .eq("client_id", clientId)
    .eq("sequence_key", sequenceKey)
    .eq("channel", channel)
    .maybeSingle();
  return !!data;
}

async function markNotificationSent(
  clientId: string,
  sequenceKey: string,
  channel: string
) {
  const supabase = createAdminClient();
  await supabase.from("notification_log").upsert(
    { client_id: clientId, sequence_key: sequenceKey, channel },
    { onConflict: "client_id,sequence_key,channel" }
  );
}

export async function generateMagicToken(clientId: string): Promise<string> {
  const supabase = createAdminClient();
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + getMagicLinkTtlMinutes());

  await supabase
    .from("clients")
    .update({
      magic_token: token,
      magic_token_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  return token;
}

/** Always issue a fresh short-lived token (never reuse long-lived links). */
async function getPortalUrlForClient(client: Client): Promise<string> {
  const token = await generateMagicToken(client.id);
  return getPortalUrl(token);
}

/** Invalidate magic link after successful use (one-time). */
export async function consumeMagicToken(clientId: string) {
  const supabase = createAdminClient();
  await supabase
    .from("clients")
    .update({
      magic_token: null,
      magic_token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);
}

function getStatusEmailHtml(
  client: Client,
  status: ClientStatus,
  portalUrl: string
): string {
  const label = STATUS_LABELS[status];
  const templateKey = STATUS_EMAIL_MAP[status];

  switch (templateKey) {
    case "intake_received":
      return intakeReceivedEmail(client.name, portalUrl);
    case "documents_received":
      return documentsReceivedEmail(client.name, portalUrl);
    case "ready_for_signature":
      return readyForSignatureEmail(client.name, portalUrl);
    case "filed":
      return filedEmail(client.name, portalUrl);
    default:
      return statusUpdateEmail(client.name, label, status, portalUrl);
  }
}

function getStatusSmsBody(client: Client, status: ClientStatus): string {
  const label = STATUS_LABELS[status];
  const templateKey = STATUS_SMS_MAP[status];

  switch (templateKey) {
    case "intakeReceived":
      return smsTemplates.intakeReceived(client.name);
    case "documentsReceived":
      return smsTemplates.documentsReceived(client.name);
    case "readyForSignature":
      return smsTemplates.readyForSignature(client.name);
    case "filed":
      return smsTemplates.filed(client.name);
    default:
      return smsTemplates.statusUpdate(client.name, label);
  }
}

export async function onBookingCreated(
  client: Client,
  appointmentStartsAt: string
) {
  const supabase = createAdminClient();
  const portalUrl = await getPortalUrlForClient(client);
  const appointmentDate = formatDateTime(appointmentStartsAt);

  // Welcome email
  await sendEmail({
    to: client.email,
    subject: `Welcome! Your appointment is confirmed — ${appointmentDate}`,
    html: welcomeEmail(client.name, portalUrl, appointmentDate),
    clientId: client.id,
  });
  await logCommunication({
    clientId: client.id,
    channel: "email",
    subject: "Welcome - Appointment Confirmed",
    body: `Portal link sent. Appointment: ${appointmentDate}`,
  });
  await markNotificationSent(client.id, "welcome", "email");

  // SMS confirmation
  if (client.phone) {
    const smsBody = smsTemplates.bookingConfirmation(client.name, appointmentDate);
    await sendSms({ to: client.phone, body: smsBody });
    await logCommunication({ clientId: client.id, channel: "sms", body: smsBody });
    await markNotificationSent(client.id, "welcome", "sms");
  }

  await supabase
    .from("clients")
    .update({
      onboarding_step: "intake_pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", client.id);

  await logActivity({
    clientId: client.id,
    action: "booking_created",
    description: `Appointment booked for ${appointmentDate}`,
    metadata: { sequence: "onboarding", step: "welcome" },
  });
}

export async function onIntakeSubmitted(client: Client) {
  const supabase = createAdminClient();

  await supabase
    .from("clients")
    .update({
      status: "intake_complete",
      onboarding_step: "documents_pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", client.id);

  const portalUrl = await getPortalUrlForClient(client);

  await sendEmail({
    to: client.email,
    subject: "Intake received — please upload your documents",
    html: intakeReceivedEmail(client.name, portalUrl),
    clientId: client.id,
  });
  await markNotificationSent(client.id, "intake_received", "email");

  if (client.phone) {
    const smsBody = smsTemplates.intakeReceived(client.name);
    await sendSms({ to: client.phone, body: smsBody });
    await logCommunication({ clientId: client.id, channel: "sms", body: smsBody });
    await markNotificationSent(client.id, "intake_received", "sms");
  }

  await logActivity({
    clientId: client.id,
    action: "intake_submitted",
    description: "Client completed intake form",
    metadata: { sequence: "post_intake", step: "intake_received" },
  });
}

export async function onDocumentUploaded(client: Client, documentName: string) {
  const supabase = createAdminClient();

  const { data: docs } = await supabase
    .from("documents")
    .select("id")
    .eq("client_id", client.id);

  if (docs && docs.length >= 1) {
    const currentStatus = client.status;
    if (currentStatus === "booked" || currentStatus === "intake_complete") {
      await supabase
        .from("clients")
        .update({
          status: "documents_received",
          onboarding_step: "documents_complete",
          updated_at: new Date().toISOString(),
        })
        .eq("id", client.id);

      const portalUrl = await getPortalUrlForClient(client);
      await sendEmail({
        to: client.email,
        subject: "Documents received — we'll begin review shortly",
        html: documentsReceivedEmail(client.name, portalUrl),
        clientId: client.id,
      });

      if (client.phone) {
        const smsBody = smsTemplates.documentsReceived(client.name);
        await sendSms({ to: client.phone, body: smsBody });
      }
    }
  }

  await logActivity({
    clientId: client.id,
    action: "document_uploaded",
    description: `Uploaded: ${documentName}`,
  });
}

export async function onStatusChanged(
  client: Client,
  newStatus: ClientStatus,
  oldStatus: ClientStatus
) {
  const portalUrl = await getPortalUrlForClient(client);
  const statusLabel = STATUS_LABELS[newStatus];

  await sendEmail({
    to: client.email,
    subject: `Status update: ${statusLabel}`,
    html: getStatusEmailHtml(client, newStatus, portalUrl),
    clientId: client.id,
  });

  if (client.phone) {
    const smsBody = getStatusSmsBody(client, newStatus);
    await sendSms({ to: client.phone, body: smsBody });
    await logCommunication({ clientId: client.id, channel: "sms", body: smsBody });
  }

  await logCommunication({
    clientId: client.id,
    channel: "email",
    subject: `Status update: ${statusLabel}`,
    body: `Changed from ${STATUS_LABELS[oldStatus]} to ${statusLabel}`,
  });

  await logActivity({
    clientId: client.id,
    action: "status_changed",
    description: `${STATUS_LABELS[oldStatus]} → ${statusLabel}`,
    metadata: { old_status: oldStatus, new_status: newStatus },
  });

  if (newStatus === "filed") {
    await createAdminClient()
      .from("clients")
      .update({ onboarding_step: "done", updated_at: new Date().toISOString() })
      .eq("id", client.id);
  }
}

export async function sendMagicLink(client: Client): Promise<{ portalUrl: string }> {
  const portalUrl = await getPortalUrlForClient(client);

  await sendEmail({
    to: client.email,
    subject: "Your client portal login link",
    html: magicLinkEmail(client.name, portalUrl),
    clientId: client.id,
  });

  await logActivity({
    clientId: client.id,
    action: "magic_link_sent",
    description: "Client requested portal login link",
  });

  return { portalUrl };
}

export async function sendCustomMessage(
  client: Client,
  message: string,
  channel: "email" | "sms" | "both",
  subject?: string
) {
  const portalUrl = await getPortalUrlForClient(client);

  if (channel === "email" || channel === "both") {
    await sendEmail({
      to: client.email,
      subject: subject || "Message from your tax preparer",
      html: customMessageEmail(client.name, message, portalUrl, subject),
      clientId: client.id,
    });
    await logCommunication({
      clientId: client.id,
      channel: "email",
      subject: subject || "Manual notification",
      body: message,
    });
  }

  if ((channel === "sms" || channel === "both") && client.phone) {
    const smsBody = smsTemplates.customReminder(client.name, message);
    await sendSms({ to: client.phone, body: smsBody });
    await logCommunication({ clientId: client.id, channel: "sms", body: message });
  }
}

/** Process scheduled reminder sequences — called by cron */
export async function processScheduledReminders(): Promise<{
  processed: number;
  details: string[];
}> {
  const supabase = createAdminClient();
  const details: string[] = [];
  let processed = 0;
  const now = new Date();

  // Fetch clients needing reminders
  const { data: clients } = await supabase
    .from("clients")
    .select(`
      *,
      appointments(starts_at, ends_at, status),
      intake_forms(submitted_at),
      documents(id)
    `)
    .not("status", "eq", "filed");

  if (!clients) return { processed: 0, details: ["No clients found"] };

  for (const client of clients) {
    const portalUrl = await getPortalUrlForClient(client as Client);
    const createdAt = new Date(client.created_at);
    const hoursSinceBooking = differenceInHours(now, createdAt);
    const daysSinceBooking = differenceInDays(now, createdAt);

    const intake = client.intake_forms?.[0];
    const hasIntake = !!intake?.submitted_at;
    const hasDocs = (client.documents?.length || 0) > 0;
    const appointment = client.appointments?.find((a: { status: string }) => a.status === "scheduled");

    // Intake reminders for booked clients without intake
    if (client.status === "booked" && !hasIntake) {
      if (hoursSinceBooking >= 24 && hoursSinceBooking < 48) {
        const key = CRON_SEQUENCE_KEYS.INTAKE_REMINDER_1;
        if (!(await wasNotificationSent(client.id, key, "email"))) {
          await sendEmail({
            to: client.email,
            subject: "Reminder: Please complete your intake form",
            html: intakeReminderEmail(client.name, portalUrl, daysSinceBooking),
            clientId: client.id,
          });
          await markNotificationSent(client.id, key, "email");
          if (client.phone && !(await wasNotificationSent(client.id, key, "sms"))) {
            await sendSms({ to: client.phone, body: smsTemplates.intakeReminder(client.name) });
            await markNotificationSent(client.id, key, "sms");
          }
          details.push(`Intake reminder 1 sent to ${client.email}`);
          processed++;
        }
      }

      if (daysSinceBooking >= 3) {
        const key = CRON_SEQUENCE_KEYS.INTAKE_REMINDER_2;
        if (!(await wasNotificationSent(client.id, key, "email"))) {
          await sendEmail({
            to: client.email,
            subject: "Second reminder: Complete your intake form",
            html: intakeReminderEmail(client.name, portalUrl, daysSinceBooking),
            clientId: client.id,
          });
          await markNotificationSent(client.id, key, "email");
          details.push(`Intake reminder 2 sent to ${client.email}`);
          processed++;
        }
      }
    }

    // Document reminders for intake_complete without docs
    if (client.status === "intake_complete" && !hasDocs && intake?.submitted_at) {
      const hoursSinceIntake = differenceInHours(now, new Date(intake.submitted_at));

      if (hoursSinceIntake >= 48 && hoursSinceIntake < 120) {
        const key = CRON_SEQUENCE_KEYS.DOCUMENT_REMINDER_1;
        if (!(await wasNotificationSent(client.id, key, "email"))) {
          await sendEmail({
            to: client.email,
            subject: "Reminder: Please upload your tax documents",
            html: documentReminderEmail(client.name, portalUrl),
            clientId: client.id,
          });
          await markNotificationSent(client.id, key, "email");
          if (client.phone && !(await wasNotificationSent(client.id, key, "sms"))) {
            await sendSms({ to: client.phone, body: smsTemplates.documentReminder(client.name) });
            await markNotificationSent(client.id, key, "sms");
          }
          details.push(`Document reminder 1 sent to ${client.email}`);
          processed++;
        }
      }

      if (hoursSinceIntake >= 120) {
        const key = CRON_SEQUENCE_KEYS.DOCUMENT_REMINDER_2;
        if (!(await wasNotificationSent(client.id, key, "email"))) {
          await sendEmail({
            to: client.email,
            subject: "Final reminder: Upload your tax documents",
            html: documentReminderEmail(client.name, portalUrl),
            clientId: client.id,
          });
          await markNotificationSent(client.id, key, "email");
          details.push(`Document reminder 2 sent to ${client.email}`);
          processed++;
        }
      }
    }

    // 24h appointment reminder
    if (appointment?.starts_at) {
      const apptTime = new Date(appointment.starts_at);
      const reminderWindow = addHours(apptTime, -24);
      const reminderEnd = addHours(apptTime, -23);

      if (isAfter(now, reminderWindow) && isBefore(now, reminderEnd)) {
        const key = CRON_SEQUENCE_KEYS.APPOINTMENT_REMINDER_24H;
        const apptDate = formatDateTime(appointment.starts_at);

        if (!(await wasNotificationSent(client.id, key, "email"))) {
          await sendEmail({
            to: client.email,
            subject: `Reminder: Your appointment is tomorrow — ${apptDate}`,
            html: appointmentReminderEmail(client.name, apptDate, portalUrl),
            clientId: client.id,
          });
          await markNotificationSent(client.id, key, "email");
          if (client.phone && !(await wasNotificationSent(client.id, key, "sms"))) {
            await sendSms({
              to: client.phone,
              body: smsTemplates.appointmentReminder(client.name, apptDate),
            });
            await markNotificationSent(client.id, key, "sms");
          }
          details.push(`Appointment reminder sent to ${client.email}`);
          processed++;
        }
      }
    }
  }

  if (processed === 0) details.push("No reminders due at this time");
  return { processed, details };
}
