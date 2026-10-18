import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type TextSize = "normale" | "grande" | "molto-grande";
export const TEXT_SIZES: { value: TextSize; label: string; sample: string }[] = [
  { value: "normale", label: "Normale", sample: "Aa" },
  { value: "grande", label: "Grande", sample: "Aa" },
  { value: "molto-grande", label: "Molto grande", sample: "Aa" },
];

const KEY = "quadra.textSize";

function readSize(): TextSize {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "grande" || v === "molto-grande" || v === "normale") return v;
  } catch {
    /* storage non disponibile: si usa il valore predefinito */
  }
  return "normale";
}

const Ctx = createContext<{ size: TextSize; setSize: (s: TextSize) => void }>({
  size: "normale",
  setSize: () => {},
});

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [size, setSize] = useState<TextSize>(readSize);
  useEffect(() => {
    document.documentElement.dataset.size = size;
    try {
      localStorage.setItem(KEY, size);
    } catch {
      /* ignorato */
    }
  }, [size]);
  return <Ctx.Provider value={{ size, setSize }}>{children}</Ctx.Provider>;
}

export const usePrefs = () => useContext(Ctx);
