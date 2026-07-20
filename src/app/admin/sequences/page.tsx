"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SEQUENCES, STATUS_EMAIL_MAP } from "@/lib/sequences";
import { ArrowLeft, Mail, MessageSquare, Clock } from "lucide-react";

export default function SequencesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/admin/auth")
      .then((r) => r.json())
      .then((d) => {
        if (!d.authenticated) router.replace("/admin");
        else setReady(true);
      })
      .catch(() => router.replace("/admin"));
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-navy-700 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Automation sequences</h1>
          <p className="text-sm text-slate-500">
            How clients are messaged after booking, intake, and status changes
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {SEQUENCES.map((seq) => (
          <Card key={seq.id} className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-navy-50 to-white">
              <CardTitle className="text-base">{seq.name}</CardTitle>
              <CardDescription>
                Trigger: <code className="text-xs bg-slate-100 px-1 rounded">{seq.trigger}</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <ol className="space-y-3">
                {seq.steps.map((step, i) => (
                  <li
                    key={step.key}
                    className="flex gap-3 items-start border border-slate-100 rounded-lg p-3"
                  >
                    <span className="w-7 h-7 rounded-full bg-navy-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm">{step.description}</p>
                      <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {step.delayHours === 0
                            ? "Immediate"
                            : step.delayHours < 0
                              ? `${Math.abs(step.delayHours)}h before event`
                              : `+${step.delayHours}h`}
                        </span>
                        {step.channels.includes("email") && (
                          <span className="inline-flex items-center gap-1 text-blue-700">
                            <Mail className="w-3 h-3" /> Email
                          </span>
                        )}
                        {step.channels.includes("sms") && (
                          <span className="inline-flex items-center gap-1 text-green-700">
                            <MessageSquare className="w-3 h-3" /> SMS
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status-change notifications</CardTitle>
            <CardDescription>
              Fired when staff updates pipeline status on a client
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2">
              {Object.entries(STATUS_EMAIL_MAP).map(([status, key]) => (
                <li
                  key={status}
                  className="flex justify-between gap-4 border-b border-slate-50 py-2"
                >
                  <span className="font-medium text-slate-800">{status}</span>
                  <code className="text-xs text-slate-500">{key}</code>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/export?type=activity">
            <Button variant="secondary" size="sm">
              Export activity CSV
            </Button>
          </a>
          <a href="/api/admin/export?type=communications">
            <Button variant="secondary" size="sm">
              Export communications CSV
            </Button>
          </a>
          <a href="/api/admin/export?type=signatures">
            <Button variant="secondary" size="sm">
              Export signatures CSV
            </Button>
          </a>
        </div>
      </main>
    </div>
  );
}
