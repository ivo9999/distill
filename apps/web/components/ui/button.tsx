import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "text-sm font-semibold",
    "transition-[background-color,border-color,box-shadow,color,filter,opacity] duration-100 ease-out",
    "hover:brightness-90 dark:hover:brightness-125",
    "disabled:pointer-events-none disabled:opacity-30",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
    "aria-invalid:outline-negative",
  ].join(" "),
  {
    variants: {
      variant: {
        // Fizzy default: white canvas, ink text, hairline ink-light border, pill
        default:
          "bg-canvas text-ink border border-ink-light",
        // Primary call-to-action: deep brand purple, white text, canvas
        // border. --link is repointed to --brand in globals.css so every
        // existing primary-button site picks up the brand automatically.
        primary:
          "bg-brand text-brand-foreground border border-canvas",
        // Discord-flavoured action: signals "this connects to your Discord"
        // (bot install, server picker, /distill commands). Use sparingly so
        // it stays meaningful — primary CTAs should still be `primary`.
        discord:
          "bg-brand-discord text-brand-discord-foreground border border-canvas",
        // Destructive / negative
        destructive:
          "bg-negative text-ink-inverted border border-negative",
        negative:
          "bg-negative text-ink-inverted border border-negative",
        // Positive / confirm
        positive:
          "bg-positive text-ink-inverted border border-canvas",
        // Reversed: dark on light (used as alt action)
        reversed:
          "bg-ink text-ink-inverted border border-canvas",
        // Outline: transparent bg, ink-light border
        outline:
          "bg-transparent text-ink border border-ink-light hover:bg-ink-lightest",
        // Secondary: ink-lightest bg
        secondary:
          "bg-ink-lightest text-ink border border-transparent",
        // Ghost: nothing until hover
        ghost:
          "bg-transparent text-ink border border-transparent hover:bg-ink-lightest",
        // Plain: zero chrome, used inside cells / toolbars
        plain:
          "bg-transparent text-inherit border-0 p-0 h-auto font-medium hover:brightness-100 hover:underline",
        // Text link
        link:
          "bg-transparent text-link underline-offset-4 hover:underline border-0 p-0 h-auto",
      },
      size: {
        // Pill-shaped sizes
        default: "h-9 px-4 rounded-pill has-[>svg]:px-3",
        sm: "h-8 px-3 rounded-pill text-xs gap-1.5 has-[>svg]:px-2.5",
        lg: "h-11 px-6 rounded-pill text-base has-[>svg]:px-5",
        // Icon variants — square footprint, fully rounded so it becomes a circle
        icon: "size-9 rounded-pill",
        "icon-sm": "size-8 rounded-pill",
        "icon-lg": "size-10 rounded-pill",
      },
    },
    compoundVariants: [
      // Plain & link variants are shape-less; size class shouldn't enforce a height
      { variant: "plain", className: "h-auto px-0 rounded-none" },
      { variant: "link", className: "h-auto px-0 rounded-none" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
