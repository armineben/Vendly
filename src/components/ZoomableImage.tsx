import { useRef, useState, useEffect, useCallback } from "react";

const MAGNIFIER_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Ccircle cx='14' cy='14' r='13' fill='rgba(255,255,255,0.8)' stroke='rgba(0,0,0,0.12)' stroke-width='0.5'/%3E%3Ccircle cx='12' cy='12' r='4.5' fill='none' stroke='%23222' stroke-width='1.1'/%3E%3Cline x1='15.8' y1='15.8' x2='20' y2='20' stroke='%23222' stroke-width='1.1' stroke-linecap='round'/%3E%3C/svg%3E") 14 14, zoom-in`;

interface ZoomableImageProps {
  src: string;
  alt?: string;
  zoom?: number;
  lensSize?: number;
  className?: string;
}

export function ZoomableImage({
  src,
  alt = "",
  zoom = 2.5,
  lensSize = 160,
  className = "",
}: ZoomableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const rafRef = useRef(0);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setPos({
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      });
    });
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onMouseMove={handleMouseMove}
      style={{ cursor: hovering ? MAGNIFIER_CURSOR : undefined }}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        draggable={false}
      />

      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-200"
        style={{ opacity: hovering ? 1 : 0 }}
      >
        <div
          className="absolute rounded-full"
          style={{
            width: lensSize,
            height: lensSize,
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            transform: "translate(-50%, -50%)",
            backgroundImage: `url(${src})`,
            backgroundSize: `${zoom * 100}%`,
            backgroundPosition: `${pos.x}% ${pos.y}%`,
            backgroundRepeat: "no-repeat",
            boxShadow:
              "0 0 0 2px rgba(255,255,255,0.5), 0 8px 32px rgba(0,0,0,0.12)",
          }}
        />
      </div>
    </div>
  );
}
