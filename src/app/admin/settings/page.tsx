"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { AvailabilityRule, BlockedDate } from "@/lib/types";
import { ArrowLeft, Plus, Trash2, Calendar } from "lucide-react";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AdminSettingsPage() {
  const router = useRouter();
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [blocked, setBlocked] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [newRule, setNewRule] = useState({
    day_of_week: 1,
    start_time: "09:00",
    end_time: "17:00",
    slot_duration_minutes: 30,
    is_active: true,
  });

  const [blockDate, setBlockDate] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const load = useCallback(async () => {
    try {
      const [rulesRes, blockedRes] = await Promise.all([
        fetch("/api/admin/settings/availability"),
        fetch("/api/admin/settings/blocked-dates"),
      ]);
      if (rulesRes.status === 401 || blockedRes.status === 401) {
        router.replace("/admin");
        return;
      }
      const rulesData = await rulesRes.json();
      const blockedData = await blockedRes.json();
      setRules(rulesData.rules || []);
      setBlocked(blockedData.dates || []);
    } catch {
      router.replace("/admin");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const addRule = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/settings/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRule),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setMessage("Availability rule saved");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule: AvailabilityRule) => {
    setSaving(true);
    try {
      await fetch("/api/admin/settings/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rule, is_active: !rule.is_active }),
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm("Delete this availability rule?")) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/settings/availability?id=${id}`, { method: "DELETE" });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const addBlocked = async () => {
    if (!blockDate) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/settings/blocked-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: blockDate, reason: blockReason || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      setBlockDate("");
      setBlockReason("");
      setMessage("Date blocked");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to block date");
    } finally {
      setSaving(false);
    }
  };

  const removeBlocked = async (id: string) => {
    setSaving(true);
    try {
      await fetch(`/api/admin/settings/blocked-dates?id=${id}`, { method: "DELETE" });
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-500">Loading settings...</p>
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
          <h1 className="text-xl font-bold text-slate-900">Practice Settings</h1>
          <p className="text-sm text-slate-500">Hours, slot length, and blocked dates</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-600">{message}</p>}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Availability Rules</CardTitle>
            <CardDescription>
              Control which weekdays and hours accept bookings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {rules.length === 0 && (
                <p className="text-sm text-slate-500">No rules yet. Add Monday–Friday hours below.</p>
              )}
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg text-sm"
                >
                  <div>
                    <span className="font-medium">{DAY_NAMES[rule.day_of_week]}</span>
                    <span className="text-slate-600">
                      {" "}
                      {String(rule.start_time).slice(0, 5)} – {String(rule.end_time).slice(0, 5)}
                      {" · "}
                      {rule.slot_duration_minutes} min slots
                    </span>
                    {!rule.is_active && (
                      <span className="ml-2 text-xs text-amber-700">inactive</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => toggleRule(rule)}
                      disabled={saving}
                    >
                      {rule.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteRule(rule.id)}
                      disabled={saving}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-4 grid sm:grid-cols-2 md:grid-cols-5 gap-3">
              <Select
                value={String(newRule.day_of_week)}
                onChange={(e) =>
                  setNewRule((r) => ({ ...r, day_of_week: parseInt(e.target.value, 10) }))
                }
              >
                {DAY_NAMES.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </Select>
              <Input
                type="time"
                value={newRule.start_time}
                onChange={(e) => setNewRule((r) => ({ ...r, start_time: e.target.value }))}
              />
              <Input
                type="time"
                value={newRule.end_time}
                onChange={(e) => setNewRule((r) => ({ ...r, end_time: e.target.value }))}
              />
              <Select
                value={String(newRule.slot_duration_minutes)}
                onChange={(e) =>
                  setNewRule((r) => ({
                    ...r,
                    slot_duration_minutes: parseInt(e.target.value, 10),
                  }))
                }
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </Select>
              <Button onClick={addRule} loading={saving}>
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Blocked Dates
            </CardTitle>
            <CardDescription>Holidays or days off — no slots will be offered.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {blocked.length === 0 && (
                <p className="text-sm text-slate-500">No blocked dates.</p>
              )}
              {blocked.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm"
                >
                  <div>
                    <span className="font-medium">{String(b.date).slice(0, 10)}</span>
                    {b.reason && <span className="text-slate-500"> — {b.reason}</span>}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeBlocked(b.id)}
                    disabled={saving}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                type="date"
                value={blockDate}
                onChange={(e) => setBlockDate(e.target.value)}
                className="w-auto"
              />
              <Input
                placeholder="Reason (optional)"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="flex-1 min-w-[160px]"
              />
              <Button onClick={addBlocked} loading={saving} disabled={!blockDate}>
                Block date
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
