import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

export function FilterDropdown({
  label,
  options,
  value,
  onChange,
  icon: Icon,
  className = "",
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs font-semibold transition-colors hover:border-zinc-300 ${
          open ? "border-zinc-300 shadow-sm" : ""
        }`}
      >
        {Icon && <Icon className="h-4 w-4 text-zinc-400 shrink-0" />}
        <span className="text-zinc-700 truncate">
          {selected ? selected.label : label}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-56 rounded-xl border border-zinc-100 bg-white p-1.5 shadow-lg">
          {options.map((opt) => {
            const OptIcon = opt.icon;
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-left transition-colors ${
                  isSelected
                    ? "bg-orange-50 text-orange-700"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800"
                }`}
              >
                {OptIcon && (
                  <OptIcon
                    className={`h-4 w-4 shrink-0 ${
                      isSelected ? "text-orange-400" : "text-zinc-400"
                    }`}
                  />
                )}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
