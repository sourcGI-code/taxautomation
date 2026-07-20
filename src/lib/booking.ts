import { createAdminClient } from "./supabase/admin";
import { isBefore, isAfter, startOfDay, addDays } from "date-fns";
import type { TimeSlot, AvailabilityRule, BlockedDate } from "./types";
import {
  wallTime,
  dayOfWeekInPractice,
  addCalendarDays,
  addMinutesToDate,
  getPracticeTimezone,
} from "./timezone";
import { getDefaultTaxYear } from "./tax-year";
import {
  parseTime,
  slotOverlapsBooking,
  normalizeEmail,
} from "./booking-logic";

export async function getAvailabilityRules(): Promise<AvailabilityRule[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("availability_rules")
    .select("*")
    .eq("is_active", true);
  return data || [];
}

export async function getBlockedDates(): Promise<BlockedDate[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("blocked_dates").select("*");
  return data || [];
}

export async function getBookedSlots(
  from: Date,
  to: Date
): Promise<{ starts_at: string; ends_at: string }[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("appointments")
    .select("starts_at, ends_at")
    .gte("starts_at", from.toISOString())
    .lte("starts_at", to.toISOString())
    .neq("status", "cancelled");
  return data || [];
}

export async function getAvailableSlots(
  dateStr: string,
  daysAhead = 1
): Promise<TimeSlot[]> {
  const tz = getPracticeTimezone();
  const rules = await getAvailabilityRules();
  const blocked = await getBlockedDates();
  // Normalize blocked dates to yyyy-MM-dd strings
  const blockedSet = new Set(
    blocked.map((b) => String(b.date).slice(0, 10))
  );

  // Query booked appointments with padding so timezone edges are covered
  const rangeStart = wallTime(dateStr, 0, 0, tz);
  const rangeEnd = wallTime(addCalendarDays(dateStr, daysAhead), 0, 0, tz);
  const booked = await getBookedSlots(
    new Date(rangeStart.getTime() - 12 * 60 * 60 * 1000),
    new Date(rangeEnd.getTime() + 12 * 60 * 60 * 1000)
  );

  // Deduplicate by start time — overlapping rules (e.g. two Monday ranges)
  // can otherwise emit the same slot twice and break React keys.
  const slotsByStart = new Map<string, TimeSlot>();
  const now = new Date();

  for (let i = 0; i < daysAhead; i++) {
    const dateKey = addCalendarDays(dateStr, i);
    if (blockedSet.has(dateKey)) continue;

    const dayOfWeek = dayOfWeekInPractice(dateKey, tz);
    const dayRules = rules.filter((r) => r.day_of_week === dayOfWeek);

    for (const rule of dayRules) {
      const { hours: startH, minutes: startM } = parseTime(rule.start_time);
      const { hours: endH, minutes: endM } = parseTime(rule.end_time);

      let slotStart = wallTime(dateKey, startH, startM, tz);
      const dayEnd = wallTime(dateKey, endH, endM, tz);

      while (isBefore(slotStart, dayEnd)) {
        const slotEnd = addMinutesToDate(slotStart, rule.slot_duration_minutes);

        if (
          isAfter(slotStart, now) &&
          !isAfter(slotEnd, dayEnd) &&
          !slotOverlapsBooking(slotStart, slotEnd, booked)
        ) {
          const starts_at = slotStart.toISOString();
          if (!slotsByStart.has(starts_at)) {
            slotsByStart.set(starts_at, {
              starts_at,
              ends_at: slotEnd.toISOString(),
            });
          }
        }

        slotStart = slotEnd;
      }
    }
  }

  return Array.from(slotsByStart.values()).sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );
}

export async function createBooking({
  name,
  email,
  phone,
  startsAt,
  endsAt,
  notes,
}: {
  name: string;
  email: string;
  phone?: string;
  startsAt: string;
  endsAt: string;
  notes?: string;
}) {
  const supabase = createAdminClient();

  // Check slot still available (overlap, not just exact match)
  const { data: existingAppointments } = await supabase
    .from("appointments")
    .select("starts_at, ends_at")
    .neq("status", "cancelled")
    .lt("starts_at", endsAt)
    .gt("ends_at", startsAt);

  if (existingAppointments && existingAppointments.length > 0) {
    throw new Error("This time slot is no longer available");
  }

  const emailNorm = normalizeEmail(email);

  // Upsert client
  let client;
  const { data: existingClient } = await supabase
    .from("clients")
    .select("*")
    .eq("email", emailNorm)
    .maybeSingle();

  if (existingClient) {
    // Do not reset mid-pipeline status on rebook; only restart after filed
    const restart = existingClient.status === "filed";
    const { data: updated } = await supabase
      .from("clients")
      .update({
        name,
        phone: phone || existingClient.phone,
        ...(restart
          ? {
              status: "booked",
              onboarding_step: "welcome_sent",
              signature_acknowledged_at: null,
              signed_at: null,
              signature_typed_name: null,
              signature_method: null,
              tax_year: getDefaultTaxYear(),
            }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingClient.id)
      .select()
      .single();
    client = updated;
  } else {
    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        email: emailNorm,
        name,
        phone: phone || null,
        status: "booked",
        onboarding_step: "welcome_sent",
        tax_year: getDefaultTaxYear(),
      })
      .select()
      .single();

    if (error) throw error;
    client = created;
  }

  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .insert({
      client_id: client.id,
      starts_at: startsAt,
      ends_at: endsAt,
      notes: notes || null,
      status: "scheduled",
    })
    .select()
    .single();

  if (apptError) throw apptError;

  // Create empty intake form record
  await supabase.from("intake_forms").upsert(
    { client_id: client.id, data: {} },
    { onConflict: "client_id" }
  );

  return { client, appointment };
}

export async function getClientByToken(token: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("clients")
    .select(
      `
      *,
      appointments(*),
      intake_forms(*),
      documents(*),
      activity_log(*)
    `
    )
    .eq("magic_token", token)
    .maybeSingle();

  if (!data) return null;

  if (
    data.magic_token_expires_at &&
    new Date(data.magic_token_expires_at) < new Date()
  ) {
    return null;
  }

  return data;
}

export async function getClientById(id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("clients")
    .select(
      `
      *,
      appointments(*),
      intake_forms(*),
      documents(*),
      communications(*),
      activity_log(*)
    `
    )
    .eq("id", id)
    .single();
  return data;
}

export async function getAllClients(statusFilter?: string) {
  const supabase = createAdminClient();
  let query = supabase
    .from("clients")
    .select(
      `
      *,
      appointments(starts_at, ends_at, status)
    `
    )
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data } = await query;
  return data || [];
}

export async function getDashboardStats() {
  const supabase = createAdminClient();
  const { data: clients } = await supabase.from("clients").select("status");

  const stats = {
    total: clients?.length || 0,
    booked: 0,
    intake_complete: 0,
    documents_received: 0,
    in_review: 0,
    ready_for_signature: 0,
    filed: 0,
  };

  clients?.forEach((c) => {
    const s = c.status as keyof typeof stats;
    if (s in stats && s !== "total") stats[s]++;
  });

  const today = startOfDay(new Date());
  const { count: todayAppointments } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .gte("starts_at", today.toISOString())
    .lt("starts_at", addDays(today, 1).toISOString())
    .neq("status", "cancelled");

  return { ...stats, todayAppointments: todayAppointments || 0 };
}

export async function cancelAppointment(appointmentId: string, clientId?: string) {
  const supabase = createAdminClient();
  let query = supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId)
    .neq("status", "cancelled");

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query.select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function rescheduleAppointment({
  appointmentId,
  clientId,
  startsAt,
  endsAt,
}: {
  appointmentId: string;
  clientId: string;
  startsAt: string;
  endsAt: string;
}) {
  const supabase = createAdminClient();

  const { data: existingAppointments } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at")
    .neq("status", "cancelled")
    .neq("id", appointmentId)
    .lt("starts_at", endsAt)
    .gt("ends_at", startsAt);

  if (existingAppointments && existingAppointments.length > 0) {
    throw new Error("This time slot is no longer available");
  }

  const { data, error } = await supabase
    .from("appointments")
    .update({
      starts_at: startsAt,
      ends_at: endsAt,
      status: "scheduled",
    })
    .eq("id", appointmentId)
    .eq("client_id", clientId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listAvailabilityRules(): Promise<AvailabilityRule[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("availability_rules")
    .select("*")
    .order("day_of_week")
    .order("start_time");
  return data || [];
}

export async function upsertAvailabilityRule(rule: {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
}) {
  const supabase = createAdminClient();
  if (rule.id) {
    const { data, error } = await supabase
      .from("availability_rules")
      .update({
        day_of_week: rule.day_of_week,
        start_time: rule.start_time,
        end_time: rule.end_time,
        slot_duration_minutes: rule.slot_duration_minutes,
        is_active: rule.is_active,
      })
      .eq("id", rule.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("availability_rules")
    .insert({
      day_of_week: rule.day_of_week,
      start_time: rule.start_time,
      end_time: rule.end_time,
      slot_duration_minutes: rule.slot_duration_minutes,
      is_active: rule.is_active,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAvailabilityRule(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("availability_rules").delete().eq("id", id);
  if (error) throw error;
}

export async function listBlockedDates(): Promise<BlockedDate[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("blocked_dates").select("*").order("date");
  return data || [];
}

export async function addBlockedDate(date: string, reason?: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blocked_dates")
    .upsert({ date, reason: reason || null }, { onConflict: "date" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeBlockedDate(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("blocked_dates").delete().eq("id", id);
  if (error) throw error;
}

