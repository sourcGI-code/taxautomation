"use client";

import { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FILING_STATUS_OPTIONS } from "@/lib/constants";
import { ArrowLeft, CheckCircle } from "lucide-react";

export default function IntakePage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    filing_status: "",
    dependents: 0,
    has_w2: false,
    has_1099: false,
    has_investments: false,
    has_rental_income: false,
    has_business_income: false,
    prior_year_filed: true,
    ssn_last_four: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    additional_notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/portal/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Submission failed");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <>
        <Header showNav={false} />
        <main className="flex-1 max-w-2xl mx-auto px-4 py-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Intake Submitted!</h1>
          <p className="text-slate-600 mb-8">
            Thank you. Please upload your tax documents next.
          </p>
          <Link href="/portal/documents">
            <Button>Upload Documents</Button>
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showNav={false} />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-8 w-full">
        <Link href="/portal" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-navy-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Portal
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Tax Intake Form</CardTitle>
            <CardDescription>
              Help us prepare for your appointment. All information is kept confidential.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Filing Status</label>
                <Select
                  required
                  value={form.filing_status}
                  onChange={(e) => setForm({ ...form, filing_status: e.target.value })}
                >
                  <option value="">Select...</option>
                  {FILING_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Number of Dependents</label>
                <Input
                  type="number"
                  min={0}
                  value={form.dependents}
                  onChange={(e) => setForm({ ...form, dependents: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Income Sources</label>
                <div className="space-y-2">
                  {[
                    { key: "has_w2", label: "W-2 employment income" },
                    { key: "has_1099", label: "1099 freelance/contract income" },
                    { key: "has_investments", label: "Investment income (stocks, dividends)" },
                    { key: "has_rental_income", label: "Rental property income" },
                    { key: "has_business_income", label: "Business/Self-employment income" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form[key as keyof typeof form] as boolean}
                        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last 4 of SSN</label>
                  <Input
                    maxLength={4}
                    value={form.ssn_last_four}
                    onChange={(e) => setForm({ ...form, ssn_last_four: e.target.value })}
                    placeholder="1234"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prior Year Filed?</label>
                  <Select
                    value={form.prior_year_filed ? "yes" : "no"}
                    onChange={(e) => setForm({ ...form, prior_year_filed: e.target.value === "yes" })}
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No (first time filing)</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                  <Input
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    maxLength={2}
                    placeholder="CA"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ZIP</label>
                  <Input
                    value={form.zip}
                    onChange={(e) => setForm({ ...form, zip: e.target.value })}
                    maxLength={10}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Additional Notes</label>
                <Textarea
                  value={form.additional_notes}
                  onChange={(e) => setForm({ ...form, additional_notes: e.target.value })}
                  placeholder="Anything else we should know?"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" loading={loading} className="w-full">
                Submit Intake Form
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
