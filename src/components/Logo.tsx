import logoUrl from "@/assets/logo.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  className?: string;
  withRing?: boolean;
}

export function Logo({ size = 40, className, withRing = true }: LogoProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white",
        withRing && "ring-2 ring-accent/30 shadow-sm",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={logoUrl}
        alt="Vendly"
        className="h-full w-full object-cover"
        draggable={false}
      />
    </div>
  );
}
