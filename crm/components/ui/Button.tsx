import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-cyan text-black hover:bg-cyan-dark",
  secondary: "border border-border-hover text-text hover:bg-surface-2",
  ghost: "text-text-muted hover:bg-surface-2 hover:text-text",
  danger: "text-danger hover:bg-danger/10",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

/** Botão padrão do sistema: variantes (primário, secundário, ghost, perigo) e dois tamanhos. */
export default function Button({ variant = "primary", size = "md", className = "", type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    />
  );
}
