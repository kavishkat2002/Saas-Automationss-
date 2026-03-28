import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface BusinessSettings {
  businessName: string;
  tagline: string;
  logoUrl: string;
}

interface BusinessContextType extends BusinessSettings {
  updateBusiness: (settings: Partial<BusinessSettings>) => void;
}

const STORAGE_KEY = "business_settings";

const defaults: BusinessSettings = {
  businessName: "Bizz Auto CRM",
  tagline: "Next-Gen CRM for Next Level Business",
  logoUrl: "",
};

const BusinessContext = createContext<BusinessContextType>({
  ...defaults,
  updateBusiness: () => {},
});

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BusinessSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch {
      return defaults;
    }
  });

  const updateBusiness = (partial: Partial<BusinessSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <BusinessContext.Provider value={{ ...settings, updateBusiness }}>
      {children}
    </BusinessContext.Provider>
  );
}

export const useBusiness = () => useContext(BusinessContext);
