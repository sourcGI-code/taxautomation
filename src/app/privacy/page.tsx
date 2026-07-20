import Link from "next/link";
import { Header } from "@/components/header";

const practiceName = process.env.NEXT_PUBLIC_PRACTICE_NAME || "Tax Practice";

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 prose prose-slate">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy policy</h1>
        <p className="text-slate-500 text-sm mb-8">
          Last updated {new Date().toISOString().slice(0, 10)} · Template for{" "}
          {practiceName} — have counsel review before production use.
        </p>
        <div className="space-y-6 text-slate-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">What we collect</h2>
            <p>
              Contact details you provide (name, email, phone), appointment information,
              intake responses, tax documents you upload, electronic signature records
              (including typed name, optional drawn signature image, IP address, and
              browser user agent), and technical logs needed to operate the service.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-slate-900">How we use it</h2>
            <p>
              To schedule appointments, prepare tax returns, communicate status updates,
              secure your documents, and maintain records required for professional tax
              services. We do not sell your personal information.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Security</h2>
            <p>
              Documents are stored in a private bucket and encrypted at rest with
              AES-256-GCM before upload when configured. Access requires an authenticated
              session. Staff access is limited to authorized preparers.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Retention</h2>
            <p>
              We retain client files for the period required by professional standards
              and applicable law, then delete or archive according to firm policy.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
            <p>
              Questions:{" "}
              {process.env.PRACTICE_EMAIL || "your practice email"}.
            </p>
          </section>
        </div>
        <p className="mt-10">
          <Link href="/" className="text-navy-700 hover:underline text-sm">
            ← Back home
          </Link>
        </p>
      </main>
    </>
  );
}
