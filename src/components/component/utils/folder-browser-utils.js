"use client";

// Constants
export const MIN_FOLDER_WIDTH_PERCENT = 10; // Minimum width for a folder panel in percentage
export const MIN_FOLDER_WIDTH_PIXELS = 100; // Minimum width for a folder panel in pixels
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.0;
export const ZOOM_STEP = 0.1;

// Sample data

// Get folder by ID
export const getFolderById = (id, customFolders = []) => {
  const folderList = customFolders;
  return folderList.find((folder) => folder.id === id);
};

// Function to determine the display mode based on folder width
export const getDisplayMode = (
  folderWidth,
  containerWidth,
  zoomLevel = 1.0
) => {
  if (!containerWidth) return "normal";
  const widthInPixels = (folderWidth / 100) * containerWidth;

  // Consider zoom level when determining display mode
  const effectiveWidth = widthInPixels * zoomLevel;

  // When zooming out below 0.7, switch to grid view regardless of width
  if (zoomLevel < 0.7) return "micro";

  if (effectiveWidth < 150) return "micro";
  if (effectiveWidth < 250) return "compact";
  return "normal";
};

// Function to determine grid columns based on display mode and width
export const getGridColumns = (displayMode, folderWidth, containerWidth) => {
  if (!containerWidth) return 1;
  const widthInPixels = (folderWidth / 100) * containerWidth;

  if (displayMode === "micro") {
    return widthInPixels < 120 ? 2 : 3;
  }
  if (displayMode === "compact") {
    return widthInPixels < 200 ? 2 : 3;
  }
  return 1;
};

// Add CSS for drag and drop
export const addDragDropStyles = () => {
  if (!document.getElementById("drag-drop-style")) {
    const style = document.createElement("style");
    style.id = "drag-drop-style";
    style.innerHTML = `
.file-dragging {
cursor: grabbing !important;
}

.file-dragging * {
cursor: grabbing !important;
}

/* Add styles to make the drag preview more visible */
.drag-preview-active {
opacity: 0.9;
transform: scale(1.05);
transition: all 0.2s ease;
}

[data-dragging="true"] {
opacity: 0.5;
border: 2px dashed var(--primary);
}

[data-drag-over="true"] {
background-color: var(--accent);
border: 2px solid var(--primary);
}

.drag-target-active {
background-color: var(--accent) !important;
border-color: var(--primary) !important;
box-shadow: 0 0 0 2px var(--primary) !important;
transform: scale(1.02);
transition: all 0.2s ease;
}

/* Add a pulsing effect to show the folder is a valid drop target */
@keyframes pulse-border {
0% { box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0.7); }
70% { box-shadow: 0 0 0 5px rgba(var(--primary-rgb), 0); }
100% { box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0); }
}

.drag-target-active {
animation: pulse-border 1.5s infinite;
}

.selection-box {
position: absolute;
border: 1px dashed blue; /* Use theme variable if available */
background-color: rgba(0, 0, 255, 0.1); /* Use theme variable if available */
pointer-events: none; /* Allow clicks to pass through */
z-index: 50; /* Ensure it's above files but below dialog controls */
}
.file-selected {
background-color: var(--accent) !important; /* Use theme accent */
border-color: var(--primary) !important; /* Use theme primary */
outline: 2px solid var(--primary);
}

/* Multi-file drag indicator */
.multi-file-drag-count {
position: absolute;
top: -8px;
right: -8px;
background-color: var(--primary);
color: white;
border-radius: 50%;
width: 20px;
height: 20px;
display: flex;
align-items: center;
justify-content: center;
font-size: 10px;
font-weight: bold;
z-index: 10;
}

/* Reset cursor after drag operations */
.cursor-reset {
cursor: default !important;
}
.cursor-reset * {
cursor: inherit !important;
}

/* Force cursor reset for all elements */
html.force-cursor-reset,
html.force-cursor-reset * {
cursor: default !important;
}
`;

    document.head.appendChild(style);
  }

  return () => {
    const style = document.getElementById("drag-drop-style");
    if (style) {
      document.head.removeChild(style);
    }
  };
};

// Add style for no text selection
export const addNoSelectStyle = () => {
  if (!document.getElementById("no-select-style")) {
    const style = document.createElement("style");
    style.id = "no-select-style";
    style.innerHTML = `
  .resize-active {
    user-select: none !important;
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
    cursor: col-resize !important;
  }
  .resize-active * {
    user-select: none !important;
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
  }
  
  /* Ensure separators are always interactive */
  .w-4.cursor-col-resize {
    position: relative;
    z-index: 20;
    min-width: 16px;
  }
`;
    document.head.appendChild(style);
  }
};
