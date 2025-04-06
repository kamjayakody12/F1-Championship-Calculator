import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline";
}

export function Button({
  className,
  variant = "default",
  ...props
}: ButtonProps) {
  const baseClasses = "px-4 py-2 rounded font-semibold";
  const variantClasses =
    variant === "outline"
      ? "border border-gray-300 text-gray-700"
      : "bg-blue-600 text-white";
  return (
    <button className={cn(baseClasses, variantClasses, className)} {...props} />
  );
}
