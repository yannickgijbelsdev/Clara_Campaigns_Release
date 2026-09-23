import { ChevronLeft } from "lucide-react";

export function Logo({ className = "" }) {
  return (
    <div className={`flex items-center select-none ${className}`}>
      <ChevronLeft className="h-5 w-5 text-rose-600 -mr-1" strokeWidth={3} />
      <span className="font-display font-bold text-[19px] tracking-tight text-rose-600 leading-none">clara</span>
      <sup className="font-display text-[10px] font-semibold text-rose-400 ml-0.5 -translate-y-1">campaigns</sup>
    </div>
  );
}
