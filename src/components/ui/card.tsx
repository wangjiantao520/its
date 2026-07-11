import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "text-card-foreground flex flex-col gap-6 rounded-xl border border-border/70",
        "bg-gradient-to-b from-[#fdfcf9] to-[#faf7f2]",
        "shadow-[0_1px_3px_rgba(92,74,58,0.05),0_4px_12px_rgba(92,74,58,0.06),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(166,124,82,0.03)]",
        "hover:shadow-[0_4px_8px_rgba(92,74,58,0.08),0_20px_40px_rgba(92,74,58,0.12),inset_0_1px_0_rgba(255,255,255,1)]",
        "transition-all duration-[260ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        "hover:-translate-y-2 hover:[transform:perspective(1000px)_rotateY(-5deg)_rotateX(2deg)]",
        "will-change-transform",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-4 pt-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-3 border-b border-border/40",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold font-serif text-foreground", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-xs", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-4 py-3", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center px-4 pb-4 [.border-t]:pt-3 border-t border-border/40",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
