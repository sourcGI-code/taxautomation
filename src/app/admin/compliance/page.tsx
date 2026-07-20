"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Shield, AlertTriangle, CheckCircle2, Info } from "lucide-react";

type ControlAssessment = {
  control: {
    id: string;
    title: string;
    category: string;
    description: string;
    implementation: string[];
  };
  status: "pass" | "partial" | "fail" | "manual";
  score: number;
  findings: string[];
  evidenceCount: number;
};

type Report = {
  generatedAt: string;
  readinessLabel: string;
  overallScore: number;
  disclaimer: string;
  controls: ControlAssessment[];
  summary: { pass: number; partial: number; fail: number; manual: number };
  subsystems: {
    encryption: boolean;
    productionSecrets: boolean;
    rateLimit: string;
    docusign: { configured: boolean; environment: string; note: string };
    mef: {
      environment: string;
      productionReady: boolean;
      productionGaps: string[];
    };
  };
};

export default function CompliancePage() {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/compliance")
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/admin");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d?.report) setReport(d.report);
        else if (d?.error) setError(d.error);
      })
      .catch(() => setError("Failed to load assessment"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-500">Running SOC 2 control assessment…</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-red-600">{error || "No report"}</p>
      </div>
    );
  }

  const statusColor = {
    pass: "bg-green-100 text-green-800",
    partial: "bg-amber-100 text-amber-800",
    fail: "bg-red-100 text-red-800",
    manual: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-navy-700 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-navy-700" />
                SOC 2 control readiness
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Trust Services Criteria mapped to live system controls
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-navy-800">{report.overallScore}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                {report.readinessLabel.replace("_", " ")}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="py-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-950 leading-relaxed">{report.disclaimer}</p>
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-4 gap-3">
          {(
            [
              ["Pass", report.summary.pass, "text-green-700"],
              ["Partial", report.summary.partial, "text-amber-700"],
              ["Fail", report.summary.fail, "text-red-700"],
              ["Manual", report.summary.manual, "text-slate-700"],
            ] as const
          ).map(([label, n, color]) => (
            <Card key={label}>
              <CardContent className="py-4 text-center">
                <p className={`text-2xl font-bold ${color}`}>{n}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subsystems</CardTitle>
            <CardDescription>MeF, DocuSign, encryption, rate limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Encryption:{" "}
              {report.subsystems.encryption ? (
                <span className="text-green-700 font-medium">configured</span>
              ) : (
                <span className="text-red-700 font-medium">missing</span>
              )}
            </p>
            <p>
              Rate limit: <code>{report.subsystems.rateLimit}</code>
            </p>
            <p>
              DocuSign: {report.subsystems.docusign.note} (
              {report.subsystems.docusign.environment})
            </p>
            <p>
              MeF: {report.subsystems.mef.environment}
              {report.subsystems.mef.productionReady
                ? " — production ready"
                : ` — production gaps: ${report.subsystems.mef.productionGaps.slice(0, 2).join("; ") || "see config"}`}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {report.controls.map((a) => (
            <Card key={a.control.id}>
              <CardContent className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      <span className="text-navy-700 mr-2">{a.control.id}</span>
                      {a.control.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{a.control.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-600">{a.score}</span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${statusColor[a.status]}`}
                    >
                      {a.status}
                    </span>
                  </div>
                </div>
                <ul className="text-xs text-slate-600 list-disc pl-4 space-y-0.5 mb-2">
                  {a.control.implementation.slice(0, 3).map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
                {a.findings.length > 0 && (
                  <div className="text-xs text-amber-800 bg-amber-50 rounded p-2 space-y-1">
                    {a.findings.map((f) => (
                      <p key={f} className="flex gap-1">
                        <Info className="w-3 h-3 shrink-0 mt-0.5" /> {f}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Re-run assessment
          </Button>
          <a href="/api/admin/export?type=activity">
            <Button variant="outline">Export activity evidence</Button>
          </a>
        </div>

        <p className="text-xs text-slate-400">
          Generated {new Date(report.generatedAt).toLocaleString()}
        </p>
      </main>
    </div>
  );
}
