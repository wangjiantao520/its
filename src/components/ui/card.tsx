"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TiltCard } from "./tilt-card";

function Card({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <TiltCard
      data-slot="card"
      className={cn(
        "bg-gradient-to-br from-[#fdfcf9] to-[#faf7f2] rounded-2xl shadow-fabric-sm",
        "border border-[#ece0d0]/70",
        "overflow-hidden",
        className
      )}
      max={5}
      scale={1.015}
      perspective={1200}
      speed={350}
      glareOpacity={0.2}
      {...props}
    >
      {children}
    </TiltCard>
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex flex-col gap-1.5 p-4 border-b border-border/30",
        "bg-gradient-to-b from-white/40 to-transparent",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-serif text-[#5c4a3a] leading-none tracking-tight font-semibold text-base",
        className
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-xs text-[#a08a72] leading-relaxed", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-4 relative z-10", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center p-4 pt-0 gap-2 border-t border-border/30 mt-auto",
        "bg-gradient-to-t from-[#faf7f2]/50 to-transparent",
        className
      )}
      {...props}
    />
  );
}

// 不带3D效果的卡片，用于特殊场景
function StaticCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-static"
      className={cn(
        "bg-gradient-to-br from-[#fdfcf9] to-[#faf7f2] rounded-2xl shadow-fabric-sm",
        "border border-[#ece0d0]/70",
        "overflow-hidden",
        className
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, StaticCard };