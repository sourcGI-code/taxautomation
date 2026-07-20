"use client";

import { STATUS_ORDER, STATUS_LABELS, STATUS_DESCRIPTIONS } from "@/lib/constants";
import type { ClientStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function StatusTracker({ currentStatus }: { currentStatus: ClientStatus }) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        {STATUS_ORDER.map((status, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={status} className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors",
                  isComplete && "bg-green-500 border-green-500 text-white",
                  isCurrent && "bg-navy-700 border-navy-700 text-white",
                  !isComplete && !isCurrent && "bg-white border-slate-300 text-slate-400"
                )}
              >
                {isComplete ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-xs mt-2 text-center hidden sm:block",
                  isCurrent ? "text-navy-700 font-medium" : "text-slate-500"
                )}
              >
                {STATUS_LABELS[status]}
              </span>
            </div>
          );
        })}
      </div>
      <div className="hidden sm:flex h-1 bg-slate-200 rounded-full -mt-6 mx-4 relative z-0">
        <div
          className="h-full bg-navy-700 rounded-full transition-all"
          style={{ width: `${(currentIndex / (STATUS_ORDER.length - 1)) * 100}%` }}
        />
      </div>
      <p className="text-sm text-slate-600 mt-4 text-center">
        {STATUS_DESCRIPTIONS[currentStatus]}
      </p>
    </div>
  );
}
