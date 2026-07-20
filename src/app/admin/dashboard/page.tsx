"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { Client, ClientStatus } from "@/lib/types";
import {
  Users,
  Calendar,
  Clock,
  CheckCircle,
  LogOut,
  ChevronRight,
  Settings,
  Download,
  Workflow,
  Search,
  Shield,
  Rocket,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface DashboardStats {
  total: number;
  booked: number;
  intake_complete: number;
  documents_received: number;
  in_review: number;
  ready_for_signature: number;
  filed: number;
  todayAppointments: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [staffName, setStaffName] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [clientsRes, authRes] = await Promise.all([
        fetch(`/api/admin/clients?status=${statusFilter}`),
        fetch("/api/admin/auth"),
      ]);
      if (clientsRes.status === 401) {
        router.replace("/admin");
        return;
      }
      const data = await clientsRes.json();
      setClients(data.clients || []);
      setStats(data.stats || null);
      if (authRes.ok) {
        const auth = await authRes.json();
        setStaffName(auth.staff?.name || "");
      }
    } catch {
      router.replace("/admin");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredClients = clients.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.assigned_preparer_name || "").toLowerCase().includes(q)
    );
  });

  const logout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.replace("/admin");
  };

  const statCards = stats
    ? [
        { label: "Total Clients", value: stats.total, icon: Users, color: "text-navy-700" },
        { label: "Today's Appts", value: stats.todayAppointments, icon: Calendar, color: "text-blue-600" },
        { label: "In Review", value: stats.in_review, icon: Clock, color: "text-amber-600" },
        { label: "Filed", value: stats.filed, icon: CheckCircle, color: "text-green-600" },
      ]
    : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-500">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Staff Dashboard</h1>
            <p className="text-sm text-slate-500">
              {staffName ? `Signed in as ${staffName}` : "Manage clients and track progress"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/admin/go-live">
              <Button variant="ghost" size="sm">
                <Rocket className="w-4 h-4" />
                Go live
              </Button>
            </Link>
            <Link href="/admin/compliance">
              <Button variant="ghost" size="sm">
                <Shield className="w-4 h-4" />
                Controls
              </Button>
            </Link>
            <Link href="/admin/sequences">
              <Button variant="ghost" size="sm">
                <Workflow className="w-4 h-4" />
                Sequences
              </Button>
            </Link>
            <a href="/api/admin/export?type=clients">
              <Button variant="ghost" size="sm">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </a>
            <Link href="/admin/settings">
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
                Settings
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  </div>
                  <stat.icon className={`w-8 h-8 ${stat.color} opacity-80`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pipeline overview */}
        {stats && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-base">Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {STATUS_ORDER.map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      statusFilter === status
                        ? "border-navy-700 bg-navy-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <Badge status={status}>{STATUS_LABELS[status]}</Badge>
                    <span className="font-medium text-slate-700">
                      {stats[status as keyof DashboardStats] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Client list */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base">
                Clients {statusFilter !== "all" && `— ${STATUS_LABELS[statusFilter as ClientStatus]}`}
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, email, phone..."
                    className="pl-9"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-48"
                >
                  <option value="all">All Statuses</option>
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredClients.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No clients found</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredClients.map((client) => {
                  const appt = (client as Client & { appointments?: { starts_at: string }[] })
                    .appointments?.[0];
                  return (
                    <Link
                      key={client.id}
                      href={`/admin/clients/${client.id}`}
                      className="flex items-center justify-between py-4 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-navy-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-navy-700">
                            {client.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{client.name}</p>
                          <p className="text-sm text-slate-500">{client.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {appt && (
                          <p className="text-sm text-slate-500 hidden sm:block">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {formatDateTime(appt.starts_at)}
                          </p>
                        )}
                        <Badge status={client.status as ClientStatus}>
                          {STATUS_LABELS[client.status as ClientStatus]}
                        </Badge>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
