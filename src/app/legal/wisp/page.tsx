import Link from "next/link";
import { Header } from "@/components/header";
import { wispText, subprocessorsList } from "@/lib/legal/documents";

export default function WispPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Written Information Security Program
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Firm security program template. Adopt and maintain as your official WISP.
        </p>
        <pre className="whitespace-pre-wrap text-sm text-slate-700 bg-white border border-slate-200 rounded-xl p-6 leading-relaxed mb-8">
          {wispText()}
        </pre>
        <h2 className="text-lg font-semibold mb-3">Subprocessors</h2>
        <ul className="text-sm space-y-2 mb-8">
          {subprocessorsList().map((s) => (
            <li key={s.name} className="border-b border-slate-100 pb-2">
              <span className="font-medium">{s.name}</span> — {s.purpose}
            </li>
          ))}
        </ul>
        <Link href="/" className="text-navy-700 text-sm hover:underline">
          ← Home
        </Link>
      </main>
    </>
  );
}
