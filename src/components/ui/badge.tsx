import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

export const badgeVariants = cva("cms-ui-badge", {
  variants: {
    variant: {
      default: "cms-ui-badge--default",
      secondary: "cms-ui-badge--secondary",
      outline: "cms-ui-badge--outline",
      success: "cms-ui-badge--success",
      warning: "cms-ui-badge--warning",
      destructive: "cms-ui-badge--destructive",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
