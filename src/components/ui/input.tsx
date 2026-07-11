import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/60 selection:bg-primary/25 selection:text-foreground",
        "border-border h-10 w-full min-w-0 rounded-lg border bg-card text-foreground",
        "px-4 py-2.5 text-sm transition-all duration-200 outline-none",
        "shadow-[inset_0_2px_4px_rgba(61,44,30,0.04),0_1px_0_rgba(255,255,255,0.8)]",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-primary",
        "focus-visible:shadow-[inset_0_2px_4px_rgba(61,44,30,0.04),0_0_0_3px_rgba(139,90,43,0.12),0_1px_0_rgba(255,255,255,0.8)]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
