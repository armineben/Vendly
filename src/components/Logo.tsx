import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  className?: string;
  withRing?: boolean;
}

// Logo officiel Vendly : icône de marque depuis public/icons
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
        src="/icons/icon-192.png"
        alt="Vendly"
        className="w-full h-full object-cover"
        draggable={false}
      />
    </div>
  );
}