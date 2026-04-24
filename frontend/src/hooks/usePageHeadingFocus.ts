import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export function usePageHeadingFocus<T extends HTMLElement>() {
  const headingRef = useRef<T>(null);
  const location = useLocation();

  useEffect(() => {
    requestAnimationFrame(() => {
      headingRef.current?.focus();
    });
  }, [location.pathname]);

  return headingRef;
}
