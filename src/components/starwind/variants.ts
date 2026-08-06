import { tv } from "tailwind-variants";

export const input = tv({
  base: [
    "border-input dark:bg-input/30 text-foreground w-full rounded-md border bg-transparent shadow-xs",
    "focus-visible:border-outline focus-visible:ring-outline/50 transition-[color,box-shadow] focus-visible:ring-3",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "aria-invalid:border-error aria-invalid:focus-visible:ring-error/40",
    "peer placeholder:text-muted-foreground",
  ],
  variants: {
    size: { sm: "h-9 px-2 text-sm", md: "h-11 px-3 text-base", lg: "h-12 px-4 text-lg" },
  },
  defaultVariants: { size: "md" },
});

export const textarea = tv({
  base: [
    "border-input dark:bg-input/30 text-foreground ring-offset-background min-h-10 w-full rounded-md border bg-transparent shadow-xs",
    "focus-visible:border-outline focus-visible:ring-outline/50 transition-[color,box-shadow] focus-visible:ring-3",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "aria-invalid:border-error aria-invalid:focus-visible:ring-error/40",
    "peer placeholder:text-muted-foreground",
  ],
  variants: {
    size: {
      sm: "min-h-9 px-2 py-1 text-sm",
      md: "min-h-10 px-3 py-2 text-base",
      lg: "min-h-12 px-4 py-3 text-lg",
    },
  },
  defaultVariants: { size: "md" },
});

export const nativeSelectWrapper = tv({
  base: [
    "starwind-native-select-wrapper",
    "group/native-select relative w-full has-[select:disabled]:opacity-50",
  ],
});

export const nativeSelect = tv({
  base: [
    "starwind-native-select border-input dark:bg-input/30 text-foreground ring-offset-background w-full rounded-md border bg-transparent shadow-xs",
    "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground appearance-none bg-none select-none",
    "focus-visible:border-outline focus-visible:ring-outline/50 transition-[color,box-shadow] outline-none focus-visible:ring-3",
    "disabled:pointer-events-none disabled:cursor-not-allowed",
    "aria-invalid:border-error aria-invalid:focus-visible:ring-error/40 aria-invalid:focus-visible:ring-3",
  ],
  variants: {
    size: {
      sm: "h-9 pr-8 pl-2 text-sm",
      md: "h-11 pr-9 pl-3 text-base",
      lg: "h-12 pr-10 pl-4 text-lg",
    },
  },
  defaultVariants: { size: "md" },
});

export const nativeSelectIcon = tv({
  base: ["text-foreground pointer-events-none absolute top-1/2 -translate-y-1/2 opacity-50"],
  variants: {
    size: { sm: "right-2 size-3.5", md: "right-3 size-4", lg: "right-4 size-5" },
  },
  defaultVariants: { size: "md" },
});
