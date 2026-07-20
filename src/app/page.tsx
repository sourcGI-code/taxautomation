import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar,
  FileText,
  Bell,
  MessageSquare,
  Shield,
  Clock,
  Lock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

const practiceName = process.env.NEXT_PUBLIC_PRACTICE_NAME || "Tax Practice";

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-br from-navy-800 via-navy-700 to-[#1a4a6e] text-white">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,#fff_0%,transparent_50%)]" />
          <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28 text-center">
            <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-navy-100 bg-white/10 rounded-full px-3 py-1 mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Secure client portal
            </p>
            <h1 className="text-4xl md:text-6xl font-bold mb-5 tracking-tight">
              Tax prep, fully connected
            </h1>
            <p className="text-lg md:text-xl text-navy-100 max-w-2xl mx-auto mb-10 leading-relaxed">
              Book online, complete intake, upload documents with encryption at rest,
              e-sign when ready, and track every step — without chasing email threads.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/book">
                <Button
                  size="lg"
                  className="bg-white text-navy-800 hover:bg-navy-50 w-full sm:w-auto shadow-lg"
                >
                  <Calendar className="w-5 h-5" />
                  Book appointment
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/40 text-white hover:bg-white/10 w-full sm:w-auto"
                >
                  Client portal login
                </Button>
              </Link>
            </div>
            <div className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-navy-100">
              {[
                "AES-256 document encryption",
                "Magic-link client login",
                "Email + SMS status updates",
                "ESIGN-ready authorizations",
              ].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 py-16 md:py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
              Everything in one place
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Built for modern tax practices that want client experience and ops
              tooling on the same rails.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Calendar,
                title: "24/7 online booking",
                desc: "Availability rules, blocked dates, conflict detection, and instant confirmations.",
              },
              {
                icon: FileText,
                title: "Secure document vault",
                desc: "Private storage, magic-byte validation, encrypted at rest before upload.",
              },
              {
                icon: Bell,
                title: "Live status pipeline",
                desc: "From booked to filed — clients always know where their return stands.",
              },
              {
                icon: MessageSquare,
                title: "Automated sequences",
                desc: "Welcome, intake, document, and appointment reminders via email and SMS.",
              },
              {
                icon: Shield,
                title: "Electronic signatures",
                desc: "ESIGN Act consent capture, in-portal signature audit trail, and optional DocuSign envelopes.",
              },
              {
                icon: Clock,
                title: "Less back-and-forth",
                desc: "Intake and uploads before the meeting. Staff dashboard for notes and calls.",
              },
            ].map((feature) => (
              <Card
                key={feature.title}
                className="hover:shadow-md hover:border-navy-200 transition-all duration-200"
              >
                <CardContent className="pt-6">
                  <div className="w-11 h-11 rounded-xl bg-navy-50 flex items-center justify-center mb-4">
                    <feature.icon className="w-5 h-5 text-navy-700" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {feature.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-slate-900 text-white">
          <div className="max-w-6xl mx-auto px-4 py-14 grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Lock,
                title: "Built for real tax data",
                desc: "Encrypted document vault, signed sessions, rate limits, CSP/HSTS, private storage only.",
              },
              {
                icon: Shield,
                title: "Firm operations",
                desc: "Staff roles, preparer assignment, go-live checklist, WISP + engagement letter, audit exports.",
              },
              {
                icon: FileText,
                title: "Accountable by design",
                desc: "Consent records, e-sign evidence, activity logs, and MeF package validation before any transmit.",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-4">
                <item.icon className="w-8 h-8 text-navy-100 shrink-0" />
                <div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border-t border-slate-200">
          <div className="max-w-6xl mx-auto px-4 py-16 text-center">
            <h2 className="text-2xl font-bold mb-4 text-slate-900">
              Ready when you are
            </h2>
            <p className="text-slate-600 mb-8 max-w-lg mx-auto">
              Start with an appointment, or sign in if you already work with{" "}
              {practiceName}.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/book">
                <Button size="lg">
                  <Calendar className="w-5 h-5" />
                  Book your appointment
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Open client portal
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 py-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>
            © {new Date().getFullYear()} {practiceName}. All rights reserved.
          </p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-navy-700">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-navy-700">
              Terms
            </Link>
            <Link href="/login" className="hover:text-navy-700">
              Client login
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
