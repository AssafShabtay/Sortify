"use client";

import React, { createContext, useState } from "react";
import "./globals.css";
import "./theme-override.css";
import { Sidebar } from "@/components/component/sidebar";
import { Upperbar } from "@/components/component/upperbar";
import { Toaster } from "@/components/ui/toaster";

export const Context = createContext([220, () => {}]);

export default function RootLayout({ children }) {
  const [sidebarWidth, setSidebarWidth] = useState(220);

  return (
    <html lang="en" style={{ borderRadius: "20px", overflow: "hidden" }}>
      <body className="antialiased">
        <Context.Provider value={[sidebarWidth, setSidebarWidth]}>
          <div className="flex flex-col min-h-screen">
            <div className="flex flex-col">
              <Upperbar />
            </div>
            <div className="flex flex-1" style={{ marginTop: "60px" }}>
              <Sidebar />
              <main
                className="flex-1"
                style={{ marginLeft: `${sidebarWidth}px` }}
              >
                {children}
                <Toaster />
              </main>
            </div>
          </div>
        </Context.Provider>
      </body>
    </html>
  );
}
