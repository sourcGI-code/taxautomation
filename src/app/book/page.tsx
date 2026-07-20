"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDate, formatTime } from "@/lib/utils";
import {
  calendarDateInPractice,
  todayInPractice,
  addCalendarDays,
  getPracticeTimezone,
} from "@/lib/timezone";
import { Calendar, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import type { TimeSlot } from "@/lib/types";

export default function BookPage() {
  const [step, setStep] = useState<"slot" | "details" | "done">("slot");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [weekStart, setWeekStart] = useState(todayInPractice());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    website: "", // honeypot — leave empty
  });
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const tzLabel = getPracticeTimezone().replace(/_/g, " ");

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/booking/slots?date=${weekStart}&days=7`);
      const data = await res.json();
      setSlots(data.slots || []);
    } catch {
      setError("Failed to load available times");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const slotsByDate = slots.reduce<Record<string, TimeSlot[]>>((acc, slot) => {
    const date = calendarDateInPractice(slot.starts_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    if (!acceptedLegal) {
      setError("You must accept the Privacy Policy, Terms, and electronic communications disclosure to book.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          startsAt: selectedSlot.starts_at,
          endsAt: selectedSlot.ends_at,
          acceptedLegal: true as const,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Booking failed");

      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 w-full">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Book an Appointment</h1>
        <p className="text-slate-600 mb-8">
          Select a time that works for you. You&apos;ll receive a confirmation email with portal access.
        </p>

        {step === "slot" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Select a Time</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWeekStart(addCalendarDays(weekStart, -7))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWeekStart(addCalendarDays(weekStart, 7))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <CardDescription>All times shown in {tzLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-slate-500 py-8">Loading available times...</p>
              ) : Object.keys(slotsByDate).length === 0 ? (
                <p className="text-center text-slate-500 py-8">No available times this week. Try next week.</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(slotsByDate).map(([date, daySlots]) => (
                    <div key={date}>
                      <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-navy-700" />
                        {formatDate(date)}
                      </h3>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {daySlots.map((slot, idx) => (
                          <button
                            key={`${slot.starts_at}-${slot.ends_at}-${idx}`}
                            type="button"
                            onClick={() => {
                              setSelectedSlot(slot);
                              setStep("details");
                            }}
                            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                              selectedSlot?.starts_at === slot.starts_at
                                ? "bg-navy-700 text-white border-navy-700"
                                : "border-slate-200 hover:border-navy-500 hover:bg-navy-50"
                            }`}
                          >
                            {formatTime(slot.starts_at)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === "details" && selectedSlot && (
          <Card>
            <CardHeader>
              <CardTitle>Your Details</CardTitle>
              <CardDescription>
                {formatDate(selectedSlot.starts_at)} at {formatTime(selectedSlot.starts_at)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                  <Input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                  <Input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone (for SMS reminders)</label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Any special circumstances?"
                  />
                </div>

                {/* Honeypot for bots — hidden from real users */}
                <div
                  aria-hidden="true"
                  className="absolute -left-[9999px] opacity-0 h-0 w-0 overflow-hidden"
                  tabIndex={-1}
                >
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    name="website"
                    type="text"
                    autoComplete="off"
                    tabIndex={-1}
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                  />
                </div>

                <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-3 bg-slate-50">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={acceptedLegal}
                    onChange={(e) => setAcceptedLegal(e.target.checked)}
                    required
                  />
                  <span>
                    I agree to the{" "}
                    <a href="/privacy" target="_blank" className="text-navy-700 underline">
                      Privacy Policy
                    </a>
                    ,{" "}
                    <a href="/terms" target="_blank" className="text-navy-700 underline">
                      Terms of Use
                    </a>
                    , electronic communications (email/SMS), and electronic signatures under the ESIGN Act for this engagement.
                  </span>
                </label>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setStep("slot")}>
                    Back
                  </Button>
                  <Button
                    type="submit"
                    loading={submitting}
                    className="flex-1"
                    disabled={!acceptedLegal}
                  >
                    Confirm Booking
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "done" && selectedSlot && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">You&apos;re Booked!</h2>
              <p className="text-slate-600 mb-2">
                {formatDate(selectedSlot.starts_at)} at {formatTime(selectedSlot.starts_at)}
              </p>
              <p className="text-slate-600 mb-8">
                Check your email for a portal link to complete your intake form and upload documents.
              </p>
              <Button onClick={() => (window.location.href = "/portal")}>
                Go to Client Portal
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
