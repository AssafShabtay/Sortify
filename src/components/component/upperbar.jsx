"use client";

import React from "react";
import Link from "next/link";
import { WindowsControls } from "react-windows-controls";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./upperbarcss.css";

export function Upperbar() {
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
      className="upperbar fixed top-0 left-0 right-0 z-50 flex justify-between items-center border-b bg-background"
      data-tauri-drag-region
    >
      <div
        className="flex shrink-0 items-center px-6 h-10 flex-grow"
        data-tauri-drag-region
      >
        <Link href="#" className="flex items-center gap-2 font-semibold">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
            <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9" />
            <path d="M12 3v6" />
          </svg>
          <span className="text-s">Sortify</span>
        </Link>
      </div>
      <div className="flex h-10">
        <WindowsControls
          onClose={windowClose}
          onMaximize={windowMaximize}
          onMinimize={windowMinimize}
        />
      </div>
    </div>
  );
}
