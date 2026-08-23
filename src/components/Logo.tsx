import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  className?: string;
  withRing?: boolean;
  variant?: "dark" | "light";
}

// Logo officiel Vendly : monogramme "V" sur fond violet de marque (#5C2D91)
export function Logo({
  size = 40,
  className,
  withRing = true,
  variant = "dark",
}: LogoProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden",
        variant === "dark" ? "bg-[#5C2D91]" : "bg-white",
        withRing && "ring-2 ring-accent/30 shadow-sm",
        className,
      )}
      style={{ width: size, height: size, borderRadius: size * 0.3 }}
      aria-label="Vendly"
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.62}
        height={size * 0.62}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3 5.5L9 19L12 11L15 19L21 5.5"
          stroke={variant === "dark" ? "#FFFFFF" : "#5C2D91"}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
