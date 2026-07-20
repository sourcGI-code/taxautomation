"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, CheckCircle, ExternalLink } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);

  const errorMessages: Record<string, string> = {
    invalid: "Invalid login link. Please request a new one.",
    expired: "Your login link has expired. Please request a new one.",
    failed: "Login failed. Please try again.",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPortalUrl(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setSent(true);
      if (data.portalUrl) {
        setPortalUrl(data.portalUrl);
        setDevMode(data.mode === "dev");
      }
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Client Portal Login</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a secure login link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-4">
            {errorMessages[error] || "Something went wrong."}
          </p>
        )}

        {sent ? (
          <div className="text-center py-4 space-y-4">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            {portalUrl ? (
              <>
                <p className="text-slate-700 text-sm">
                  {devMode
                    ? "Email is not configured yet (no Resend API key), so no email was sent. Use this link to open your portal:"
                    : "Open your portal:"}
                </p>
                <a href={portalUrl}>
                  <Button className="w-full">
                    <ExternalLink className="w-4 h-4" />
                    Open Client Portal
                  </Button>
                </a>
              </>
            ) : (
              <p className="text-slate-700">
                If an account exists for that email, we&apos;ve sent a login link. Check your inbox
                (and spam).
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <Button type="submit" loading={loading} className="w-full">
              <Mail className="w-4 h-4" />
              Send Login Link
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <>
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Suspense fallback={<div className="text-slate-500">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </main>
    </>
  );
}
