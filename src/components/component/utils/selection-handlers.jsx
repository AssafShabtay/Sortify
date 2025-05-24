"use client";

import { useCallback, useRef } from "react";

// Optimized selection box implementation
export function useSelection() {
  const selectionStateRef = useRef({
    isSelecting: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    animationId: null,
    autoScrollId: null,
  });

  // Throttled selection update
  const throttledUpdate = useCallback((fn, delay = 16) => {
    if (selectionStateRef.current.animationId) {
      cancelAnimationFrame(selectionStateRef.current.animationId);
    }
    selectionStateRef.current.animationId = requestAnimationFrame(fn);
  }, []);

  // Optimized selection box creation
  const createSelectionBox = useCallback(() => {
    let box = document.getElementById("selection-box");
    if (box) {
      box.remove();
    }

    box = document.createElement("div");
    box.id = "selection-box";
    box.style.cssText = `
      position: fixed;
      border: 2px dashed var(--primary);
      background-color: var(--primary-foreground);
      opacity: 0.1;
      z-index: 1000;
      pointer-events: none;
      display: none;
    `;

    document.body.appendChild(box);
    return box;
  }, []);

  // Optimized intersection testing
  const getIntersectingFiles = useCallback((selectionRect, fileElements) => {
    const intersecting = new Set();

    // Use more efficient intersection testing
    for (const file of fileElements) {
      const rect = file.element.getBoundingClientRect();

      if (
        !(
          selectionRect.left > rect.right ||
          rect.left > selectionRect.right ||
          selectionRect.top > rect.bottom ||
          rect.top > selectionRect.bottom
        )
      ) {
        intersecting.add(file.id);
      }
    }

    return intersecting;
  }, []);

  // Optimized selection mouse down handler
  const handleSelectionMouseDown = useCallback(
    (e, folderId, fileElements, onSelectionChange) => {
      if (
        e.target !== e.currentTarget &&
        !e.target.classList.contains("grid") &&
        !e.target.getAttribute("data-grid-container")
      ) {
        return;
      }

      e.preventDefault();

      const state = selectionStateRef.current;
      state.isSelecting = true;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.currentX = e.clientX;
      state.currentY = e.clientY;

      const selectionBox = createSelectionBox();
      selectionBox.style.display = "block";

      // Initial selection state
      const initialSelection =
        e.ctrlKey || e.shiftKey
          ? new Set()
          : // Keep existing if using modifiers
            new Set(); // Clear if not

      const currentSelection = new Set(initialSelection);

      // Optimized update function
      const updateSelection = () => {
        const left = Math.min(state.startX, state.currentX);
        const top = Math.min(state.startY, state.currentY);
        const width = Math.abs(state.startX - state.currentX);
        const height = Math.abs(state.startY - state.currentY);

        // Update selection box
        selectionBox.style.left = `${left}px`;
        selectionBox.style.top = `${top}px`;
        selectionBox.style.width = `${width}px`;
        selectionBox.style.height = `${height}px`;

        // Get intersecting files
        const selectionRect = {
          left,
          top,
          right: left + width,
          bottom: top + height,
        };
        const intersecting = getIntersectingFiles(selectionRect, fileElements);

        // Update visual selection
        fileElements.forEach((file) => {
          const shouldSelect = intersecting.has(file.id);
          file.element.classList.toggle("file-selected", shouldSelect);

          if (shouldSelect) {
            currentSelection.add(file.id);
          } else if (!e.ctrlKey && !e.shiftKey) {
            currentSelection.delete(file.id);
          }
        });
      };

      // Mouse move handler
      const handleMouseMove = (moveEvent) => {
        state.currentX = moveEvent.clientX;
        state.currentY = moveEvent.clientY;

        throttledUpdate(updateSelection);
      };

      // Mouse up handler
      const handleMouseUp = () => {
        state.isSelecting = false;

        // Clean up
        if (state.animationId) {
          cancelAnimationFrame(state.animationId);
          state.animationId = null;
        }

        if (state.autoScrollId) {
          clearInterval(state.autoScrollId);
          state.autoScrollId = null;
        }

        selectionBox.remove();

        // Update final selection
        onSelectionChange(folderId, currentSelection);

        // Remove event listeners
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      // Add event listeners
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [createSelectionBox, getIntersectingFiles, throttledUpdate]
  );

  return {
    handleSelectionMouseDown,
  };
}

// Example integration for folder-browser-dialog.jsx
export function useIntegratedSelection(
  folderFiles,
  selectedFiles,
  setSelectedFiles,
  setCurrentFolderId,
  fileRefs
) {
  const { handleSelectionMouseDown } = useSelection();

  // Wrapper function that integrates with your existing state
  const handleSelectionStart = useCallback(
    (e, folderId) => {
      // Set the active folder when clicking in it
      setCurrentFolderId(folderId);

      // Get file elements for this folder
      const filesInFolder = folderFiles[folderId] || [];
      const fileElements = filesInFolder
        .map((file) => {
          const element = fileRefs.current?.[folderId]?.[file.id];
          return element ? { id: file.id, element } : null;
        })
        .filter(Boolean);

      // Selection change handler
      const onSelectionChange = (folderId, newSelection) => {
        setSelectedFiles((prev) => ({
          ...prev,
          [folderId]: newSelection,
        }));
      };

      // Call the optimized selection handler
      handleSelectionMouseDown(e, folderId, fileElements, onSelectionChange);
    },
    [
      handleSelectionMouseDown,
      folderFiles,
      setCurrentFolderId,
      setSelectedFiles,
      fileRefs,
    ]
  );

  return { handleSelectionStart };
}
