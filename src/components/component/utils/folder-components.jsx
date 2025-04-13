"use client";

import { useState, useRef, useEffect } from "react";

import { Folder, FolderOpen, MoreVertical, Check } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";

export function FolderCard({
  folder,
  isSelected,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver,
  isRenaming,
  onRenameStart,
  onRenameCancel,
  onRenameSubmit,
  newFolderName,
  onNewFolderNameChange,
  ...props
}) {
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef(null);

  // Focus the input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  // Handle key presses in the rename input
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      onRenameSubmit();
    } else if (e.key === "Escape") {
      onRenameCancel();
    }
  };

  // Handle drag over event
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    onDragOver && onDragOver(e);
  };

  // Handle drop event
  const handleDrop = (e) => {
    e.preventDefault();
    onDrop && onDrop(e);
  };

  // Prevent click propagation when in rename mode
  const handleCardClick = (e) => {
    if (isRenaming) {
      e.stopPropagation();
      return;
    }
    onClick && onClick(e);
  };

  return (
    <div
      data-folder-id={folder.id}
      data-selected={isSelected}
      className={cn(
        "border rounded-lg transition-all relative",
        "p-3 sm:p-4", // Increased padding for better spacing
        "hover:shadow-md", // Add shadow on hover for depth
        isSelected
          ? "bg-accent border-primary shadow-sm"
          : "hover:bg-accent/50",
        isDragOver ? "ring-2 ring-primary bg-accent/70" : "",
        isRenaming ? "ring-2 ring-primary" : "cursor-pointer"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
      onDragOver={handleDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      {...props}
    >
      <div className="absolute top-2 right-2 flex items-center gap-1">
        {isSelected && !isRenaming && (
          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
        {!isRenaming && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-70 hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRenameStart && onRenameStart();
                }}
              >
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem>Share</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {isRenaming ? (
        <div className="pt-1 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {isHovered || isSelected || isDragOver ? (
              <FolderOpen
                className={`h-10 w-10 flex-shrink-0 ${
                  folder.color || "text-primary"
                }`}
              />
            ) : (
              <Folder
                className={`h-10 w-10 flex-shrink-0 ${
                  folder.color || "text-primary"
                }`}
              />
            )}
            <Input
              ref={inputRef}
              value={newFolderName}
              onChange={onNewFolderNameChange}
              onKeyDown={handleKeyDown}
              className="flex-1"
              placeholder="Folder name"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="flex justify-end gap-2 mt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onRenameCancel && onRenameCancel();
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRenameSubmit && onRenameSubmit();
              }}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 pt-1">
          {isHovered || isSelected || isDragOver ? (
            <FolderOpen
              className={`h-10 w-10 flex-shrink-0 ${
                folder.color || "text-primary"
              }`}
            />
          ) : (
            <Folder
              className={`h-10 w-10 flex-shrink-0 ${
                folder.color || "text-primary"
              }`}
            />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm break-words line-clamp-2">
              {folder.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {folder.itemCount} items
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function ResizableSeparator({
  isResizing,
  children,
  onMouseDown,
  onTouchStart,
}) {
  return (
    <div
      className={cn(
        "w-4 h-full cursor-col-resize flex items-center justify-center z-20",
        isResizing && "bg-primary/20"
      )}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      <div
        className={cn(
          "w-0.5 h-full bg-border transition-all",
          "hover:bg-primary hover:w-1",
          isResizing && "bg-primary w-1"
        )}
      />
      {children}
    </div>
  );
}
