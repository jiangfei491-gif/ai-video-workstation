"use client";

import { FiLoader } from "react-icons/fi";

type Props = {
  children: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  onClick?: () => void;
  className?: string;
  title?: string;
};

export default function LoadingButton({
  children,
  loading = false,
  loadingText,
  disabled = false,
  variant = "primary",
  onClick,
  className = "",
  title,
}: Props) {
  const base =
    variant === "primary"
      ? "btn-primary shadow-sm hover:shadow-md active:scale-[0.98]"
      : "btn-secondary shadow-sm hover:shadow-md active:scale-[0.98]";

  return (
    <button
      type="button"
      title={title}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${base} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && <FiLoader className="h-4 w-4 shrink-0 animate-spin" />}
      {loading ? (loadingText ?? "处理中…") : children}
    </button>
  );
}
