import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

export const buttonVariants = cva("cms-ui-button", {
  variants: {
    variant: {
      default: "cms-ui-button--default",
      outline: "cms-ui-button--outline",
      ghost: "cms-ui-button--ghost",
      secondary: "cms-ui-button--secondary",
      destructive: "cms-ui-button--destructive",
      link: "cms-ui-button--link",
    },
    size: {
      default: "cms-ui-button--default-size",
      sm: "cms-ui-button--sm",
      lg: "cms-ui-button--lg",
      icon: "cms-ui-button--icon",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
