import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-slate-300/90 bg-white/92 px-3 py-2 text-base text-slate-900 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.55)] transition-[color,box-shadow,border-color,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-slate-500 focus-visible:border-slate-400 focus-visible:ring-3 focus-visible:ring-slate-300/35 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:border-slate-600/80 dark:bg-slate-950/72 dark:text-slate-50 dark:placeholder:text-slate-400 dark:focus-visible:border-slate-400 dark:focus-visible:ring-slate-400/25 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
