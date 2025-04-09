import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "red";
}

export function Button({
  className,
  variant = "default",
  ...props
}: ButtonProps) {
  const baseClasses = "px-4 py-2 rounded font-semibold transition-colors duration-200";
  
  const variantClasses =
    variant === "outline"
      ? "border border-gray-300 text-gray-700 hover:bg-gray-100"
      : variant === "red"
      ? "bg-red-600 text-white hover:bg-red-700"
      : "bg-blue-600 text-white hover:bg-blue-700";

  return (
    <button className={cn(baseClasses, variantClasses, className)} {...props} />
  );
}
