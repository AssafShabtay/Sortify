"use client";

import React from "react";
import { Switch } from "@/components/ui/switch";
import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "@/components/providers/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

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
