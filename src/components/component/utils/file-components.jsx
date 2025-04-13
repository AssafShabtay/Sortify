"use client";

import {
  File,
  FileText,
  FileImage,
  FileAudio,
  FileVideo,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";
// File card - fix the styling to look better in the folder
export function FileCard({
  file,
  displayMode = "normal",
  onDragStart,
  onDragEnd,
  isDragging,
  isSelected,
  fileRef,
  onClick,
}) {
  // Get the appropriate icon based on file type and display mode
  const getFileIcon = () => {
    const iconSize =
      displayMode === "micro"
        ? "h-4 w-4"
        : displayMode === "compact"
        ? "h-5 w-5"
        : "h-6 w-6 sm:h-8 sm:w-8";

    switch (file.type) {
      case "document":
        return <FileText className={`${iconSize} text-blue-500`} />;
      case "image":
        return <FileImage className={`${iconSize} text-green-500`} />;
      case "audio":
        return <FileAudio className={`${iconSize} text-purple-500`} />;
      case "video":
        return <FileVideo className={`${iconSize} text-red-500`} />;
      default:
        return <File className={`${iconSize} text-gray-500`} />;
    }
  };

  const getFileExtension = () => {
    const parts = file.name.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "";
  };

  // Handle drag start with the file data
  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = "move";

    // Create a more visually appealing drag image that looks like the file card
    const dragPreview = document.createElement("div");
    dragPreview.className = "drag-preview";
    dragPreview.style.width = "200px";
    dragPreview.style.padding = "12px";
    dragPreview.style.background = "white";
    dragPreview.style.border = "1px solid #ccc";
    dragPreview.style.borderRadius = "8px";
    dragPreview.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    dragPreview.style.display = "flex";
    dragPreview.style.alignItems = "center";
    dragPreview.style.gap = "12px";
    dragPreview.style.pointerEvents = "none";
    dragPreview.style.zIndex = "9999";

    // Get the drag result once to avoid calling the function multiple times
    const dragResult =
      onDragStart && typeof onDragStart === "function" ? onDragStart() : null;
    const isMultiDrag =
      dragResult && Array.isArray(dragResult) && dragResult.length > 1;
    const fileCount = isMultiDrag ? dragResult.length : 1;

    if (isMultiDrag) {
      // Create a multi-file drag preview
      // Create icon element with stacked appearance
      const iconElement = document.createElement("div");
      iconElement.style.position = "relative";
      iconElement.style.width = "32px";
      iconElement.style.height = "32px";

      // Main icon
      iconElement.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        class="text-blue-500" style="position: absolute; top: 0; left: 0; z-index: 3;">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        class="text-green-500" style="position: absolute; top: 4px; left: 4px; z-index: 2;">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        class="text-purple-500" style="position: absolute; top: 8px; left: 8px; z-index: 1;">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
    `;

      // Create text content for multiple files
      const textElement = document.createElement("div");
      textElement.style.overflow = "hidden";
      textElement.innerHTML = `
      <div style="font-weight: 500; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Multiple Files (${fileCount})</div>
      <div style="font-size: 12px; color: #666;">Selected items</div>
    `;

      // Append elements to preview
      dragPreview.appendChild(iconElement);
      dragPreview.appendChild(textElement);
    } else {
      // Create icon element based on file type
      const iconElement = document.createElement("div");
      iconElement.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        class="${
          file.type === "document"
            ? "text-blue-500"
            : file.type === "image"
            ? "text-green-500"
            : file.type === "audio"
            ? "text-purple-500"
            : file.type === "video"
            ? "text-red-500"
            : "text-gray-500"
        }">
        ${
          file.type === "document"
            ? '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line>'
            : file.type === "image"
            ? '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>'
            : file.type === "audio"
            ? '<path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>'
            : file.type === "video"
            ? '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="m10 11 5 3-5 3v-6z"></path>'
            : '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline>'
        }
      </svg>
    `;

      // Create text content
      const textElement = document.createElement("div");
      textElement.style.overflow = "hidden";
      textElement.innerHTML = `
      <div style="font-weight: 500; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${file.name}</div>
      <div style="font-size: 12px; color: #666;">${file.size}</div>
    `;

      // Append elements to preview
      dragPreview.appendChild(iconElement);
      dragPreview.appendChild(textElement);
    }

    // Add to document temporarily
    document.body.appendChild(dragPreview);

    // Set as drag image
    try {
      e.dataTransfer.setDragImage(dragPreview, 30, 20);
    } catch (err) {
      console.error("Error setting drag image:", err);
    }

    // We don't need to call onDragStart again since we already called it above
    // This prevents double-calling and potential issues

    // Clean up the temporary element after a short delay
    setTimeout(() => {
      document.body.removeChild(dragPreview);
    }, 100);
  };

  // Handle drag end with cursor reset
  const handleDragEnd = (e) => {
    // Call the parent's onDragEnd handler
    if (onDragEnd) {
      onDragEnd(e);
    }

    // Reset cursor explicitly
    document.body.classList.remove("file-dragging");
    document.body.style.cursor = "";

    // Add a class to reset cursor
    document.body.classList.add("cursor-reset");
    document.documentElement.classList.add("force-cursor-reset");

    // Remove the class after a short delay
    setTimeout(() => {
      document.body.classList.remove("cursor-reset");
      document.documentElement.classList.remove("force-cursor-reset");
    }, 100);

    console.log("File drag end - cursor reset");
  };

  // Micro view for very small widths
  if (displayMode === "micro") {
    return (
      <div
        ref={fileRef}
        className={cn(
          "border rounded-lg p-1 hover:bg-accent/50 transition-colors w-full overflow-hidden cursor-pointer",
          isSelected && "file-selected",
          isDragging ? "opacity-50 ring-2 ring-primary" : ""
        )}
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={(e) => onClick && onClick(e)}
        data-file-id={file.id}
      >
        <div className="flex flex-col items-center text-center">
          <div className="relative flex-shrink-0">
            {getFileIcon()}
            <span className="absolute bottom-0 right-0 text-[6px] font-bold bg-background rounded-sm px-0.5">
              {getFileExtension()}
            </span>
          </div>
          <div className="w-full mt-0.5">
            <h3
              className="font-medium text-[8px] truncate max-w-full"
              title={file.name}
            >
              {file.name}
            </h3>
          </div>
        </div>
      </div>
    );
  }

  // Compact view for medium widths
  if (displayMode === "compact") {
    return (
      <div
        ref={fileRef}
        className={cn(
          "border rounded-lg p-1.5 hover:bg-accent/50 transition-colors w-full overflow-hidden cursor-pointer",
          isSelected && "file-selected",
          isDragging ? "opacity-50 ring-2 ring-primary" : ""
        )}
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={(e) => onClick && onClick(e)}
        data-file-id={file.id}
      >
        <div className="flex flex-col items-center text-center gap-1">
          <div className="relative flex-shrink-0">
            {getFileIcon()}
            <span className="absolute bottom-0 right-0 text-[8px] font-bold bg-background rounded-sm px-0.5">
              {getFileExtension()}
            </span>
          </div>
          <div className="w-full">
            <h3
              className="font-medium text-xs truncate max-w-full"
              title={file.name}
            >
              {file.name}
            </h3>
          </div>
        </div>
      </div>
    );
  }

  // Normal view for larger widths
  return (
    <div
      ref={fileRef}
      className={cn(
        "border rounded-lg p-3 hover:bg-accent/50 transition-colors w-full overflow-hidden cursor-pointer",
        isSelected && "file-selected",
        isDragging ? "opacity-50 ring-2 ring-primary" : ""
      )}
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={(e) => onClick && onClick(e)}
      data-file-id={file.id}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">{getFileIcon()}</div>
        <div className="overflow-hidden flex-1">
          <h3 className="font-medium text-sm truncate">{file.name}</h3>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{file.size}</span>
              <span className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {file.lastModified}
              </span>
            </div>
            {file.path && (
              <div
                className="text-xs text-muted-foreground truncate max-w-full"
                title={file.path}
              >
                {file.path}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
