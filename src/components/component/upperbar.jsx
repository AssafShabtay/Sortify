"use client";

import React from "react";
import { WindowsControls } from "react-windows-controls";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTheme } from "@/components/providers/ThemeProvider";
import "./upperbarcss.css";

export function Upperbar() {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  function windowMinimize() {
    getCurrentWindow().minimize();
  }

  function windowMaximize() {
    getCurrentWindow().toggleMaximize();
  }

  function windowClose() {
    getCurrentWindow().close();
  }

  return (
    <div
      className="upperbar fixed top-0 left-0 right-0 z-50 flex justify-between items-center 
      bg-white/95 dark:bg-[rgb(15,19,26)]/95 
      backdrop-blur-md backdrop-saturate-150
      border-b border-theme-secondary-30 dark:border-[rgb(45,53,67)]
      shadow-sm dark:shadow-lg dark:shadow-black/20
      transition-all duration-300"
      data-tauri-drag-region
    >
      <div
        className="flex shrink-0 items-center px-4 h-10 flex-grow"
        data-tauri-drag-region
      >
        <a href="#">
          <img
            src="/Logo without slogan inverse.svg"
            alt="Sortify"
            className="h-[100px] w-auto mt-1"
          />
        </a>
      </div>
      <div className="flex h-10">
        <WindowsControls
          dark={isDarkMode}
          onClose={windowClose}
          onMaximize={windowMaximize}
          onMinimize={windowMinimize}
        />
      </div>
    </div>
  );
}
