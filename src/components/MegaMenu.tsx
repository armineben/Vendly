import { useState, useRef, useEffect } from "react";

export interface MegaMenuColumn {
  heading: string;
  items: string[];
}

export interface MegaMenuItem {
  id: string;
  title: string;
  columns: MegaMenuColumn[];
}

interface MegaMenuProps {
  items: MegaMenuItem[];
  activeGenre: string | null;
  activeSubCategory: string | null;
  onSelectAll: () => void;
  onSelectGenre: (genre: string) => void;
  onSelectSubCategory: (genre: string, subCategory: string) => void;
  extra?: React.ReactNode;
  isAllActive?: boolean;
  saleCount?: number;
  isSaleActive?: boolean;
  onSelectSale?: () => void;
}

export const MEGA_MENU_ITEMS: MegaMenuItem[] = [
  {
    id: "femme",
    title: "Mode Femme",
    columns: [
      {
        heading: "Vêtements",
        items: ["Robes", "Tops & Chemisiers", "Pantalons", "Jupes", "Manteaux & Vestes"],
      },
      {
        heading: "Chaussures",
        items: ["Escarpins", "Baskets", "Bottes", "Sandales"],
      },
      {
        heading: "Accessoires",
        items: ["Sacs", "Bijoux", "Ceintures", "Écharpes & Foulards"],
      },
    ],
  },
  {
    id: "homme",
    title: "Mode Homme",
    columns: [
      {
        heading: "Vêtements",
        items: ["Chemises", "T-shirts", "Pantalons", "Costumes", "Manteaux"],
      },
      {
        heading: "Chaussures",
        items: ["Baskets", "Souliers", "Bottes", "Mocassins"],
      },
      {
        heading: "Accessoires",
        items: ["Montres", "Ceintures", "Lunettes", "Cravates"],
      },
    ],
  },
  {
    id: "enfant",
    title: "Mode Enfant",
    columns: [
      {
        heading: "Vêtements",
        items: ["Garçon", "Fille", "Bébé Garçon", "Bébé Fille"],
      },
      {
        heading: "Accessoires",
        items: ["Accessoires"],
      },
    ],
  },
  {
    id: "montres",
    title: "Montres",
    columns: [
      {
        heading: "Montres",
        items: ["Montre"],
      },
    ],
  },
  {
    id: "parfums",
    title: "Parfums",
    columns: [
      {
        heading: "Parfums",
        items: ["Parfum Homme", "Parfum Femme"],
      },
    ],
  },
  {
    id: "accessoires",
    title: "Accessoires",
    columns: [
      {
        heading: "Accessoires",
        items: ["Sacs", "Bijoux", "Ceintures", "Montres", "Lunettes"],
      },
    ],
  },
];

export function MegaMenu({
  items,
  activeGenre,
  activeSubCategory,
  onSelectAll,
  onSelectGenre,
  onSelectSubCategory,
  extra,
  isAllActive,
  saleCount = 0,
  isSaleActive = false,
  onSelectSale,
}: MegaMenuProps) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openDropdown = (id: string) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setActiveDropdown(id), 120);
  };

  const closeDropdown = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setActiveDropdown(null), 200);
  };

  const cancelHover = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    };
  }, []);

  const activeItem = activeDropdown
    ? items.find((i) => i.id === activeDropdown)
    : null;

  return (
    <div
      ref={menuRef}
      className="relative"
      onMouseEnter={cancelHover}
      onMouseLeave={closeDropdown}
    >
      <div className="flex justify-center gap-4 md:gap-10 py-8 px-4 bg-white border-b border-gray-100">
        <button
          onClick={() => {
            onSelectAll();
            setActiveDropdown(null);
          }}
          className={`text-[11px] font-medium uppercase tracking-[0.15em] transition-all pb-1 border-b-2 ${isAllActive ?? (!activeGenre && !isSaleActive) ? "border-black text-black" : "border-transparent text-gray-400 hover:text-black"}`}
        >
          Tout
        </button>

        {saleCount > 0 && (
          <button
            onClick={() => {
              if (onSelectSale) onSelectSale();
              setActiveDropdown(null);
            }}
            className={`text-[11px] font-semibold uppercase tracking-[0.15em] transition-all pb-1 border-b-2 ${isSaleActive ? "border-red-600 text-red-600" : "border-transparent text-red-500 hover:text-red-600"}`}
          >
            Soldes
          </button>
        )}

        {items.map((item) => (
          <div
            key={item.id}
            className="relative"
            onMouseEnter={() => openDropdown(item.id)}
          >
            <button
              onClick={() => {
                onSelectGenre(item.title);
                setActiveDropdown(null);
              }}
              className={`text-[11px] font-medium uppercase tracking-[0.15em] transition-all pb-1 border-b-2 ${activeGenre === item.title ? "border-black text-black" : "border-transparent text-gray-400 hover:text-black"}`}
            >
              {item.title}
            </button>
          </div>
        ))}

        {extra}
      </div>

      <div
        onMouseEnter={cancelHover}
        className={`absolute left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-100 shadow-lg transition-all duration-300 ease-out before:content-[''] before:absolute before:left-0 before:right-0 before:-top-8 before:h-8 ${activeDropdown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[-10px] pointer-events-none"}`}
      >
        {activeItem && (
          <div className="max-w-5xl mx-auto px-8 py-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {activeItem.columns.map((col) => (
                <div key={col.heading}>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400 mb-4">
                    {col.heading}
                  </h3>
                  <ul className="space-y-2.5">
                    {col.items.map((subItem) => (
                      <li key={subItem}>
                        <button
                          onClick={() => {
                            onSelectSubCategory(activeItem.title, subItem);
                            setActiveDropdown(null);
                          }}
                          className={`text-sm transition-colors ${activeGenre === activeItem.title && activeSubCategory === subItem ? "text-black font-medium" : "text-gray-600 hover:text-black"}`}
                        >
                          {subItem}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
