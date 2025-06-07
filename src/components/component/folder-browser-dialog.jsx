"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Folder,
  Plus,
  GripVertical,
  Save,
  RotateCcw,
  Edit,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FolderCard, ResizableSeparator } from "./utils/folder-components";
import { FileCard } from "./utils/file-components";
import { useDragDropHandlers, saveChanges } from "./utils/drag-drop-handlers";
import {
  getFolderById,
  getDisplayMode,
  getGridColumns,
  addDragDropStyles,
  addNoSelectStyle,
  MIN_FOLDER_WIDTH_PERCENT,
  MIN_FOLDER_WIDTH_PIXELS,
} from "./utils/folder-browser-utils";

// Add these imports at the top of the file
import { fetchFolderData, transformFolderData } from "./utils/data-loader";
import { Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge"; // Add this import
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"; // Add this import

export default function FolderBrowserDialog({
  isOpen,
  onOpenChange,
  baseOutput,
  toast,
}) {
  const [folderFiles, setFolderFiles] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState({}); // Store selected file IDs per folder: { folderId: Set<fileId> }
  const [draggedItems, setDraggedItems] = useState(null); // Array of files being dragged
  const [selectionBox, setSelectionBox] = useState(null); // { startX, startY, currentX, currentY, folderId }
  const [currentFolderId, setCurrentFolderId] = useState(null); // Currently active/focused folder

  const [savingProgress, setSavingProgress] = useState(0);
  const [savingMessage, setSavingMessage] = useState("");

  const [selectedFolderIds, setSelectedFolderIds] = useState([]);
  const [folderWidths, setFolderWidths] = useState({});
  const [folderZoom, setFolderZoom] = useState({});
  const containerRef = useRef(null);
  const dialogRef = useRef(null);
  const foldersPanelRef = useRef(null);
  const fileContainerRefs = useRef({}); // Refs for each folder's file list container
  const fileRefs = useRef({}); // Refs for individual file cards: { folderId: { fileId: ref } }
  const [resizingIndex, setResizingIndex] = useState(null); // null means no resizing happening
  const [foldersPanelWidth, setFoldersPanelWidth] = useState(25); // Default 25% width
  const [folderGridColumns, setFolderGridColumns] = useState(2); // Default 2 columns
  const [containerWidth, setContainerWidth] = useState(0);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isPanelNarrow, setIsPanelNarrow] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState(null);

  // Add renamingFolderId and newFolderName states after the other state declarations
  const [renamingFolderId, setRenamingFolderId] = useState(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderData, setFolderData] = useState([]);

  // Add these new state variables after the other state declarations
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Add state for tracking the current base output path
  const [currentBaseOutput, setCurrentBaseOutput] = useState(baseOutput);
  const [isChangingBaseOutput, setIsChangingBaseOutput] = useState(false);

  const {
    handleFileDragStart,
    handleFileDragEnd,
    handleFolderDragOver,
    handleFolderDragLeave,
    handleFolderDrop,
  } = useDragDropHandlers(
    folderFiles,
    setFolderFiles,
    setHasChanges,
    folderData,
    setFolderData
  );

  // Update currentBaseOutput when baseOutput prop changes
  useEffect(() => {
    setCurrentBaseOutput(baseOutput);
  }, [baseOutput]);

  // Reset cursor when component unmounts or dialog closes
  useEffect(() => {
    return () => {
      // Reset cursor styles explicitly
      document.body.style.cursor = "";
      document.body.classList.remove("file-dragging");
      document.body.classList.add("cursor-reset");

      setTimeout(() => {
        document.body.classList.remove("cursor-reset");
      }, 100);
    };
  }, [isOpen]);

  // Reset folder widths when selection changes
  useEffect(() => {
    if (selectedFolderIds.length > 0) {
      const equalWidth = 100 / selectedFolderIds.length;
      const newWidths = {};
      const newZoom = {};

      selectedFolderIds.forEach((id) => {
        newWidths[id] = equalWidth;
        newZoom[id] = 1.0;
      });

      // Batch these state updates to prevent multiple re-renders
      setSelectedFiles({});
      setSelectionBox(null);
      setIsSelecting(false);

      // Use requestAnimationFrame to defer heavy operations
      requestAnimationFrame(() => {
        setFolderWidths(newWidths);
        setFolderZoom(newZoom);

        // Defer container width calculation
        requestAnimationFrame(() => {
          if (containerRef.current) {
            setContainerWidth(containerRef.current.offsetWidth);
          }
        });
      });
    }
  }, [selectedFolderIds.length]);

  // Update container width when it changes
  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
  }, [selectedFolderIds, folderWidths]);

  // Handle window resize and check folder panel width
  useEffect(() => {
    const handleResize = () => {
      // Force re-render on window resize to update folder widths
      setFolderWidths((prev) => ({ ...prev }));

      // Update container width
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }

      // Check folder panel width and adjust grid columns
      updateFolderGridColumns();

      // Check if panel is narrow
      checkPanelWidth();
    };

    // Check initial size
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Add CSS for drag and drop
  useEffect(() => {
    return addDragDropStyles();
  }, []);

  // Add/remove no-select class on body when resizing
  useEffect(() => {
    if (resizingIndex !== null || isSelecting) {
      document.body.classList.add("resize-active");
    } else {
      document.body.classList.remove("resize-active");
    }

    // Add style for no text selection if it doesn't exist
    addNoSelectStyle();

    return () => {
      document.body.classList.remove("resize-active");
    };
  }, [resizingIndex, isSelecting]);

  // Update folder grid columns based on available width
  const updateFolderGridColumns = () => {
    if (!foldersPanelRef.current) return;

    const panelWidth = foldersPanelRef.current.offsetWidth;

    // More conservative column calculation to ensure full folder names are visible
    if (panelWidth < 280) {
      setFolderGridColumns(1);
    } else if (panelWidth < 520) {
      setFolderGridColumns(2);
    } else {
      setFolderGridColumns(3);
    }
  };

  // Check if panel is narrow
  const checkPanelWidth = () => {
    if (!foldersPanelRef.current || !dialogRef.current) return;

    const panelWidth = foldersPanelRef.current.offsetWidth;
    const dialogWidth = dialogRef.current.offsetWidth;

    // Consider panel narrow if it's less than 20% of dialog width or less than 180px
    setIsPanelNarrow(panelWidth < 180 || panelWidth / dialogWidth < 0.2);
  };

  // Update grid columns when folder panel width changes
  useEffect(() => {
    updateFolderGridColumns();
    checkPanelWidth();
  }, [foldersPanelWidth]);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetchFolderData()
        .then((data) => {
          const { folders, folderFiles } = transformFolderData(data);
          setFolderData(folders);
          setFolderFiles(folderFiles);
        })
        .catch((error) => {
          setLoadError(error.message || "Failed to load folder data");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  // Function to handle changing the base output folder
  const handleChangeBaseOutput = async () => {
    try {
      setIsChangingBaseOutput(true);
      const selectedPath = await open({
        directory: true,
        title: "Select Output Folder",
        multiple: false,
      });

      if (selectedPath) {
        setCurrentBaseOutput(selectedPath);
        setHasChanges(true);
        toast({
          title: "Output folder updated",
          description: "Files will be saved to the new location.",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Error selecting folder:", error);
      toast({
        title: "Error",
        description: "Failed to select output folder",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsChangingBaseOutput(false);
    }
  };

  // Add a global drag end event listener to ensure cursor reset
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      // Reset cursor styles when any drag operation ends
      document.body.classList.remove("file-dragging");
      document.body.style.cursor = "";

      // Remove any drag-related classes
      document.querySelectorAll(".drag-target-active").forEach((el) => {
        el.classList.remove("drag-target-active");
      });

      document.querySelectorAll("[data-dragging='true']").forEach((el) => {
        el.removeAttribute("data-dragging");
      });

      // Force cursor reset with a temporary class
      document.body.classList.add("cursor-reset");
      setTimeout(() => {
        document.body.classList.remove("cursor-reset");
      }, 100);

      console.log("Global drag end detected - cursor reset");
    };

    // Listen for global dragend event
    document.addEventListener("dragend", handleGlobalDragEnd);

    return () => {
      document.removeEventListener("dragend", handleGlobalDragEnd);
      // Also reset cursor when component unmounts
      document.body.classList.remove("file-dragging");
      document.body.style.cursor = "";
    };
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    // Ctrl+A or Cmd+A to select all files in active folder
    if ((e.ctrlKey || e.metaKey) && e.key === "a" && currentFolderId) {
      e.preventDefault(); // Prevent browser's select all behavior

      // Get all files in the active folder
      const filesInFolder = folderFiles[currentFolderId] || [];

      // Create a Set with all file IDs in this folder
      const allFileIds = new Set(filesInFolder.map((file) => file.id));

      // Update selected files state
      setSelectedFiles((prev) => ({
        ...prev,
        [currentFolderId]: allFileIds,
      }));

      toast({
        title: "All files selected",
        description: `Selected ${filesInFolder.length} files in ${
          getFolderById(currentFolderId)?.name
        }`,
        duration: 2000,
      });
    }
  };

  // Add keyboard shortcut listener
  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, currentFolderId, folderFiles]);

  const handleFolderClick = (folder) => {
    setSelectedFolderIds((prev) => {
      // If folder is already selected, remove it
      if (prev.includes(folder.id)) {
        return prev.filter((id) => id !== folder.id);
      }

      if (prev.length >= 2) {
        // Create a new array without the first element, and add the new folder id
        return [...prev.slice(1), folder.id];
      }

      // Otherwise just add the new folder to selection
      return [...prev, folder.id];
    });
  };

  // Handle resizing between folders in the files panel
  const handleResizeStart = (index) => {
    setResizingIndex(index);

    const handleResize = (e) => {
      if (!containerRef.current || selectedFolderIds.length < 2) return;

      const containerWidth = containerRef.current.offsetWidth;
      const mouseX = e.clientX;
      const containerRect = containerRef.current.getBoundingClientRect();
      const relativeX = mouseX - containerRect.left;

      // Get the IDs of the folders on either side of the separator
      const leftFolderId = selectedFolderIds[index];
      const rightFolderId = selectedFolderIds[index + 1];

      if (!leftFolderId || !rightFolderId) return;

      // Calculate minimum width in pixels and convert to percentage
      const minWidthPercent = Math.max(
        MIN_FOLDER_WIDTH_PERCENT,
        (MIN_FOLDER_WIDTH_PIXELS / containerWidth) * 100
      );

      setFolderWidths((prev) => {
        const newWidths = { ...prev };

        // Calculate the current total width of the two adjacent folders
        const currentLeftWidth =
          prev[leftFolderId] || 100 / selectedFolderIds.length;
        const currentRightWidth =
          prev[rightFolderId] || 100 / selectedFolderIds.length;
        const currentTotalWidth = currentLeftWidth + currentRightWidth;

        // Calculate the new position as a percentage of the container width
        const newLeftWidthPercent = (relativeX / containerWidth) * 100;
        const newRightWidthPercent = currentTotalWidth - newLeftWidthPercent;

        // Ensure minimum width constraints
        if (
          newLeftWidthPercent < minWidthPercent ||
          newRightWidthPercent < minWidthPercent
        ) {
          return prev;
        }

        // Update only the two adjacent folders
        newWidths[leftFolderId] = newLeftWidthPercent;
        newWidths[rightFolderId] = newRightWidthPercent;

        return newWidths;
      });
    };

    const handleResizeEnd = () => {
      setResizingIndex(null);
      document.removeEventListener("mousemove", handleResize);
      document.removeEventListener("mouseup", handleResizeEnd);

      // Normalize all folder widths to ensure they sum to exactly 100%
      setFolderWidths((prev) => {
        const totalWidth = selectedFolderIds.reduce(
          (sum, id) => sum + (prev[id] || 0),
          0
        );

        if (Math.abs(totalWidth - 100) > 0.5) {
          const newWidths = { ...prev };
          const scaleFactor = 100 / totalWidth;

          selectedFolderIds.forEach((id) => {
            newWidths[id] =
              (prev[id] || 100 / selectedFolderIds.length) * scaleFactor;
          });

          return newWidths;
        }
        return prev;
      });
    };

    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", handleResizeEnd);
  };

  // Handle saving changes with the updated base output path
  const handleSaveChanges = async (copyOrMove) => {
    await saveChanges(
      folderFiles,
      setHasChanges,
      setIsSaving,
      currentBaseOutput, // Use the updated base output
      toast,
      copyOrMove,
      folderData
    );

    // Close the dialog after saving
    setTimeout(() => {
      onOpenChange(false);
    }, 500);
  };

  // Handle resizing between folders panel and files panel
  const handleMainSeparatorResizeStart = (e) => {
    e.preventDefault();
    setResizingIndex("main"); // Use "main" to indicate the main separator

    const startX = e.clientX;
    const startWidth = foldersPanelWidth;

    const handleMainResize = (e) => {
      if (!dialogRef.current) return;

      const dialogWidth = dialogRef.current.offsetWidth;
      const deltaX = e.clientX - startX;
      const newWidthPercent = startWidth + (deltaX / dialogWidth) * 100;

      // Constrain width between 15% and 50%
      const constrainedWidth = Math.max(15, Math.min(50, newWidthPercent));
      setFoldersPanelWidth(constrainedWidth);

      // Check if panel is narrow
      checkPanelWidth();
    };

    const handleMainResizeEnd = () => {
      setResizingIndex(null);
      document.removeEventListener("mousemove", handleMainResize);
      document.removeEventListener("mouseup", handleMainResizeEnd);

      // Update grid columns after resize is complete
      updateFolderGridColumns();
      checkPanelWidth();
    };

    document.addEventListener("mousemove", handleMainResize);
    document.addEventListener("mouseup", handleMainResizeEnd);
  };

  // Handle touch events for main separator
  const handleMainSeparatorTouchStart = (e) => {
    e.preventDefault();
    setResizingIndex("main");

    const touch = e.touches[0];
    const startX = touch.clientX;
    const startWidth = foldersPanelWidth;

    const handleMainTouchMove = (e) => {
      if (!dialogRef.current) return;

      const touch = e.touches[0];
      const dialogWidth = dialogRef.current.offsetWidth;
      const deltaX = touch.clientX - startX;
      const newWidthPercent = startWidth + (deltaX / dialogWidth) * 100;

      // Constrain width between 15% and 50%
      const constrainedWidth = Math.max(15, Math.min(50, newWidthPercent));
      setFoldersPanelWidth(constrainedWidth);

      // Check if panel is narrow
      checkPanelWidth();
    };

    const handleMainTouchEnd = () => {
      setResizingIndex(null);
      document.removeEventListener("touchmove", handleMainTouchMove);
      document.removeEventListener("touchend", handleMainTouchEnd);

      // Update grid columns after resize is complete
      updateFolderGridColumns();
      checkPanelWidth();
    };

    document.addEventListener("touchmove", handleMainTouchMove);
    document.addEventListener("touchend", handleMainTouchEnd);
  };

  // Add touch support for mobile devices
  const handleTouchStart = (index) => {
    setResizingIndex(index);

    const handleTouchMove = (e) => {
      if (!containerRef.current || selectedFolderIds.length < 2) return;

      const touch = e.touches[0];
      const containerWidth = containerRef.current.offsetWidth;
      const containerRect = containerRef.current.getBoundingClientRect();
      const relativeX = touch.clientX - containerRect.left;

      // Get the IDs of the folders on either side of the separator
      const leftFolderId = selectedFolderIds[index];
      const rightFolderId = selectedFolderIds[index + 1];

      if (!leftFolderId || !rightFolderId) return;

      // Calculate minimum width in pixels and convert to percentage
      const minWidthPercent = Math.max(
        MIN_FOLDER_WIDTH_PERCENT,
        (MIN_FOLDER_WIDTH_PIXELS / containerWidth) * 100
      );

      setFolderWidths((prev) => {
        const newWidths = { ...prev };

        // Calculate the current total width of the two adjacent folders
        const currentTotalWidth = prev[leftFolderId] + prev[rightFolderId];

        // Calculate the new position as a percentage of the container width
        const newLeftWidthPercent = (relativeX / containerWidth) * 100;

        // Ensure minimum width constraints
        if (
          newLeftWidthPercent < minWidthPercent ||
          currentTotalWidth - newLeftWidthPercent < minWidthPercent
        ) {
          return prev;
        }

        // Check if we're decreasing the width of either folder
        const isLeftDecreasing = newLeftWidthPercent < prev[leftFolderId];
        const isRightDecreasing =
          currentTotalWidth - newLeftWidthPercent < prev[rightFolderId];

        // Reset zoom to 100% if width is decreasing and current zoom is > 100%
        if (
          isLeftDecreasing &&
          folderZoom[leftFolderId] > 1.0 &&
          newLeftWidthPercent < 30
        ) {
          setFolderZoom((prevZoom) => ({
            ...prevZoom,
            [leftFolderId]: 1.0,
          }));
        }

        if (
          isRightDecreasing &&
          folderZoom[rightFolderId] > 1.0 &&
          currentTotalWidth - newLeftWidthPercent < 30
        ) {
          setFolderZoom((prevZoom) => ({
            ...prevZoom,
            [rightFolderId]: 1.0,
          }));
        }

        // Update only the two adjacent folders
        newWidths[leftFolderId] = newLeftWidthPercent;
        newWidths[rightFolderId] = currentTotalWidth - newLeftWidthPercent;

        return newWidths;
      });
    };

    const handleTouchEnd = () => {
      setResizingIndex(null);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };

    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);
  };

  // Get dynamic grid template columns based on folderGridColumns
  const getGridTemplateColumns = () => {
    // On desktop, prioritize readability with minimum width
    const minWidth = 200; // Increased minimum width for better readability
    const panelWidth = foldersPanelRef.current?.offsetWidth || 0;
    // Calculate how many columns can fit with the minimum width
    const maxColumns = Math.floor(panelWidth / minWidth) || 1;
    // Use the smaller of calculated columns or folderGridColumns
    const columns = Math.min(maxColumns, folderGridColumns);
    // Always use at least 1 column
    return `repeat(${Math.max(1, columns)}, 1fr)`;
  };

  // Add this function to the FolderBrowserDialog component
  const handleWheel = (e, folderId) => {
    if (e.ctrlKey || e.metaKey) {
      // Only zoom when Ctrl/Cmd key is pressed
      e.preventDefault();

      const delta = e.deltaY < 0 ? 0.1 : -0.1;

      setFolderZoom((prev) => {
        const currentZoom = prev[folderId] || 1.0;
        const newZoom = Math.max(0.5, Math.min(2.0, currentZoom + delta));

        return {
          ...prev,
          [folderId]: newZoom,
        };
      });
    }
  };

  // Add this useEffect to prevent default scrolling when zooming
  useEffect(() => {
    const preventDefaultWheelWithModifier = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    // Add the event listener to the window
    window.addEventListener("wheel", preventDefaultWheelWithModifier, {
      passive: false,
    });

    // Clean up
    return () => {
      window.removeEventListener("wheel", preventDefaultWheelWithModifier);
    };
  }, []);

  // --- Box Selection Handlers --
  // Updated createSelectionBox function for clipping
  const createSelectionBox = () => {
    const box = document.createElement("div");
    box.className =
      "fixed border-2 border-dashed border-primary bg-primary/10 z-[1000] pointer-events-none";
    box.style.display = "none";
    box.id = "selection-box";
    return box;
  };

  // Add a CSS helper function to add clip-path to document head
  const addClipPathStyle = () => {
    // Check if style already exists
    if (document.getElementById("selection-box-clip-style")) return;

    const style = document.createElement("style");
    style.id = "selection-box-clip-style";
    style.textContent = `
    #selection-box.clipped {
      clip-path: var(--clip-path);
    }
  `;
    document.head.appendChild(style);
  };

  // Updated handleSelectionMouseDown with clipping logic
  const handleSelectionMouseDown = (e, folderId) => {
    // Set the active folder when clicking in it
    setCurrentFolderId(folderId);

    // Only start selection if clicking directly on the container background or the grid container
    if (
      e.target !== e.currentTarget &&
      !e.target.classList.contains("grid") &&
      !e.target.getAttribute("data-grid-container")
    ) {
      return;
    }

    e.preventDefault(); // Prevent text selection

    // Ensure clip-path style is added to document
    addClipPathStyle();

    // Get the file container and its scroll properties
    const container = fileContainerRefs.current[folderId];
    if (!container) return;

    // Get the scrollable parent - might be the container itself or a parent element
    const scrollContainer = container;

    // Track initial mouse position in client coordinates (relative to viewport)
    const startClientX = e.clientX;
    const startClientY = e.clientY;

    // Create selection box and append it to document.body for absolute positioning
    let selectionBoxElement = document.getElementById("selection-box");
    if (selectionBoxElement) {
      selectionBoxElement.remove(); // Remove any existing box
    }
    selectionBoxElement = createSelectionBox();
    document.body.appendChild(selectionBoxElement);

    // Initially position the selection box at mouse position
    selectionBoxElement.style.display = "block";
    selectionBoxElement.style.left = `${startClientX}px`;
    selectionBoxElement.style.top = `${startClientY}px`;
    selectionBoxElement.style.width = "0";
    selectionBoxElement.style.height = "0";
    selectionBoxElement.classList.add("clipped");

    // For tracking selection state
    setIsSelecting(true);

    // Track selected files
    const newlySelected = new Set(
      e.ctrlKey || e.shiftKey ? [...(selectedFiles[folderId] || [])] : []
    );

    // Clear selection if not using modifiers
    if (!e.ctrlKey && !e.shiftKey) {
      setSelectedFiles((prev) => ({ ...prev, [folderId]: new Set() }));
    }

    // Cache all file elements for intersection testing
    const filesInFolder = folderFiles[folderId] || [];
    const fileElements = [];

    // Get all file elements with their screen positions
    filesInFolder.forEach((file) => {
      const fileEl = fileRefs.current?.[folderId]?.[file.id];
      if (fileEl) {
        fileElements.push({
          id: file.id,
          element: fileEl,
        });
      }
    });

    // Animation frame ID for smooth selection
    let animationFrameId = null;

    // Auto-scroll interval ID
    let autoScrollIntervalId = null;

    // Current mouse position (updated during mousemove)
    let currentClientX = startClientX;
    let currentClientY = startClientY;

    // Auto-scroll parameters
    const SCROLL_SPEED = 25;
    const SCROLL_THRESHOLD = 50;
    const SCROLL_INTERVAL = 16; // ms

    // Start auto-scrolling if needed
    const startAutoScroll = () => {
      if (autoScrollIntervalId) return; // Already scrolling

      autoScrollIntervalId = setInterval(() => {
        const containerRect = container.getBoundingClientRect();

        // Calculate if mouse is near container edges
        const isNearTop = currentClientY < containerRect.top + SCROLL_THRESHOLD;
        const isNearBottom =
          currentClientY > containerRect.bottom - SCROLL_THRESHOLD;
        const isNearLeft =
          currentClientX < containerRect.left + SCROLL_THRESHOLD;
        const isNearRight =
          currentClientX > containerRect.right - SCROLL_THRESHOLD;

        // Calculate how much to scroll
        let scrollDeltaY = 0;
        let scrollDeltaX = 0;

        if (isNearTop && scrollContainer.scrollTop > 0) {
          // Scroll up when near top edge
          const intensity =
            1 -
            Math.max(
              0,
              (currentClientY - containerRect.top) / SCROLL_THRESHOLD
            );
          scrollDeltaY = -Math.ceil(SCROLL_SPEED * intensity);
        } else if (
          isNearBottom &&
          scrollContainer.scrollTop <
            scrollContainer.scrollHeight - scrollContainer.clientHeight
        ) {
          // Scroll down when near bottom edge
          const intensity =
            1 -
            Math.max(
              0,
              (containerRect.bottom - currentClientY) / SCROLL_THRESHOLD
            );
          scrollDeltaY = Math.ceil(SCROLL_SPEED * intensity);
        }

        if (isNearLeft && scrollContainer.scrollLeft > 0) {
          // Scroll left when near left edge
          const intensity =
            1 -
            Math.max(
              0,
              (currentClientX - containerRect.left) / SCROLL_THRESHOLD
            );
          scrollDeltaX = -Math.ceil(SCROLL_SPEED * intensity);
        } else if (
          isNearRight &&
          scrollContainer.scrollLeft <
            scrollContainer.scrollWidth - scrollContainer.clientWidth
        ) {
          // Scroll right when near right edge
          const intensity =
            1 -
            Math.max(
              0,
              (containerRect.right - currentClientX) / SCROLL_THRESHOLD
            );
          scrollDeltaX = Math.ceil(SCROLL_SPEED * intensity);
        }

        // Apply scrolling if needed
        if (scrollDeltaY !== 0) {
          scrollContainer.scrollTop += scrollDeltaY;
        }

        if (scrollDeltaX !== 0) {
          scrollContainer.scrollLeft += scrollDeltaX;
        }

        // If we're scrolling, make sure to update the selection
        if (scrollDeltaX !== 0 || scrollDeltaY !== 0) {
          updateSelectionWithoutAnimationFrame();
        }
      }, SCROLL_INTERVAL);
    };

    // Update selection box and selected files
    const updateSelection = () => {
      // Get the current container bounds for clipping
      const containerRect = container.getBoundingClientRect();

      // Calculate selection box dimensions based on start and current positions
      const left = Math.min(startClientX, currentClientX);
      const top = Math.min(startClientY, currentClientY);
      const width = Math.abs(startClientX - currentClientX);
      const height = Math.abs(startClientY - currentClientY);

      // Update selection box position (in viewport coordinates)
      selectionBoxElement.style.left = `${left}px`;
      selectionBoxElement.style.top = `${top}px`;
      selectionBoxElement.style.width = `${width}px`;
      selectionBoxElement.style.height = `${height}px`;

      // Create clip-path to hide parts outside container
      // Format: inset(top right bottom left)
      const clipTop = Math.max(0, containerRect.top - top);
      const clipRight = Math.max(0, left + width - containerRect.right);
      const clipBottom = Math.max(0, top + height - containerRect.bottom);
      const clipLeft = Math.max(0, containerRect.left - left);

      // Apply clip-path
      selectionBoxElement.style.setProperty(
        "--clip-path",
        `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px)`
      );

      // Calculate selection rectangle in viewport coordinates
      const selectionRect = {
        left: Math.max(left, containerRect.left),
        top: Math.max(top, containerRect.top),
        right: Math.min(left + width, containerRect.right),
        bottom: Math.min(top + height, containerRect.bottom),
      };

      // Keep track of files that intersect with the selection
      const visibleInSelection = new Set();

      // Test each file for intersection with selection rectangle
      fileElements.forEach((file) => {
        const fileRect = file.element.getBoundingClientRect();

        // Test for intersection using viewport coordinates
        const isIntersecting = !(
          selectionRect.left > fileRect.right ||
          fileRect.left > selectionRect.right ||
          selectionRect.top > fileRect.bottom ||
          fileRect.top > selectionRect.bottom
        );

        // Update visual selection state
        if (isIntersecting) {
          visibleInSelection.add(file.id);
          file.element.classList.add("file-selected");
        } else if (!newlySelected.has(file.id)) {
          file.element.classList.remove("file-selected");
        }
      });

      // Update selection state (for both tracking and final state update)
      fileElements.forEach((file) => {
        if (visibleInSelection.has(file.id)) {
          newlySelected.add(file.id);
        } else if (!e.ctrlKey && !e.shiftKey) {
          newlySelected.delete(file.id);
        }
      });

      // Request next animation frame for smooth updates
      animationFrameId = requestAnimationFrame(updateSelection);
    };

    // Same as updateSelection but without requesting animation frame
    // Used by auto-scroll to avoid duplicate animation frames
    const updateSelectionWithoutAnimationFrame = () => {
      const containerRect = container.getBoundingClientRect();

      const left = Math.min(startClientX, currentClientX);
      const top = Math.min(startClientY, currentClientY);
      const width = Math.abs(startClientX - currentClientX);
      const height = Math.abs(startClientY - currentClientY);

      selectionBoxElement.style.left = `${left}px`;
      selectionBoxElement.style.top = `${top}px`;
      selectionBoxElement.style.width = `${width}px`;
      selectionBoxElement.style.height = `${height}px`;

      // Create clip-path to hide parts outside container
      const clipTop = Math.max(0, containerRect.top - top);
      const clipRight = Math.max(0, left + width - containerRect.right);
      const clipBottom = Math.max(0, top + height - containerRect.bottom);
      const clipLeft = Math.max(0, containerRect.left - left);

      // Apply clip-path
      selectionBoxElement.style.setProperty(
        "--clip-path",
        `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px)`
      );

      const selectionRect = {
        left: Math.max(left, containerRect.left),
        top: Math.max(top, containerRect.top),
        right: Math.min(left + width, containerRect.right),
        bottom: Math.min(top + height, containerRect.bottom),
      };

      const visibleInSelection = new Set();

      fileElements.forEach((file) => {
        const fileRect = file.element.getBoundingClientRect();

        const isIntersecting = !(
          selectionRect.left > fileRect.right ||
          fileRect.left > selectionRect.right ||
          selectionRect.top > fileRect.bottom ||
          fileRect.top > selectionRect.bottom
        );

        if (isIntersecting) {
          visibleInSelection.add(file.id);
          file.element.classList.add("file-selected");
        } else if (!newlySelected.has(file.id)) {
          file.element.classList.remove("file-selected");
        }
      });

      fileElements.forEach((file) => {
        if (visibleInSelection.has(file.id)) {
          newlySelected.add(file.id);
        } else if (!e.ctrlKey && !e.shiftKey) {
          newlySelected.delete(file.id);
        }
      });
    };

    // Handle mouse movement for selection
    const handleMouseMove = (moveEvent) => {
      // Update current mouse position
      currentClientX = moveEvent.clientX;
      currentClientY = moveEvent.clientY;

      // Check if we need to start auto-scrolling
      const containerRect = container.getBoundingClientRect();
      if (
        currentClientX < containerRect.left + SCROLL_THRESHOLD ||
        currentClientX > containerRect.right - SCROLL_THRESHOLD ||
        currentClientY < containerRect.top + SCROLL_THRESHOLD ||
        currentClientY > containerRect.bottom - SCROLL_THRESHOLD
      ) {
        startAutoScroll();
      }

      // Start animation frame if not already running
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(updateSelection);
      }
    };

    // Handle mouse up to finalize selection
    const handleMouseUp = () => {
      // Clean up auto-scroll interval
      if (autoScrollIntervalId) {
        clearInterval(autoScrollIntervalId);
        autoScrollIntervalId = null;
      }

      // Clean up animation frame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      // Remove selection box
      if (selectionBoxElement) {
        selectionBoxElement.remove();
      }

      // Update final selection state
      setSelectedFiles((prev) => ({ ...prev, [folderId]: newlySelected }));
      setIsSelecting(false);

      // Clean up event listeners
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    // Add event listeners
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Also update handleFileCardPointerDown with similar clipping logic
  const handleFileCardPointerDown = (e, fileId, folderId) => {
    // Set the active folder when clicking a file
    setCurrentFolderId(folderId);

    // Handle modifier key selection
    if (e.metaKey || e.ctrlKey) {
      setSelectedFiles((prev) => {
        const folderSelection = new Set(prev[folderId] || []);
        if (folderSelection.has(fileId)) {
          folderSelection.delete(fileId);
        } else {
          folderSelection.add(fileId);
        }
        return { ...prev, [folderId]: folderSelection };
      });
      return;
    }

    // Ensure clip-path style is added
    addClipPathStyle();

    // Start selection drag
    setIsSelecting(true);

    // Get the file container
    const container = fileContainerRefs.current[folderId];
    if (!container) return;

    // Get the scrollable parent
    const scrollContainer = container;

    // Track initial mouse position
    const startClientX = e.clientX;
    const startClientY = e.clientY;

    // Create selection box and append to document.body
    let selectionBoxElement = document.getElementById("selection-box");
    if (selectionBoxElement) {
      selectionBoxElement.remove();
    }
    selectionBoxElement = createSelectionBox();
    document.body.appendChild(selectionBoxElement);

    // Initially position the selection box
    selectionBoxElement.style.display = "block";
    selectionBoxElement.style.left = `${startClientX}px`;
    selectionBoxElement.style.top = `${startClientY}px`;
    selectionBoxElement.style.width = "0";
    selectionBoxElement.style.height = "0";
    selectionBoxElement.classList.add("clipped");

    // Select the clicked file
    const initialSelection = new Set([fileId]);
    setSelectedFiles((prev) => ({ ...prev, [folderId]: initialSelection }));

    // Mark the clicked file as selected
    const fileEl = fileRefs.current?.[folderId]?.[fileId];
    if (fileEl) {
      fileEl.classList.add("file-selected");
    }

    // Cache all file elements
    const fileElements = [];
    const filesInFolder = folderFiles[folderId] || [];

    filesInFolder.forEach((file) => {
      const fileEl = fileRefs.current?.[folderId]?.[file.id];
      if (fileEl) {
        fileElements.push({
          id: file.id,
          element: fileEl,
        });
      }
    });

    // Animation and auto-scroll tracking
    let animationFrameId = null;
    let autoScrollIntervalId = null;
    let currentClientX = startClientX;
    let currentClientY = startClientY;
    let finalSelection = new Set([fileId]);

    // Auto-scroll parameters
    const SCROLL_SPEED = 10;
    const SCROLL_THRESHOLD = 50;
    const SCROLL_INTERVAL = 16; // ms

    // Start auto-scrolling if needed
    const startAutoScroll = () => {
      if (autoScrollIntervalId) return;

      autoScrollIntervalId = setInterval(() => {
        const containerRect = container.getBoundingClientRect();

        // Calculate if mouse is near container edges
        const isNearTop = currentClientY < containerRect.top + SCROLL_THRESHOLD;
        const isNearBottom =
          currentClientY > containerRect.bottom - SCROLL_THRESHOLD;
        const isNearLeft =
          currentClientX < containerRect.left + SCROLL_THRESHOLD;
        const isNearRight =
          currentClientX > containerRect.right - SCROLL_THRESHOLD;

        // Calculate how much to scroll
        let scrollDeltaY = 0;
        let scrollDeltaX = 0;

        if (isNearTop && scrollContainer.scrollTop > 0) {
          // Scroll up
          const intensity =
            1 -
            Math.max(
              0,
              (currentClientY - containerRect.top) / SCROLL_THRESHOLD
            );
          scrollDeltaY = -Math.ceil(SCROLL_SPEED * intensity);
        } else if (
          isNearBottom &&
          scrollContainer.scrollTop <
            scrollContainer.scrollHeight - scrollContainer.clientHeight
        ) {
          // Scroll down
          const intensity =
            1 -
            Math.max(
              0,
              (containerRect.bottom - currentClientY) / SCROLL_THRESHOLD
            );
          scrollDeltaY = Math.ceil(SCROLL_SPEED * intensity);
        }

        if (isNearLeft && scrollContainer.scrollLeft > 0) {
          // Scroll left
          const intensity =
            1 -
            Math.max(
              0,
              (currentClientX - containerRect.left) / SCROLL_THRESHOLD
            );
          scrollDeltaX = -Math.ceil(SCROLL_SPEED * intensity);
        } else if (
          isNearRight &&
          scrollContainer.scrollLeft <
            scrollContainer.scrollWidth - scrollContainer.clientWidth
        ) {
          // Scroll right
          const intensity =
            1 -
            Math.max(
              0,
              (containerRect.right - currentClientX) / SCROLL_THRESHOLD
            );
          scrollDeltaX = Math.ceil(SCROLL_SPEED * intensity);
        }

        // Apply scrolling
        if (scrollDeltaY !== 0) {
          scrollContainer.scrollTop += scrollDeltaY;
        }

        if (scrollDeltaX !== 0) {
          scrollContainer.scrollLeft += scrollDeltaX;
        }

        // Update selection if we scrolled
        if (scrollDeltaX !== 0 || scrollDeltaY !== 0) {
          updateDragSelectionWithoutAnimationFrame();
        }
      }, SCROLL_INTERVAL);
    };

    // Update selection box and selected files
    const updateDragSelection = () => {
      // Get current container bounds for clipping
      const containerRect = container.getBoundingClientRect();

      // Calculate selection box dimensions
      const left = Math.min(startClientX, currentClientX);
      const top = Math.min(startClientY, currentClientY);
      const width = Math.abs(startClientX - currentClientX);
      const height = Math.abs(startClientY - currentClientY);

      // Update selection box position
      selectionBoxElement.style.left = `${left}px`;
      selectionBoxElement.style.top = `${top}px`;
      selectionBoxElement.style.width = `${width}px`;
      selectionBoxElement.style.height = `${height}px`;

      // Create clip-path to hide parts outside container
      const clipTop = Math.max(0, containerRect.top - top);
      const clipRight = Math.max(0, left + width - containerRect.right);
      const clipBottom = Math.max(0, top + height - containerRect.bottom);
      const clipLeft = Math.max(0, containerRect.left - left);

      // Apply clip-path
      selectionBoxElement.style.setProperty(
        "--clip-path",
        `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px)`
      );

      // Selection rectangle in viewport coordinates - clipped to container bounds
      const selectionRect = {
        left: Math.max(left, containerRect.left),
        top: Math.max(top, containerRect.top),
        right: Math.min(left + width, containerRect.right),
        bottom: Math.min(top + height, containerRect.bottom),
      };

      // Test files for intersection
      const visibleInSelection = new Set();

      fileElements.forEach((file) => {
        const fileRect = file.element.getBoundingClientRect();

        const isIntersecting = !(
          selectionRect.left > fileRect.right ||
          fileRect.left > selectionRect.right ||
          selectionRect.top > fileRect.bottom ||
          fileRect.top > selectionRect.bottom
        );

        if (isIntersecting) {
          visibleInSelection.add(file.id);
          file.element.classList.add("file-selected");
        } else {
          file.element.classList.remove("file-selected");
        }
      });

      // Update final selection
      finalSelection = visibleInSelection;

      // Request next frame
      animationFrameId = requestAnimationFrame(updateDragSelection);
    };

    // Same as updateDragSelection but without requesting animation frame
    const updateDragSelectionWithoutAnimationFrame = () => {
      const containerRect = container.getBoundingClientRect();

      const left = Math.min(startClientX, currentClientX);
      const top = Math.min(startClientY, currentClientY);
      const width = Math.abs(startClientX - currentClientX);
      const height = Math.abs(startClientY - currentClientY);

      selectionBoxElement.style.left = `${left}px`;
      selectionBoxElement.style.top = `${top}px`;
      selectionBoxElement.style.width = `${width}px`;
      selectionBoxElement.style.height = `${height}px`;

      // Create clip-path to hide parts outside container
      const clipTop = Math.max(0, containerRect.top - top);
      const clipRight = Math.max(0, left + width - containerRect.right);
      const clipBottom = Math.max(0, top + height - containerRect.bottom);
      const clipLeft = Math.max(0, containerRect.left - left);

      // Apply clip-path
      selectionBoxElement.style.setProperty(
        "--clip-path",
        `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px)`
      );

      const selectionRect = {
        left: Math.max(left, containerRect.left),
        top: Math.max(top, containerRect.top),
        right: Math.min(left + width, containerRect.right),
        bottom: Math.min(top + height, containerRect.bottom),
      };

      const visibleInSelection = new Set();

      fileElements.forEach((file) => {
        const fileRect = file.element.getBoundingClientRect();

        const isIntersecting = !(
          selectionRect.left > fileRect.right ||
          fileRect.left > selectionRect.right ||
          selectionRect.top > fileRect.bottom ||
          fileRect.top > selectionRect.bottom
        );

        if (isIntersecting) {
          visibleInSelection.add(file.id);
          file.element.classList.add("file-selected");
        } else {
          file.element.classList.remove("file-selected");
        }
      });

      finalSelection = visibleInSelection;
    };

    // Handle pointer movement
    const handlePointerMove = (moveEvent) => {
      // Update current position
      currentClientX = moveEvent.clientX;
      currentClientY = moveEvent.clientY;

      // Check for auto-scroll
      const containerRect = container.getBoundingClientRect();
      if (
        currentClientX < containerRect.left + SCROLL_THRESHOLD ||
        currentClientX > containerRect.right - SCROLL_THRESHOLD ||
        currentClientY < containerRect.top + SCROLL_THRESHOLD ||
        currentClientY > containerRect.bottom - SCROLL_THRESHOLD
      ) {
        startAutoScroll();
      }

      // Start animation frame
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(updateDragSelection);
      }
    };

    // Handle pointer up
    const handlePointerUp = () => {
      // Clean up auto-scroll
      if (autoScrollIntervalId) {
        clearInterval(autoScrollIntervalId);
        autoScrollIntervalId = null;
      }

      // Clean up animation frame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      // Remove selection box
      if (selectionBoxElement) {
        selectionBoxElement.remove();
      }

      // Update final selection
      setSelectedFiles((prev) => ({
        ...prev,
        [folderId]: finalSelection,
      }));

      setIsSelecting(false);

      // Clean up event listeners
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };

    // Add event listeners
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  };
  // Handle clicking directly on a file card
  const handleFileSelect = (folderId, fileId, options = {}) => {
    setSelectedFiles((prev) => {
      const newSelection = { ...prev };
      const currentFolderSelection = new Set(prev[folderId] || []);

      // Simple toggle for now (implement Ctrl/Shift later if needed)
      if (currentFolderSelection.has(fileId)) {
        currentFolderSelection.delete(fileId);
      } else {
        currentFolderSelection.add(fileId);
      }
      // If not using modifiers, maybe clear others? For now, just toggle.
      if (!options.ctrlKey && !options.shiftKey) {
        currentFolderSelection.clear();
        currentFolderSelection.add(fileId);
      }

      newSelection[folderId] = currentFolderSelection;
      return newSelection;
    });
  };

  // Add these functions before the return statement
  const handleStartRename = (folder) => {
    setRenamingFolderId(folder.id);
    setNewFolderName(folder.name);
  };

  const handleCancelRename = () => {
    setRenamingFolderId(null);
    setNewFolderName("");
  };

  const handleRenameSubmit = (folderId) => {
    if (newFolderName.trim() === "") return;

    // Update the folder name in our state
    setFolderData((prevFolders) =>
      prevFolders.map((folder) =>
        folder.id === folderId
          ? { ...folder, name: newFolderName.trim() }
          : folder
      )
    );

    setHasChanges(true);
    setRenamingFolderId(null);
    setNewFolderName("");

    toast({
      title: "Folder renamed",
      description: "The folder has been renamed successfully.",
      duration: 3000,
    });
  };

  const handleCreateNewFolder = () => {
    setIsCreatingFolder(true);
    setNewFolderName("");
  };

  const handleCancelNewFolder = () => {
    setIsCreatingFolder(false);
    setNewFolderName("");
  };

  const handleSubmitNewFolder = () => {
    if (newFolderName.trim() === "") return;

    // Generate a new unique ID
    const newId = `folder-${Date.now()}`;

    // Create the new folder object
    const newFolder = {
      id: newId,
      name: newFolderName.trim(),
      itemCount: 0,
      color: "text-primary", // Default color
    };

    // Add the new folder to our state
    setFolderData((prevFolders) => [...prevFolders, newFolder]);

    // Initialize an empty files array for this folder
    setFolderFiles((prev) => ({
      ...prev,
      [newId]: [],
    }));

    setHasChanges(true);
    setIsCreatingFolder(false);
    setNewFolderName("");

    toast({
      title: "Folder created",
      description: `New folder "${newFolderName.trim()}" has been created.`,
      duration: 3000,
    });
  };

  // Add the handleRevertChanges function before the return statement
  // Add this function after the handleSubmitNewFolder function:

  const handleRevertChanges = async () => {
    try {
      setIsLoading(true);
      // Fetch data from folders.json again
      const data = await fetchFolderData();

      if (!data || !Array.isArray(data)) {
        throw new Error("Invalid data format received");
      }

      // Transform the data back to the format expected by the folder browser
      const { folders, folderFiles } = transformFolderData(data);

      // Reset the state with the original data
      setFolderData(folders);
      setFolderFiles(folderFiles);

      // Clear the hasChanges flag
      setHasChanges(false);

      // Show success message
      toast({
        title: "Changes reverted",
        description:
          "Your changes have been reverted to the original structure.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error reverting changes:", error);

      // Show error message
      toast({
        title: "Error reverting changes",
        description:
          error.message || "Failed to revert changes. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to truncate path for display
  const getTruncatedPath = (path) => {
    if (!path) return "No output folder set";
    if (path.length <= 50) return path;

    const parts = path.split(/[/\\]/);
    if (parts.length <= 3) return path;

    return `${parts[0]}/.../${parts[parts.length - 2]}/${
      parts[parts.length - 1]
    }`;
  };

  const LoadingOverlay = ({ isVisible, message, progress }) => {
    if (!isVisible) return null;

    return (
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-card p-6 rounded-lg shadow-lg border max-w-sm w-full mx-4">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <h3 className="font-semibold text-lg">
                {message || "Saving Changes"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Please wait while we process your changes...
              </p>
            </div>
            {progress > 0 && (
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ADD this useEffect to auto-close dialog after successful save:
  useEffect(() => {
    if (!isSaving && !hasChanges && savingProgress === 100) {
      const timer = setTimeout(() => {
        onOpenChange(false);
        setSavingProgress(0);
        setSavingMessage("");
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isSaving, hasChanges, savingProgress, onOpenChange]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(newOpen) => {
        // Prevent closing dialog while saving
        if (isSaving && newOpen === false) {
          toast({
            title: "Please wait",
            description: "Cannot close while saving changes.",
            variant: "destructive",
          });
          return;
        }

        if (!newOpen) {
          document.body.style.cursor = "";
          document.body.classList.remove("file-dragging");
          // Reset saving state when dialog closes
          setSavingProgress(0);
          setSavingMessage("");
        }
        onOpenChange(newOpen);
      }}
    >
      <DialogContent
        className="w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] max-w-none p-4 sm:p-6 h-[90vh] max-h-[90vh] flex flex-col "
        ref={dialogRef}
        style={{ height: "90vh" }}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex justify-between items-center">
            <DialogTitle>Cluster Explorer</DialogTitle>
            {/* Always show the Save Changes button */}
            {/* Replace the Save Changes button in the DialogHeader with this dropdown menu */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleRevertChanges}
                disabled={isSaving || isLoading || !hasChanges}
                variant="outline"
                className="flex items-center gap-2 btn-animated"
              >
                <RotateCcw className="h-4 w-4" />
                {isLoading ? "Reverting..." : "Revert Changes"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={isSaving || isLoading}
                    className="flex items-center gap-2 btn-animated"
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleSaveChanges("move")}>
                    Move Files
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSaveChanges("copy")}>
                    Copy Files
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <DialogDescription>
            Browse and manage your clustered files. Select multiple clusters to
            view their contents side by side. Drag the separators to adjust
            panel sizes.
          </DialogDescription>

          {/* Add the base output path display and change button */}
          <div className="mt-3 flex flex-wrap items-center justify-between p-2 bg-muted/30 rounded-md border">
            <div className="flex items-center">
              <Folder className="h-4 w-4 text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground mr-1">
                Output folder:
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm font-medium max-w-[300px] truncate hover:underline cursor-help">
                      {getTruncatedPath(currentBaseOutput)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-md break-all">
                      {currentBaseOutput || "No output folder set"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {baseOutput !== currentBaseOutput && (
                <Badge
                  variant="outline"
                  className="ml-2 bg-yellow-100 text-yellow-800 text-xs border-yellow-300"
                >
                  Modified
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleChangeBaseOutput}
              disabled={isSaving || isLoading || isChangingBaseOutput}
              className="text-xs h-7 gap-1 mt-1 sm:mt-0 btn-animated"
            >
              {isChangingBaseOutput ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Edit className="h-3 w-3" />
              )}
              Change Output
            </Button>
          </div>
        </DialogHeader>
        <div
          className="mt-2 sm:mt-4 flex flex-col md:flex-row gap-2 sm:gap-4 flex-1 overflow-hidden"
          style={{ height: "calc(100% - 80px)" }}
        >
          {/* Folders Panel */}
          <div
            className="w-full md:flex-none flex flex-col h-[30vh] md:h-full overflow-hidden"
            style={{
              width: `${foldersPanelWidth}%`,
              height: "100%",
              minWidth: "150px", // Ensure minimum width
            }}
            ref={foldersPanelRef}
          >
            <div
              className={cn(
                "flex mb-3 sm:mb-4 flex-shrink-0 px-3",
                isPanelNarrow
                  ? "flex-col items-center gap-3"
                  : "justify-between items-center"
              )}
            >
              <h3
                className={cn(
                  "text-base sm:text-lg -ml-2 font-medium flex items-center",
                  isPanelNarrow && "-ml-2"
                )}
              >
                <Folder className="h-5 w-5 mr-2 text-primary" />
                <span className={cn(isPanelNarrow && "text-sm")}>Clusters</span>
              </h3>
              <Button
                size="sm"
                variant="outline"
                className="flex-shrink-0 mt-1 btn-animated"
                title="New Cluster"
                onClick={handleCreateNewFolder}
              >
                <Plus className="h-4 w-4" />
                <span
                  className={cn(
                    "text-xs sm:text-sm ml-1",
                    isPanelNarrow && "hidden"
                  )}
                >
                  New
                </span>
              </Button>
            </div>
            <ScrollArea
              className="flex-1 px-3"
              style={{ height: "calc(100% - 40px)" }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center h-full animate-fadeIn">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <span className="ml-2 text-sm">Loading clusters...</span>
                </div>
              ) : loadError ? (
                <div className="text-destructive p-4 text-center">
                  <p className="font-medium">Error loading clusters</p>
                  <p className="text-sm mt-1">{loadError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 btn-animated"
                    onClick={() => {
                      setIsLoading(true);
                      setLoadError(null);
                      fetchFolderData()
                        .then((data) => {
                          const { folders, folderFiles } =
                            transformFolderData(data);
                          setFolderData(folders);
                          setFolderFiles(folderFiles);
                          setIsLoading(false);
                        })
                        .catch((error) => {
                          setLoadError(
                            error.message || "Failed to load folder data"
                          );
                          setIsLoading(false);
                        });
                    }}
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <>
                  {isCreatingFolder && (
                    <div className="mb-3 border rounded-lg p-3 bg-accent/30">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Folder className="h-5 w-5 text-primary flex-shrink-0" />
                          <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="Enter cluster name"
                            className="flex-1 bg-background border rounded px-2 py-1 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSubmitNewFolder();
                              if (e.key === "Escape") handleCancelNewFolder();
                            }}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelNewFolder}
                          >
                            Cancel
                          </Button>
                          <Button size="sm" onClick={handleSubmitNewFolder}>
                            Create
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div
                    className="grid gap-3 sm:gap-4 p-1"
                    style={{ gridTemplateColumns: getGridTemplateColumns() }}
                  >
                    {folderData.length === 0 ? (
                      <div className="col-span-full text-center text-muted-foreground p-4">
                        No clusters found
                      </div>
                    ) : (
                      // Sort folders by ID (which corresponds to label) before mapping
                      [...folderData]
                        .sort((a, b) => parseInt(a.id) - parseInt(b.id))
                        .map((folder) => (
                          <FolderCard
                            key={folder.id}
                            folder={folder}
                            isSelected={selectedFolderIds.includes(folder.id)}
                            onClick={() => handleFolderClick(folder)}
                            onDragOver={(e) =>
                              setDragOverFolderId(
                                handleFolderDragOver(e, folder.id, draggedItems)
                              )
                            }
                            onDragLeave={(e) =>
                              setDragOverFolderId(handleFolderDragLeave(e))
                            }
                            onDrop={(e) => {
                              handleFolderDrop(e, folder.id, draggedItems);

                              setDragOverFolderId(null);
                              setDraggedItems(null);
                            }}
                            isDragOver={dragOverFolderId === folder.id}
                            data-folder-id={folder.id}
                            isRenaming={renamingFolderId === folder.id}
                            onRenameStart={() => handleStartRename(folder)}
                            onRenameCancel={handleCancelRename}
                            onRenameSubmit={() => handleRenameSubmit(folder.id)}
                            newFolderName={
                              renamingFolderId === folder.id
                                ? newFolderName
                                : ""
                            }
                            onNewFolderNameChange={(e) =>
                              setNewFolderName(e.target.value)
                            }
                          />
                        ))
                    )}
                  </div>
                </>
              )}
            </ScrollArea>
          </div>
          {/* Main Separator between Folders and Files panels */}
          <div
            className={cn(
              "md:block hidden w-4 flex-shrink-0 relative cursor-col-resize z-10",
              resizingIndex === "main" && "bg-primary/20"
            )}
            onMouseDown={handleMainSeparatorResizeStart}
            onTouchStart={handleMainSeparatorTouchStart}
            style={{ height: "100%" }}
          >
            <div
              className={cn(
                "absolute top-0 left-1/2 w-0.5 h-full bg-border -translate-x-1/2 hover:bg-primary hover:w-1 transition-all",
                resizingIndex === "main" && "bg-primary w-1"
              )}
            ></div>
            <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity">
              <GripVertical className="h-6 w-6 text-primary" />
            </div>
          </div>
          {/* Files Panel */}
          <div
            className="w-full md:flex-1 border-t md:border-t-0 pt-2 sm:pt-4 md:pt-0 flex flex-col relative"
            style={{
              width: `${100 - foldersPanelWidth - 1}%`,
              height: "100%",
              overflow: "hidden",
            }}
          >
            {selectedFolderIds.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm sm:text-base">
                Select one or more clusters to view files
              </div>
            ) : (
              <div className="h-full w-full overflow-hidden" ref={containerRef}>
                <div
                  className={cn("flex gap-2 sm:gap-4 h-full", "flex-row")}
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexWrap: "nowrap",
                  }}
                >
                  {selectedFolderIds.map((folderId, index) => {
                    const folder = getFolderById(folderId, folderData);
                    // Initialize refs for this folder if they don't exist
                    if (!fileRefs.current[folderId]) {
                      fileRefs.current[folderId] = {};
                    }
                    const files = folderFiles[folderId] || [];
                    const folderWidth =
                      folderWidths[folderId] || 100 / selectedFolderIds.length;
                    const folderZoomLevel = folderZoom[folderId] || 1.0;
                    const effectiveWidth = folderWidth * folderZoomLevel;
                    const displayMode = getDisplayMode(
                      effectiveWidth,
                      containerWidth,
                      folderZoomLevel
                    );
                    const gridColumns = getGridColumns(
                      displayMode,
                      effectiveWidth,
                      containerWidth
                    );

                    if (!folder) return null;

                    return (
                      <React.Fragment key={folder.id}>
                        {/* Folder Card */}
                        <div
                          className={cn(
                            "border rounded-md flex flex-col relative h-full overflow-hidden",
                            {
                              "ring-2 ring-primary bg-accent/50 transition-colors duration-200":
                                dragOverFolderId === folderId,
                              "ring-1 ring-primary":
                                currentFolderId === folderId,
                            }
                          )}
                          style={{
                            width: `${folderWidth}%`,
                            minWidth: "0",
                            maxWidth: "none",
                            height: "100%",
                            flexShrink: 1,
                            flexGrow: 1,
                          }}
                          onClick={() => setCurrentFolderId(folderId)}
                          onWheel={(e) => handleWheel(e, folderId)}
                          // Dragging files OVER the file list area of a folder card
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            // Only update dragOverFolderId if it's not already set to this folder
                            if (dragOverFolderId !== folderId) {
                              setDragOverFolderId(
                                handleFolderDragOver(e, folderId, draggedItems)
                              );
                            }
                          }}
                          onDragLeave={(e) => {
                            const newFolderId = handleFolderDragLeave(e);
                            // Only update if we're actually leaving the folder
                            if (newFolderId !== folderId) {
                              setDragOverFolderId(newFolderId);
                            }
                          }}
                          onDrop={(e) => {
                            handleFolderDrop(e, folder.id, draggedItems);
                            setDragOverFolderId(null);
                            setDraggedItems(null);
                          }}
                          data-folder-id={folderId}
                        >
                          <div className="flex justify-between items-center p-2 sm:p-3 border-b flex-shrink-0">
                            <h3
                              className={cn(
                                "text-sm sm:text-base font-medium flex items-center truncate",
                                folder.color
                              )}
                            >
                              <Folder className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
                              <span className="truncate">{folder.name}</span>
                              <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1 sm:ml-2 flex-shrink-0">
                                ({folder.itemCount} items)
                              </span>
                            </h3>
                            <div className="text-xs text-muted-foreground">
                              {Math.round(folderZoomLevel * 100)}%
                            </div>
                          </div>
                          <div
                            className="flex-1 overflow-auto relative"
                            style={{
                              height: "calc(100% - 40px)",
                              position: "relative",
                            }} // Add relative positioning
                            ref={(el) =>
                              (fileContainerRefs.current[folderId] = el)
                            } // Add ref to container
                            onMouseDown={(e) =>
                              handleSelectionMouseDown(e, folderId)
                            } // Add mouse down for box select
                          >
                            {/* Render Selection Box */}
                            {isSelecting &&
                              selectionBox &&
                              selectionBox.folderId === folderId && (
                                <div
                                  className="absolute border-2 border-dashed border-primary bg-primary/10 z-50 pointer-events-none"
                                  style={{
                                    left:
                                      Math.min(
                                        selectionBox.startX,
                                        selectionBox.currentX
                                      ) + "px",
                                    top:
                                      Math.min(
                                        selectionBox.startY,
                                        selectionBox.currentY
                                      ) + "px",
                                    width:
                                      Math.abs(
                                        selectionBox.startX -
                                          selectionBox.currentX
                                      ) + "px",
                                    height:
                                      Math.abs(
                                        selectionBox.startY -
                                          selectionBox.currentY
                                      ) + "px",
                                  }}
                                />
                              )}

                            {files.length === 0 ? (
                              <div className="text-muted-foreground text-xs sm:text-sm p-2 text-center">
                                No files in this cluster
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  "grid p-2 sm:p-3 selection-grid zoom-smooth",
                                  displayMode === "micro"
                                    ? `gap-1`
                                    : displayMode === "compact"
                                    ? `gap-1.5`
                                    : "gap-2"
                                )}
                                style={{
                                  gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                                  transform: `scale(${folderZoomLevel})`,
                                  transformOrigin: "top left",
                                  height:
                                    folderZoomLevel > 1
                                      ? `${100 / folderZoomLevel}%`
                                      : "auto",
                                }}
                                data-grid-container="true"
                                onMouseDown={(e) => {
                                  // If clicking directly on the grid (not on a file card), start selection
                                  if (
                                    e.target.getAttribute(
                                      "data-grid-container"
                                    ) === "true"
                                  ) {
                                    handleSelectionMouseDown(e, folderId);
                                  }
                                }}
                              >
                                {files.map((file) => (
                                  <FileCard
                                    key={file.id}
                                    file={file}
                                    displayMode={displayMode}
                                    onDragStart={() => {
                                      // Prepare files for drag
                                      const currentSelection =
                                        selectedFiles[folderId] || new Set();
                                      let filesToDrag = [];

                                      if (
                                        currentSelection.has(file.id) &&
                                        currentSelection.size > 1
                                      ) {
                                        // If the dragged file is part of a multi-selection, drag all selected files
                                        filesToDrag = files.filter((f) =>
                                          currentSelection.has(f.id)
                                        );
                                        console.log(
                                          `Dragging ${filesToDrag.length} selected files`
                                        );
                                      } else {
                                        // If dragging an unselected file or a single selected file, just drag this one
                                        if (!currentSelection.has(file.id)) {
                                          // Clear previous selection if we're dragging an unselected file
                                          setSelectedFiles((prev) => ({
                                            ...prev,
                                            [folderId]: new Set([file.id]),
                                          }));
                                        }
                                        filesToDrag = [file];
                                        console.log(
                                          `Dragging single file: ${file.name}`
                                        );
                                      }

                                      // Set the dragged files in state so we can access them in the drop handler
                                      setDraggedItems(filesToDrag);
                                      return handleFileDragStart(filesToDrag);
                                    }}
                                    onDragEnd={() => {
                                      handleFileDragEnd();
                                      setDraggedItems(null);
                                    }}
                                    isDragging={draggedItems?.some(
                                      (df) => df.id === file.id
                                    )} // Check if this file is among those being dragged
                                    isSelected={selectedFiles[folderId]?.has(
                                      file.id
                                    )} // Pass selection state
                                    fileRef={(el) =>
                                      (fileRefs.current[folderId][file.id] = el)
                                    } // Pass ref callback
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFileSelect(folderId, file.id, {
                                        ctrlKey: e.ctrlKey,
                                        shiftKey: e.shiftKey,
                                      });
                                    }} // Handle click for selection
                                    onPointerDown={(e) =>
                                      handleFileCardPointerDown(
                                        e,
                                        file.id,
                                        folderId
                                      )
                                    }
                                    data-file-id={file.id}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Separator: Only between folders and not on mobile */}
                        {index < selectedFolderIds.length - 1 && (
                          <ResizableSeparator
                            isResizing={resizingIndex === index}
                            onMouseDown={() => handleResizeStart(index)}
                            onTouchStart={() => handleTouchStart(index)}
                          >
                            <div className="absolute top-1/2 right-0 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity">
                              <GripVertical className="h-6 w-6 text-primary transform -translate-x-2" />
                            </div>
                          </ResizableSeparator>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <LoadingOverlay
          isVisible={isSaving}
          message={savingMessage}
          progress={savingProgress}
        />
      </DialogContent>
    </Dialog>
  );
}
