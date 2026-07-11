import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/30 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive select-none",
  {
    variants: {
      variant: {
        default:
          'text-primary-foreground rounded-lg border border-[#7a4a1f] active:translate-y-[1px]',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 rounded-lg',
        outline:
          'border bg-card hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 rounded-lg transition-all',
        secondary:
          'text-secondary-foreground rounded-lg border border-border hover:border-primary/50 active:translate-y-[1px]',
        ghost:
          'hover:bg-accent/50 hover:text-foreground dark:hover:bg-accent/50 rounded-lg',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2.5 has-[>svg]:px-4',
        sm: 'h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5 text-xs',
        lg: 'h-11 rounded-lg px-6 has-[>svg]:px-5 text-base',
        icon: 'size-10',
        'icon-sm': 'size-8',
        'icon-lg': 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

// 织物质感按钮 - 主按钮渐变
const fabricDefaultClass = `
  bg-gradient-to-b from-[#a67c52] to-[#8b5a2b]
  shadow-[0_2px_4px_rgba(61,44,30,0.15),0_1px_0_rgba(255,255,255,0.2)_inset]
  hover:from-[#b88c62] hover:to-[#9b6a3b]
  hover:shadow-[0_4px_8px_rgba(61,44,30,0.2),0_1px_0_rgba(255,255,255,0.25)_inset,0_-1px_0_rgba(0,0,0,0.1)_inset]
  hover:-translate-y-[1px]
  active:shadow-[0_1px_2px_rgba(61,44,30,0.15),0_1px_2px_rgba(0,0,0,0.1)_inset]
  transition-all duration-200 ease-out
`;

// 织物质感按钮 - 次按钮
const fabricSecondaryClass = `
  bg-gradient-to-b from-[#fdfbf7] to-[#f5efe3]
  text-primary
  shadow-[0_1px_2px_rgba(61,44,30,0.06),0_1px_0_rgba(255,255,255,1)_inset]
  hover:from-[#fefdfb] hover:to-[#f8f3e8]
  hover:shadow-[0_2px_6px_rgba(61,44,30,0.1),0_1px_0_rgba(255,255,255,1)_inset]
  hover:-translate-y-[1px]
  hover:border-primary
  transition-all duration-200 ease-out
`;

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  // 根据变体添加织物质感样式
  const fabricClass = variant === 'default' ? fabricDefaultClass : variant === 'secondary' ? fabricSecondaryClass : '';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }), fabricClass)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
