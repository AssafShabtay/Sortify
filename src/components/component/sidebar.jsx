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
