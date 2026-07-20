import Link from "next/link";
import { FileText } from "lucide-react";

export function Header({ showNav = true }: { showNav?: boolean }) {
  const practiceName = process.env.NEXT_PUBLIC_PRACTICE_NAME || "Tax Practice";

  return (
    <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-navy-700 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-navy-800 transition-colors">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-slate-900 tracking-tight">
            {practiceName}
          </span>
        </Link>
        {showNav && (
          <nav className="flex items-center gap-1 sm:gap-2 text-sm">
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
              Portal
            </Link>
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
