import { cn } from "@/lib/utils";
import type { ClientStatus } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/constants";

export function Badge({
  children,
  status,
  className,
}: {
  children: React.ReactNode;
  status?: ClientStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        status ? STATUS_COLORS[status] : "bg-slate-100 text-slate-700",
        className
      )}
    >
      {children}
    </span>
  );
}
