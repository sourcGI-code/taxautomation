import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[50vh] px-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-navy-700 mb-2">404</p>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Page not found</h1>
        <p className="text-slate-600 mb-6 text-sm">
          That link may be expired or mistyped.
        </p>
        <Link href="/">
          <Button>Back home</Button>
        </Link>
      </div>
    </div>
  );
}
