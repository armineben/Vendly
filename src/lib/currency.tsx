import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  locale: string;
  rate_to_tnd: number;
}

export interface ShippingZone {
  id: string;
  country_code: string;
  country_name: string;
  currency_code: string;
  shipping_fee: number;
}

interface CurrencyContextValue {
  currencies: Currency[];
  zones: ShippingZone[];
  loading: boolean;
  selectedCountry: string;
  selectedZone: ShippingZone | undefined;
  selectedCurrency: Currency | undefined;
  setSelectedCountry: (code: string) => void;
  formatPrice: (amountTnd: number) => string;
  shippingFeeTnd: number;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(
  undefined,
);

const DEFAULT_CURRENCY: Currency = {
  code: "TND",
  name: "Dinar Tunisien",
  symbol: "DT",
  locale: "fr-TN",
  rate_to_tnd: 1,
};

export function CurrencyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("TN");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("vendly-country");
      if (saved) setSelectedCountry(saved);
    } catch {}
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [curRes, zoneRes] = await Promise.all([
          supabase.from("currencies").select("*").eq("is_active", true),
          supabase.from("shipping_zones").select("*").eq("is_active", true),
        ]);
        if (curRes.error) throw curRes.error;
        if (zoneRes.error) throw zoneRes.error;
        setCurrencies(curRes.data ?? []);
        setZones(zoneRes.data ?? []);
      } catch (e) {
        console.error("Erreur chargement devises/zones:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const selectCountry = useCallback((code: string) => {
    setSelectedCountry(code);
    try {
      localStorage.setItem("vendly-country", code);
    } catch {}
  }, []);

  const selectedZone = zones.find((z) => z.country_code === selectedCountry);
  const selectedCurrency =
    currencies.find((c) => c.code === (selectedZone?.currency_code ?? "TND")) ??
    DEFAULT_CURRENCY;

  const formatPrice = useCallback(
    (amountTnd: number) => {
      const cur = selectedCurrency ?? DEFAULT_CURRENCY;
      const value = amountTnd * Number(cur.rate_to_tnd || 1);
      try {
        return new Intl.NumberFormat(cur.locale, {
          style: "currency",
          currency: cur.code,
          minimumFractionDigits: cur.code === "TND" ? 3 : 2,
          maximumFractionDigits: cur.code === "TND" ? 3 : 2,
        }).format(value);
      } catch {
        return `${value.toFixed(2)} ${cur.symbol}`;
      }
    },
    [selectedCurrency],
  );

  const shippingFeeTnd = selectedZone
    ? Number(selectedZone.shipping_fee || 0) /
      Number(selectedZone.currency_code === "TND"
        ? 1
        : (currencies.find((c) => c.code === selectedZone.currency_code)
            ?.rate_to_tnd ?? 1))
    : 0;

  return (
    <CurrencyContext.Provider
      value={{
        currencies,
        zones,
        loading,
        selectedCountry,
        selectedZone,
        selectedCurrency,
        setSelectedCountry: selectCountry,
        formatPrice,
        shippingFeeTnd,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency doit être utilisé dans CurrencyProvider");
  return ctx;
}
