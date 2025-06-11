"use client";

import React, { createContext, useState } from "react";
import "./globals.css";
import { Sidebar } from "@/components/component/sidebar";
import { Upperbar } from "@/components/component/upperbar";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export const WidthContext = createContext([220, () => {}]);

export default function RootLayout({ children }) {
  const [sidebarWidth, setSidebarWidth] = useState(220);

  return (
    <html lang="en" style={{ borderRadius: "20px", overflow: "hidden" }}>
      <body className="antialiased">
        <ThemeProvider>
          <WidthContext.Provider value={[sidebarWidth, setSidebarWidth]}>
            <div className="flex flex-col min-h-screen">
              <Upperbar />
              <div className="flex flex-1 pt-10">
                <Sidebar />
                <main
                  className="flex-1 p-4"
                  style={{ marginLeft: `${sidebarWidth}px` }}
                >
                  {children}
                  <Toaster />
                </main>
              </div>
            </div>
          </WidthContext.Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}
