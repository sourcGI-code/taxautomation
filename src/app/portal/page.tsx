"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusTracker } from "@/components/status-tracker";
import { STATUS_LABELS } from "@/lib/constants";
import { formatDateTime, formatTime } from "@/lib/utils";
import { calendarDateInPractice, todayInPractice } from "@/lib/timezone";
import type { ClientWithRelations, ClientStatus, TimeSlot } from "@/lib/types";
import {
  Calendar,
  FileText,
  Upload,
  ClipboardList,
  ArrowRight,
  CheckCircle,
  PenLine,
} from "lucide-react";
import { SignaturePad } from "@/components/signature-pad";

function PortalContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [client, setClient] = useState<ClientWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [dsEnvelopes, setDsEnvelopes] = useState<
    { envelope_id: string; status: string; signing_url?: string | null; subject?: string }[]
  >([]);

  const fetchClient = useCallback(async () => {
    if (token) {
      window.location.href = `/api/auth/verify?token=${token}`;
      return;
    }

    try {
      const res = await fetch("/api/portal");
      if (!res.ok) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      setClient(data.client);
    } catch {
      window.location.href = "/login";
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  useEffect(() => {
    if (!client) return;
    fetch("/api/portal/docusign")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.envelopes) setDsEnvelopes(d.envelopes);
      })
      .catch(() => {});
  }, [client]);

  const appointment = client?.appointments
    ?.filter((a) => a.status === "scheduled")
    .sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    )[0];

  const cancelAppointment = async () => {
    if (!appointment) return;
    if (!confirm("Cancel this appointment?")) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch("/api/portal/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", appointmentId: appointment.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cancel failed");
      setActionMsg("Appointment cancelled");
      await fetchClient();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setActionLoading(false);
    }
  };

  const openReschedule = async () => {
    setRescheduleOpen(true);
    setSlotsLoading(true);
    setActionError("");
    try {
      const start = todayInPractice();
      const res = await fetch(`/api/booking/slots?date=${start}&days=14`);
      const data = await res.json();
      setSlots(data.slots || []);
    } catch {
      setActionError("Failed to load available times");
    } finally {
      setSlotsLoading(false);
    }
  };

  const rescheduleTo = async (slot: TimeSlot) => {
    if (!appointment) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch("/api/portal/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reschedule",
          appointmentId: appointment.id,
          startsAt: slot.starts_at,
          endsAt: slot.ends_at,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reschedule failed");
      setActionMsg("Appointment rescheduled");
      setRescheduleOpen(false);
      await fetchClient();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Reschedule failed");
    } finally {
      setActionLoading(false);
    }
  };

  const completeDocuSignSim = async (envelopeId: string) => {
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch("/api/portal/docusign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete_sim", envelopeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setActionMsg("DocuSign signature completed");
      await fetchClient();
      const ds = await fetch("/api/portal/docusign").then((r) => r.json());
      setDsEnvelopes(ds.envelopes || []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const submitSignature = async (payload: {
    typedName: string;
    agreedToElectronicSignature: true;
    signatureDataUrl: string | null;
    consentText: string;
  }) => {
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch("/api/portal/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Signature failed"
        );
      }
      setActionMsg("Signature recorded — your preparer will complete filing.");
      await fetchClient();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed");
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || token) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500">Loading your portal...</p>
      </div>
    );
  }

  if (!client) return null;

  const intake = client.intake_forms?.[0];
  const hasIntake = !!intake?.submitted_at;
  const docCount = client.documents?.length || 0;
  const status = client.status as ClientStatus;

  const slotsByDate = slots.reduce<Record<string, TimeSlot[]>>((acc, slot) => {
    const date = calendarDateInPractice(slot.starts_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {});

  return (
    <>
      <Header showNav={false} />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Welcome, {client.name.split(" ")[0]}
            </h1>
            <p className="text-slate-600">Your secure client portal</p>
          </div>
          {client.tax_year && (
            <Badge className="bg-slate-100 text-slate-700">
              Tax year {client.tax_year}
            </Badge>
          )}
        </div>

        {actionError && <p className="text-sm text-red-600 mb-4">{actionError}</p>}
        {actionMsg && <p className="text-sm text-green-600 mb-4">{actionMsg}</p>}

        {!(client as { engagement_accepted_at?: string | null }).engagement_accepted_at && (
          <Card className="mb-6 border-navy-200 bg-navy-50/40">
            <CardContent className="py-5 space-y-3">
              <p className="font-medium text-slate-900">Engagement letter</p>
              <p className="text-sm text-slate-600">
                Please review and accept our engagement terms to continue your tax preparation.
              </p>
              <div className="flex flex-wrap gap-2">
                <a href="/legal/engagement" target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    Read engagement letter
                  </Button>
                </a>
                <Button
                  size="sm"
                  loading={actionLoading}
                  onClick={async () => {
                    setActionLoading(true);
                    setActionError("");
                    try {
                      const res = await fetch("/api/legal/engagement", {
                        method: "POST",
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "Failed");
                      setActionMsg("Engagement accepted");
                      await fetchClient();
                    } catch (e) {
                      setActionError(e instanceof Error ? e.message : "Failed");
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                >
                  I accept the engagement
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Your Progress</CardTitle>
              <Badge status={status}>{STATUS_LABELS[status]}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <StatusTracker currentStatus={status} />
          </CardContent>
        </Card>

        {status === "ready_for_signature" && (
          <Card className="mb-6 border-orange-200 bg-orange-50/40 shadow-md">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                  <PenLine className="w-5 h-5 text-orange-700" />
                </div>
                <div>
                  <CardTitle className="text-base">Electronic signature</CardTitle>
                  <p className="text-sm text-slate-600 mt-1">
                    {client.signed_at || client.signature_acknowledged_at
                      ? `Signed ${new Date(
                          (client.signed_at ||
                            client.signature_acknowledged_at) as string
                        ).toLocaleString()}${
                          client.signature_typed_name
                            ? ` by ${client.signature_typed_name}`
                            : ""
                        }${
                          client.signature_method === "docusign"
                            ? " via DocuSign"
                            : ""
                        }`
                      : "Prefer DocuSign (certified) when your preparer sends an envelope, or use the in-portal signature below."}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {dsEnvelopes.length > 0 && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                  <p className="text-sm font-medium text-slate-900">
                    DocuSign certified e-sign
                  </p>
                  {dsEnvelopes.map((e) => (
                    <div
                      key={e.envelope_id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                    >
                      <span className="text-slate-600">
                        {e.subject || "Tax return authorization"} —{" "}
                        <span className="font-medium">{e.status}</span>
                      </span>
                      <div className="flex gap-2">
                        {e.signing_url && e.status !== "completed" && (
                          <a href={e.signing_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="secondary">
                              Open DocuSign
                            </Button>
                          </a>
                        )}
                        {e.envelope_id.startsWith("SIM-") &&
                          e.status !== "completed" && (
                            <Button
                              size="sm"
                              onClick={() => completeDocuSignSim(e.envelope_id)}
                              loading={actionLoading}
                            >
                              Complete simulator sign
                            </Button>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {client.signed_at || client.signature_acknowledged_at ? (
                <span className="inline-flex items-center gap-2 text-sm text-green-700 font-medium">
                  <CheckCircle className="w-5 h-5" />
                  Signature on file — waiting for staff e-file
                </span>
              ) : (
                <>
                  <p className="text-xs text-slate-500">
                    In-portal signature (ESIGN/UETA style audit). For DocuSign Certificate of
                    Completion, use the DocuSign button when an envelope is available.
                  </p>
                  <SignaturePad
                    clientName={client.name}
                    loading={actionLoading}
                    onSubmit={submitSignature}
                  />
                </>
              )}
            </CardContent>
          </Card>
        )}

        {appointment && (
          <Card className="mb-6">
            <CardContent className="py-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-navy-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-navy-700" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Upcoming Appointment</p>
                    <p className="text-sm text-slate-600">
                      {formatDateTime(appointment.starts_at)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={openReschedule}
                    disabled={actionLoading}
                  >
                    Reschedule
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cancelAppointment}
                    disabled={actionLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>

              {rescheduleOpen && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    Pick a new time (next 14 days)
                  </p>
                  {slotsLoading ? (
                    <p className="text-sm text-slate-500">Loading slots...</p>
                  ) : Object.keys(slotsByDate).length === 0 ? (
                    <p className="text-sm text-slate-500">No open slots right now.</p>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {Object.entries(slotsByDate)
                        .slice(0, 7)
                        .map(([date, daySlots]) => (
                          <div key={date}>
                            <p className="text-xs font-medium text-slate-500 mb-1">
                              {date}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {daySlots.map((slot, idx) => (
                                <button
                                  key={`${slot.starts_at}-${idx}`}
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() => rescheduleTo(slot)}
                                  className="text-xs px-2 py-1 rounded border border-slate-200 hover:border-navy-500 hover:bg-navy-50"
                                >
                                  {formatTime(slot.starts_at)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    onClick={() => setRescheduleOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!appointment && (
          <Card className="mb-6">
            <CardContent className="py-4 flex items-center justify-between">
              <p className="text-sm text-slate-600">No upcoming appointment scheduled.</p>
              <Link href="/book">
                <Button size="sm">Book appointment</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <Link href="/portal/intake">
            <Card className="hover:border-navy-300 transition-colors cursor-pointer h-full">
              <CardContent className="py-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                      {hasIntake ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <ClipboardList className="w-5 h-5 text-indigo-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Intake Form</p>
                      <p className="text-sm text-slate-600">
                        {hasIntake
                          ? "Completed"
                          : "Required — tell us about your tax situation"}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/portal/documents">
            <Card className="hover:border-navy-300 transition-colors cursor-pointer h-full">
              <CardContent className="py-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Upload className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Documents</p>
                      <p className="text-sm text-slate-600">
                        {docCount > 0
                          ? `${docCount} file${docCount > 1 ? "s" : ""} uploaded`
                          : "Upload W-2s, 1099s, and more"}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {client.activity_log && client.activity_log.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {client.activity_log
                  .sort(
                    (a, b) =>
                      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  )
                  .slice(0, 5)
                  .map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 text-sm">
                      <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-slate-700">{entry.description}</p>
                        <p className="text-slate-400 text-xs">
                          {new Date(entry.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}

export default function PortalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center text-slate-500">
          Loading...
        </div>
      }
    >
      <PortalContent />
    </Suspense>
  );
}
