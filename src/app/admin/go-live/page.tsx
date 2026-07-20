"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Rocket, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type Check = {
  id: string;
  title: string;
  severity: string;
  ok: boolean;
  detail: string;
  fix?: string;
};

type Report = {
  publishable: boolean;
  codeReady: boolean;
  envReady: boolean;
  firmReady: boolean;
  score: number;
  summary: string;
  blockers: Check[];
  warnings: Check[];
  checks: Check[];
  version: string;
};

export default function GoLivePage() {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [flags, setFlags] = useState({
    affirm_legal_review: false,
    affirm_data_controller: false,
    affirm_efile_policy: false,
    affirm_insurance: false,
  });

  const load = () => {
    setLoading(true);
    fetch("/api/admin/publish")
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/admin");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d?.report) setReport(d.report);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [router]);

  const saveAffirmations = async (goLive: boolean) => {
    setSaving(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/admin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...flags,
          go_live: goLive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            (data.blockers
              ? `Blockers: ${data.blockers.map((b: Check) => b.title).join(", ")}`
              : "Failed")
        );
      }
      setReport(data.report);
      setMsg(
        goLive
          ? "Go-live enabled — system is publishable for real clients."
          : "Affirmations saved. Re-run check."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-500">Running publish diagnosis…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 text-sm text-slate-600 mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Rocket className="w-5 h-5 text-navy-700" />
                Go live / publish readiness
              </h1>
              <p className="text-sm text-slate-500">v{report.version}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-navy-800">{report.score}</p>
              <p
                className={`text-xs font-semibold uppercase ${
                  report.publishable ? "text-green-700" : "text-red-700"
                }`}
              >
                {report.publishable ? "Publishable" : "Not yet"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Card
          className={
            report.publishable
              ? "border-green-300 bg-green-50/50"
              : "border-amber-300 bg-amber-50/50"
          }
        >
          <CardContent className="py-4 text-sm leading-relaxed">
            {report.summary}
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-3 gap-3">
          {[
            ["Code", report.codeReady],
            ["Environment", report.envReady],
            ["Firm legal", report.firmReady],
          ].map(([label, ok]) => (
            <Card key={label as string}>
              <CardContent className="py-4 flex items-center gap-2">
                {ok ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span className="font-medium">{label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {report.blockers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-red-800">Blockers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {report.blockers.map((b) => (
                <div key={b.id} className="text-sm border-b border-slate-100 pb-2">
                  <p className="font-medium">{b.title}</p>
                  <p className="text-slate-600">{b.detail}</p>
                  {b.fix && (
                    <p className="text-xs text-navy-700 mt-1">Fix: {b.fix}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Firm affirmations (owner)</CardTitle>
            <CardDescription>
              Required before go-live. These are legal/ops ownership confirmations —
              not automatic software claims.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(
              [
                [
                  "affirm_legal_review",
                  "I confirm privacy, terms, and engagement letter were reviewed for our firm (counsel recommended).",
                ],
                [
                  "affirm_data_controller",
                  "Our firm is the data controller / responsible tax preparer for client data in this system.",
                ],
                [
                  "affirm_efile_policy",
                  "E-file will only go through authorized ERO/MeF credentials or external authorized tax software — never sandbox as production.",
                ],
                [
                  "affirm_insurance",
                  "We maintain appropriate E&O / cyber coverage for holding tax documents (recommended).",
                ],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex gap-3 items-start cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={flags[key]}
                  onChange={(e) =>
                    setFlags((f) => ({ ...f, [key]: e.target.checked }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}

            {error && (
              <p className="text-red-600 flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </p>
            )}
            {msg && <p className="text-green-700">{msg}</p>}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="secondary"
                loading={saving}
                onClick={() => saveAffirmations(false)}
              >
                Save affirmations
              </Button>
              <Button
                loading={saving}
                onClick={() => saveAffirmations(true)}
                disabled={
                  !flags.affirm_legal_review ||
                  !flags.affirm_data_controller ||
                  !flags.affirm_efile_policy
                }
              >
                Enable go-live
              </Button>
              <Button variant="outline" onClick={load}>
                Re-diagnose
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All checks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-96 overflow-y-auto">
            {report.checks.map((c) => (
              <div
                key={c.id}
                className="flex gap-2 text-xs py-1 border-b border-slate-50"
              >
                <span className={c.ok ? "text-green-600" : "text-red-600"}>
                  {c.ok ? "✓" : "✗"}
                </span>
                <span className="font-medium w-40 shrink-0">{c.title}</span>
                <span className="text-slate-600">{c.detail}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
