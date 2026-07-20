import Link from "next/link";
import { FileText } from "lucide-react";
import { firmDisplayName } from "@/lib/firm";

export function Header({ showNav = true }: { showNav?: boolean }) {
  const practiceName = firmDisplayName();

  return (
    <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 group min-w-0">
          <div className="w-9 h-9 shrink-0 bg-navy-700 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-navy-800 transition-colors">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-slate-900 tracking-tight block truncate">
              {practiceName}
            </span>
            <span className="text-[11px] text-slate-500 hidden sm:block leading-tight">
              Ken Collins · Wabash, IN
            </span>
          </div>
        </Link>
        {showNav && (
          <nav className="flex items-center gap-1 sm:gap-2 text-sm shrink-0">
            <Link
              href="/book"
              className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-navy-800 hover:bg-navy-50 transition-colors"
            >
              Book
            </Link>
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-navy-800 hover:bg-navy-50 transition-colors"
            >
              Client login
            </Link>
            <a
              href="tel:+12609066212"
              className="hidden md:inline-flex px-3 py-1.5 rounded-lg text-navy-700 font-medium hover:bg-navy-50 transition-colors"
            >
              (260) 906-6212
            </a>
            <Link
              href="/admin"
              className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-600 text-xs"
            >
              Staff
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
