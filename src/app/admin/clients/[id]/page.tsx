"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { ClientWithRelations, ClientStatus } from "@/lib/types";
import {
  ArrowLeft,
  Mail,
  Phone,
  FileText,
  Calendar,
  MessageSquare,
  Activity,
  Download,
  CheckCircle,
  Circle,
} from "lucide-react";

type ChecklistItem = {
  id: string;
  label: string;
  description: string;
  satisfied: boolean;
};

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<ClientWithRelations | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyChannel, setNotifyChannel] = useState<"email" | "sms" | "both">("email");
  const [callNotes, setCallNotes] = useState("");
  const [callOutcome, setCallOutcome] = useState("answered");
  const [staffNotes, setStaffNotes] = useState("");
  const [taxYear, setTaxYear] = useState("");
  const [preparerName, setPreparerName] = useState("");
  const [msg, setMsg] = useState("");
  const [mefInfo, setMefInfo] = useState<{
    config?: { environment: string; productionReady: boolean };
    submissions?: { id: string; status: string; submission_id: string; ack_message?: string }[];
  } | null>(null);
  const [dsInfo, setDsInfo] = useState<{
    config?: { configured: boolean; note: string };
    envelopes?: { envelope_id: string; status: string; signing_url?: string }[];
  } | null>(null);

  const fetchClient = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`);
      if (res.status === 401) {
        router.replace("/admin");
        return;
      }
      const data = await res.json();
      setClient(data.client);
      setChecklist(data.checklist || []);
      setStaffNotes(data.client?.staff_notes || "");
      setTaxYear(
        data.client?.tax_year != null ? String(data.client.tax_year) : ""
      );
      setPreparerName(data.client?.assigned_preparer_name || "");
    } catch {
      router.replace("/admin/dashboard");
    } finally {
      setLoading(false);
    }
  }, [clientId, router]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  const loadComplianceIntegrations = useCallback(async () => {
    try {
      const [mefRes, dsRes] = await Promise.all([
        fetch(`/api/admin/mef?clientId=${clientId}`),
        fetch(`/api/admin/docusign?clientId=${clientId}`),
      ]);
      if (mefRes.ok) setMefInfo(await mefRes.json());
      if (dsRes.ok) setDsInfo(await dsRes.json());
    } catch {
      /* optional until migration 007 */
    }
  }, [clientId]);

  useEffect(() => {
    if (clientId) loadComplianceIntegrations();
  }, [clientId, loadComplianceIntegrations]);

  const patchClient = async (body: Record<string, unknown>) => {
    setUpdating(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setClient(data.client);
        setMsg("Saved");
      }
    } finally {
      setUpdating(false);
    }
  };

  const updateStatus = async (newStatus: ClientStatus) => {
    await patchClient({ status: newStatus });
  };

  const saveNotes = async () => {
    await patchClient({ staff_notes: staffNotes });
  };

  const saveTaxYear = async () => {
    const year = taxYear ? parseInt(taxYear, 10) : null;
    if (taxYear && Number.isNaN(year)) return;
    await patchClient({ tax_year: year });
  };

  const savePreparer = async () => {
    await patchClient({
      assigned_preparer_name: preparerName.trim() || null,
      assigned_preparer_id: preparerName.trim()
        ? preparerName.trim().toLowerCase().replace(/\s+/g, "-")
        : null,
    });
  };

  const sendDocuSign = async () => {
    setUpdating(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/docusign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          clientId,
          embedded: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "DocuSign failed");
      setMsg(
        data.simulated
          ? "DocuSign simulator envelope sent (configure live API for certified production)"
          : "DocuSign envelope sent"
      );
      await fetchClient();
      await loadComplianceIntegrations();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "DocuSign failed");
    } finally {
      setUpdating(false);
    }
  };

  const buildMef = async () => {
    setUpdating(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/mef", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "MeF package failed");
      setMsg(`MeF package ${data.submission?.status}: ${data.submission?.submission_id}`);
      await fetchClient();
      await loadComplianceIntegrations();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "MeF failed");
    } finally {
      setUpdating(false);
    }
  };

  const transmitMef = async (submissionId: string) => {
    if (!confirm("Transmit this MeF package to the IRS gateway (sandbox unless production configured)?")) {
      return;
    }
    setUpdating(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/mef", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transmit", submissionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transmit failed");
      setMsg(
        `MeF ${data.submission?.status}: ${data.submission?.ack_message || data.submission?.ack_code}`
      );
      await fetchClient();
      await loadComplianceIntegrations();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Transmit failed");
    } finally {
      setUpdating(false);
    }
  };

  const sendNotification = async () => {
    if (!notifyMessage.trim()) return;
    setUpdating(true);
    try {
      await fetch("/api/admin/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          channel: notifyChannel,
          message: notifyMessage,
        }),
      });
      setNotifyMessage("");
      await fetchClient();
    } finally {
      setUpdating(false);
    }
  };

  const logCall = async () => {
    if (!callNotes.trim()) return;
    setUpdating(true);
    try {
      await fetch("/api/admin/call-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          notes: callNotes,
          outcome: callOutcome,
        }),
      });
      setCallNotes("");
      await fetchClient();
    } finally {
      setUpdating(false);
    }
  };

  const downloadDoc = async (docId: string) => {
    const res = await fetch(`/api/admin/documents/${docId}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const match = cd.match(/filename="([^"]+)"/);
    const name = match?.[1] || "document";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const cancelAppointment = async (appointmentId: string) => {
    if (!confirm("Cancel this appointment?")) return;
    setUpdating(true);
    try {
      await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", appointmentId }),
      });
      await fetchClient();
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-500">Loading client...</p>
      </div>
    );
  }

  if (!client) return null;

  const appointment = client.appointments
    ?.filter((a) => a.status === "scheduled")
    .sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    )[0];
  const intake = client.intake_forms?.[0];
  const status = client.status as ClientStatus;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-navy-700 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{client.name}</h1>
              <p className="text-sm text-slate-500">{client.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {client.tax_year && (
                <span className="text-xs font-medium px-2 py-1 rounded bg-slate-100 text-slate-700">
                  TY {client.tax_year}
                </span>
              )}
              <Badge status={status} className="text-sm px-3 py-1">
                {STATUS_LABELS[status]}
              </Badge>
            </div>
          </div>
          {msg && <p className="text-xs text-green-600 mt-1">{msg}</p>}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="grid sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-4 flex items-center gap-3">
              <Mail className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="text-sm font-medium">{client.email}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 flex items-center gap-3">
              <Phone className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Phone</p>
                <p className="text-sm font-medium">{client.phone || "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 flex items-center gap-3">
              <Calendar className="w-5 h-5 text-slate-400" />
              <div className="flex-1">
                <p className="text-xs text-slate-500">Appointment</p>
                <p className="text-sm font-medium">
                  {appointment ? formatDateTime(appointment.starts_at) : "—"}
                </p>
                {appointment && (
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline mt-1"
                    onClick={() => cancelAppointment(appointment.id)}
                    disabled={updating}
                  >
                    Cancel appointment
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-navy-100">
            <CardHeader>
              <CardTitle className="text-base">DocuSign certified e-sign</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-xs text-slate-500">
                {dsInfo?.config?.note || "Loading DocuSign status…"}
              </p>
              {client.docusign_status && (
                <p>
                  Client status:{" "}
                  <span className="font-medium">{client.docusign_status}</span>
                </p>
              )}
              {dsInfo?.envelopes?.slice(0, 2).map((e) => (
                <p key={e.envelope_id} className="text-xs text-slate-600">
                  {e.envelope_id.slice(0, 18)}… → {e.status}
                </p>
              ))}
              <Button size="sm" onClick={sendDocuSign} loading={updating}>
                Send DocuSign envelope
              </Button>
            </CardContent>
          </Card>

          <Card className="border-navy-100">
            <CardHeader>
              <CardTitle className="text-base">IRS MeF e-file</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-xs text-slate-500">
                Environment: {mefInfo?.config?.environment || "…"}
                {mefInfo?.config?.productionReady
                  ? " (production ready)"
                  : " (sandbox until IRS ERO credentials)"}
              </p>
              {client.efile_status && (
                <p>
                  E-file: <span className="font-medium">{client.efile_status}</span>
                </p>
              )}
              {mefInfo?.submissions?.slice(0, 2).map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono">{s.submission_id}</span>
                  <span>{s.status}</span>
                  {s.status !== "accepted" && s.status !== "transmitting" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => transmitMef(s.id)}
                      disabled={updating}
                    >
                      Transmit
                    </Button>
                  )}
                </div>
              ))}
              <Button size="sm" onClick={buildMef} loading={updating}>
                Build MeF package
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Update Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={status}
                onChange={(e) => updateStatus(e.target.value as ClientStatus)}
                disabled={updating}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-slate-500 mt-2">
                Client will be notified automatically via email and SMS.
              </p>
              {(status === "ready_for_signature" || status === "filed") && (
                <div className="text-xs mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-slate-600">
                  <p className="font-medium text-slate-800">E-signature</p>
                  {client.signed_at || client.signature_acknowledged_at ? (
                    <>
                      <p>
                        Signed{" "}
                        {new Date(
                          (client.signed_at ||
                            client.signature_acknowledged_at) as string
                        ).toLocaleString()}
                      </p>
                      {client.signature_typed_name && (
                        <p>Name: {client.signature_typed_name}</p>
                      )}
                      {client.signature_method && (
                        <p>Method: {client.signature_method}</p>
                      )}
                      {client.signature_ip && <p>IP: {client.signature_ip}</p>}
                    </>
                  ) : (
                    <p>Waiting on client electronic signature</p>
                  )}
                </div>
              )}
              <div className="mt-4 space-y-2">
                <label className="text-xs font-medium text-slate-600">
                  Assigned preparer
                </label>
                <div className="flex gap-2">
                  <Input
                    value={preparerName}
                    onChange={(e) => setPreparerName(e.target.value)}
                    placeholder="Preparer name"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={savePreparer}
                    loading={updating}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Send Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                placeholder="Type your message..."
                rows={3}
              />
              <div className="flex gap-2">
                <Select
                  value={notifyChannel}
                  onChange={(e) =>
                    setNotifyChannel(e.target.value as "email" | "sms" | "both")
                  }
                  className="flex-1"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="both">Both</option>
                </Select>
                <Button
                  onClick={sendNotification}
                  loading={updating}
                  disabled={!notifyMessage.trim()}
                >
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Staff notes (internal)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={staffNotes}
                onChange={(e) => setStaffNotes(e.target.value)}
                placeholder="Private notes — never shown to the client..."
                rows={4}
              />
              <Button onClick={saveNotes} loading={updating} size="sm">
                Save notes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tax year</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="number"
                value={taxYear}
                onChange={(e) => setTaxYear(e.target.value)}
                placeholder="e.g. 2025"
                min={2000}
                max={2100}
              />
              <Button onClick={saveTaxYear} loading={updating} size="sm">
                Save tax year
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Log a Call
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Select
                value={callOutcome}
                onChange={(e) => setCallOutcome(e.target.value)}
                className="w-48"
              >
                <option value="answered">Answered</option>
                <option value="voicemail">Voicemail</option>
                <option value="no_answer">No Answer</option>
                <option value="callback_requested">Callback Requested</option>
              </Select>
            </div>
            <Textarea
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              placeholder="Call notes..."
              rows={2}
            />
            <Button
              onClick={logCall}
              loading={updating}
              disabled={!callNotes.trim()}
              variant="secondary"
            >
              Log Call
            </Button>
          </CardContent>
        </Card>

        {intake?.submitted_at && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Intake Form</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                {Object.entries(intake.data as Record<string, unknown>).map(
                  ([key, value]) => (
                    <div key={key}>
                      <dt className="text-slate-500 capitalize">
                        {key.replace(/_/g, " ")}
                      </dt>
                      <dd className="font-medium text-slate-900">
                        {typeof value === "boolean"
                          ? value
                            ? "Yes"
                            : "No"
                          : String(value)}
                      </dd>
                    </div>
                  )
                )}
              </dl>
            </CardContent>
          </Card>
        )}

        {checklist.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Document checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {checklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    {item.satisfied ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300" />
                    )}
                    <span className={item.satisfied ? "text-green-800" : "text-slate-700"}>
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {client.documents && client.documents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Documents ({client.documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {client.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm gap-2"
                  >
                    <div className="min-w-0">
                      <span className="font-medium block truncate">{doc.name}</span>
                      <span className="text-slate-500 text-xs">
                        {doc.category && (
                          <span className="capitalize">
                            {doc.category.replace(/_/g, " ")} ·{" "}
                          </span>
                        )}
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => downloadDoc(doc.id)}
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Activity Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              {client.activity_log && client.activity_log.length > 0 ? (
                <div className="space-y-3">
                  {client.activity_log
                    .sort(
                      (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                    )
                    .map((entry) => (
                      <div
                        key={entry.id}
                        className="text-sm border-l-2 border-slate-200 pl-3"
                      >
                        <p className="text-slate-700">{entry.description}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(entry.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No activity yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Communications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {client.communications && client.communications.length > 0 ? (
                <div className="space-y-3">
                  {client.communications
                    .sort(
                      (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                    )
                    .map((comm) => (
                      <div
                        key={comm.id}
                        className="text-sm border-l-2 border-slate-200 pl-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium uppercase text-slate-500">
                            {comm.channel}
                          </span>
                          {comm.subject && (
                            <span className="text-slate-700">{comm.subject}</span>
                          )}
                        </div>
                        {comm.body && (
                          <p className="text-slate-600 mt-0.5">{comm.body}</p>
                        )}
                        <p className="text-xs text-slate-400">
                          {new Date(comm.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No communications yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
