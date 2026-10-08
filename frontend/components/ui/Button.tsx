import type { ButtonHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

type Variant = "brass" | "ghost" | "rule";

const styles: Record<Variant, string> = {
  brass:
    "border border-brass text-brass hover:bg-brass hover:text-paper",
  ghost: "border border-transparent text-ink hover:border-rule",
  rule: "border border-rule text-ink hover:border-ink",
};

export function Button({
  variant = "rule",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={twMerge(
        "inline-flex items-center justify-center gap-2 rounded-[3px] px-3.5 py-2 text-[13px] tracking-wide transition-colors disabled:opacity-50",
        styles[variant],
        className
      )}
      {...props}
    />
  );
}
