import Link from "next/link";
import { Header } from "@/components/header";

const practiceName = process.env.NEXT_PUBLIC_PRACTICE_NAME || "Collins Fast Tax";

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of use</h1>
        <p className="text-slate-500 text-sm mb-8">
          Last updated {new Date().toISOString().slice(0, 10)} · Template for{" "}
          {practiceName} — have counsel review before production use.
        </p>
        <div className="space-y-6 text-slate-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Portal use</h2>
            <p>
              This portal is provided to schedule appointments, submit information, and
              exchange documents with {practiceName}. You agree to provide accurate
              information and to keep your login link confidential.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Electronic signatures</h2>
            <p>
              When you complete an electronic signature, you agree that it has the same
              effect as a handwritten signature for authorizing your preparer to proceed
              with filing, subject to applicable law. You may request a paper process
              from the firm if required.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-slate-900">No tax advice via this page</h2>
            <p>
              Content on marketing pages is general information. Your engagement letter
              and conversations with your preparer govern the tax services you receive.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Availability</h2>
            <p>
              We aim for high availability but do not guarantee uninterrupted access.
              Plan critical deadlines with backup communication channels.
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
