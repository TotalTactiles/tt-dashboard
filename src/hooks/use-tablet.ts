import { useState, useEffect } from "react";

export function useIsTablet() {
  const [isTablet, setIsTablet] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (max-width: 1199px)");
    setIsTablet(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTablet(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isTablet;
}
