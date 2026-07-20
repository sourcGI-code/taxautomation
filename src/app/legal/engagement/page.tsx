import Link from "next/link";
import { Header } from "@/components/header";
import { engagementLetterText } from "@/lib/legal/documents";
import { getDefaultTaxYear } from "@/lib/tax-year";

export default function EngagementPublicPage() {
  const text = engagementLetterText("[Client Name]", getDefaultTaxYear());
  return (
    <>
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Engagement letter</h1>
        <p className="text-sm text-slate-500 mb-6">
          Template used when clients accept an engagement in the portal. Customize with
          counsel before go-live.
        </p>
        <pre className="whitespace-pre-wrap text-sm text-slate-700 bg-white border border-slate-200 rounded-xl p-6 leading-relaxed">
          {text}
        </pre>
        <p className="mt-8">
          <Link href="/" className="text-navy-700 text-sm hover:underline">
            ← Home
          </Link>
        </p>
      </main>
    </>
  );
}
