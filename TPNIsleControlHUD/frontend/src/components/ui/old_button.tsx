import { type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[1px] border-2 font-display font-medium uppercase tracking-[0.08em] transition-colors duration-100 ease-linear focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-moss disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        default: "border-moss bg-moss text-ink shadow-[0_0_6px_rgb(144_215_194/0.18)] hover:bg-[#b2dece]",
        ghost: "border-stone bg-[#061f1be0] text-bone hover:border-[#9bd7c4] hover:bg-[#114138f2] hover:text-[#c2e6d8]",
      },
      size: { default: "h-7 px-3 text-xs", icon: "size-7 p-0" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
