"use client";

import React, { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { FiMoon, FiSun } from "react-icons/fi";

export function ThemeToggle() {
  const [theme, setTheme] = useState("light");

  // Initialize theme from localStorage or system preference on component mount
  useEffect(() => {
    // Check if theme is stored in localStorage
    const storedTheme = localStorage.getItem("theme");
    // Check system preference
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    if (storedTheme) {
      setTheme(storedTheme);
    } else {
      // Apply system preference if no stored theme
      setTheme(prefersDark ? "dark" : "light");
    }

    // Apply theme
    applyTheme(storedTheme || (prefersDark ? "dark" : "light"));
  }, []);

  // Apply theme changes to document
  const applyTheme = (newTheme) => {
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Toggle theme function
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  };

  return (
    <div className="flex items-center space-x-2 p-2">
      <FiSun className="h-4 w-4 text-gray-500" />
      <Switch
        checked={theme === "dark"}
        onCheckedChange={toggleTheme}
        className="data-[state=checked]:bg-primary"
        title={
          theme === "light" ? "Switch to dark mode" : "Switch to light mode"
        }
      />
      <FiMoon className="h-4 w-4 text-gray-500" />
      <span className="sr-only">Toggle theme</span>
    </div>
  );
}
