import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center px-3 py-1 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-all overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "text-primary-foreground rounded-md",
        secondary:
          "text-primary rounded-md border border-border",
        destructive:
          "text-white rounded-md focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground rounded-md border border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// 织物质感 - 默认徽章
const fabricDefault = `
  bg-gradient-to-b from-[#a67c52] to-[#8b5a2b]
  border border-[#7a4a1f]
  shadow-[0_1px_2px_rgba(61,44,30,0.15),0_1px_0_rgba(255,255,255,0.2)_inset]
`;

// 织物质感 - 次徽章
const fabricSecondary = `
  bg-gradient-to-b from-[#fdfbf7] to-[#f5efe3]
  shadow-[0_1px_2px_rgba(61,44,30,0.05)]
`;

// 织物质感 - 危险徽章
const fabricDestructive = `
  bg-gradient-to-b from-[#c97b78] to-[#b85450]
  border border-[#a04040]
  shadow-[0_1px_2px_rgba(61,44,30,0.15),0_1px_0_rgba(255,255,255,0.15)_inset]
`;

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  const fabricClass =
    variant === 'default' ? fabricDefault :
    variant === 'secondary' ? fabricSecondary :
    variant === 'destructive' ? fabricDestructive : '';

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), fabricClass, className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
