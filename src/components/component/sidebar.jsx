"use client";

import { useState, useCallback, useRef, useEffect, useContext } from "react";
import Link from "next/link";
import { WidthContext } from "@/app/layout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User, Settings, HelpCircle } from "lucide-react";

import { ThemeToggle } from "./utils/settings/ThemeToggle";
import React from "react";

export function Sidebar() {
  const [mounted, setMounted] = useState(false);
  const [activeLink, setActiveLink] = useState("dashboard");
  const [sidebarWidth, setSidebarWidth] = useContext(WidthContext);
  const sidebarRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const startResizing = useCallback((mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent) => {
      if (isResizing && sidebarRef.current) {
        const newWidth =
          mouseMoveEvent.clientX -
          sidebarRef.current.getBoundingClientRect().left;
        const screenWidth = window.innerWidth;
        const maxWidth = screenWidth * 0.2;
        const minWidth = screenWidth * 0.12;
        if (newWidth > minWidth && newWidth < maxWidth) {
          setSidebarWidth(newWidth);
        }
      }
    },
    [isResizing, setSidebarWidth]
  );

  useEffect(() => {
    console.log("Sidebar width changed to:", sidebarWidth);
  }, [sidebarWidth]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  if (!mounted) {
    return <div style={{ width: `${sidebarWidth}px` }} />;
  }

  return (
    <div
      ref={sidebarRef}
      className={`fixed top-[60px] bottom-0 left-0 flex flex-col border-r bg-background transition-colors ${
        isResizing ? "bg-blue-50" : ""
      }`}
      style={{ width: `${sidebarWidth}px` }}
    >
      <div
        className={`absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize bg-gray-300 hover:bg-gray-400 transition-colors z-10 ${
          isResizing ? "bg-blue-400" : ""
        }`}
        onMouseDown={startResizing}
      />

      {/* Main scrollable content */}
      <div className="flex flex-col h-full overflow-y-auto">
        <nav className="space-y-4 p-4">
          <div>
            <h3 className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Main
            </h3>
            <div className="grid gap-1">
              <Link
                href="/dashboard"
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeLink === "dashboard"
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setActiveLink("dashboard")}
                prefetch={false}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Dashboard
              </Link>
              <Link
                href="/extraTools"
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeLink === "Extras"
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setActiveLink("Extras")}
                prefetch={false}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <circle cx="8" cy="21" r="1" />
                  <circle cx="19" cy="21" r="1" />
                  <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                </svg>
                Extra Tools
              </Link>
              <Link
                href="#"
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeLink === "products"
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setActiveLink("products")}
                prefetch={false}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="m7.5 4.27 9 5.15" />
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                  <path d="m3.3 7 8.7 5 8.7-5" />
                  <path d="M12 22V12" />
                </svg>
                Products
              </Link>
            </div>
          </div>
          <div>
            <h3 className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Customers
            </h3>
            <div className="grid gap-1">
              <Link
                href="#"
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeLink === "customers"
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setActiveLink("customers")}
                prefetch={false}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Customers
              </Link>
              <Link
                href="#"
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeLink === "subscriptions"
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setActiveLink("subscriptions")}
                prefetch={false}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="m17 2 4 4-4 4" />
                  <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                  <path d="m7 22-4-4 4-4" />
                  <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                </svg>
                Subscriptions
              </Link>
            </div>
          </div>
          <div>
            <h3 className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Analytics
            </h3>
            <div className="grid gap-1">
              <Link
                href="#"
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeLink === "analytics"
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setActiveLink("analytics")}
                prefetch={false}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M3 3v18h18" />
                  <path d="m19 9-5 5-4-4-3 3" />
                </svg>
                Analytics
              </Link>
              <Link
                href="#"
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeLink === "reports"
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setActiveLink("reports")}
                prefetch={false}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                  <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                  <path d="M10 9H8" />
                  <path d="M16 13H8" />
                  <path d="M16 17H8" />
                </svg>
                Reports
              </Link>
            </div>
          </div>
          <div>
            <h3 className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Settings
            </h3>
            <div className="grid gap-1">
              <Link
                href="#"
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeLink === "settings"
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setActiveLink("settings")}
                prefetch={false}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Settings
              </Link>
              <Link
                href="#"
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeLink === "integrations"
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setActiveLink("integrations")}
                prefetch={false}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M12 22v-5" />
                  <path d="M9 8V2" />
                  <path d="M15 8V2" />
                  <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
                </svg>
                Integrations
              </Link>
            </div>
          </div>
        </nav>
      </div>

      {/* Profile Button - Fixed at the bottom */}
      <div className="sticky bottom-0 left-0 right-0 border-t bg-background p-4 mt-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/placeholder-avatar.jpg" alt="User" />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start text-left">
                <span className="font-medium">John Doe</span>
                <span className="text-xs text-muted-foreground">
                  john.doe@example.com
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <div className="flex items-center gap-2 p-2">
              <div className="flex flex-col space-y-0.5">
                <p className="text-sm font-medium">John Doe</p>
                <p className="text-xs text-muted-foreground">
                  john.doe@example.com
                </p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>My Account</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <HelpCircle className="mr-2 h-4 w-4" />
              <span>Help & Support</span>
            </DropdownMenuItem>

            <ThemeToggle />
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
