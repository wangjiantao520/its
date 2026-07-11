"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "bg-muted/50 text-muted-foreground inline-flex h-11 w-fit items-center justify-center rounded-lg p-1 border border-border/50",
        "shadow-[inset_0_1px_2px_rgba(61,44,30,0.04)]",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "data-[state=active]:bg-card dark:data-[state=active]:text-foreground",
        "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:outline-ring",
        "dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30",
        "text-foreground/80 dark:text-muted-foreground",
        "inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-4 py-1.5 text-sm font-medium whitespace-nowrap",
        "transition-all duration-200 ease-out",
        "focus-visible:ring-[3px] focus-visible:outline-1",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:shadow-[0_1px_2px_rgba(61,44,30,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]",
        "data-[state=active]:text-foreground data-[state=active]:border-border/60",
        "hover:text-foreground/90",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "flex-1 outline-none transition-opacity duration-200",
        "data-[state=inactive]:opacity-0 data-[state=active]:opacity-100",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
