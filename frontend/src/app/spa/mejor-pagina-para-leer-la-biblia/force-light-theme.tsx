"use client";

import { useEffect } from "react";

/**
 * ForceLightTheme client component.
 * It removes the 'dark' class from the html element and sets colorScheme to 'light'
 * during its mount cycle, restoring the original state on unmount.
 */
export function ForceLightTheme() {
  useEffect(() => {
    const html = document.documentElement;
    const hasDark = html.classList.contains("dark");
    
    if (hasDark) {
      html.classList.remove("dark");
    }
    
    const prevColorScheme = html.style.colorScheme;
    html.style.colorScheme = "light";

    return () => {
      // Restore previous state on component unmount
      if (hasDark) {
        html.classList.add("dark");
      }
      if (prevColorScheme) {
        html.style.colorScheme = prevColorScheme;
      } else {
        html.style.removeProperty("color-scheme");
      }
    };
  }, []);

  return null;
}
