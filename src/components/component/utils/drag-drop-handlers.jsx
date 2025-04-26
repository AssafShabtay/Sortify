"use client";

import { useToast } from "@/hooks/use-toast";
// Update the import to use the correct file extension if needed (e.g., .js, .jsx)
import { getFolderById } from "./folder-browser-utils";
import { appDataDir, join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";

// --- Drag and Drop Hook ---
export function useDragDropHandlers(
  folderFiles, //remove
  setFolderFiles,
  setHasChanges,
  folderData,
  setFolderData
) {
  const { toast } = useToast();

  // Update the handleFileDragStart function to better handle multiple selected files
  const handleFileDragStart = (filesToDrag) => {
    if (!filesToDrag || filesToDrag.length === 0) {
      return null;
    }

    document.body.classList.add("file-dragging");

    // Update toast message to show number of files being moved
    toast({
      title: `Moving ${filesToDrag.length} file(s)`,
      description: "Drop on a folder to move.",
      duration: 3000,
    });

    console.log(
      "Drag started with files:",
      filesToDrag.map((f) => f.name)
    );
    return filesToDrag; // Return the array of files being dragged
  };

  const handleFileDragEnd = () => {
    // Remove all drag-related classes
    document.body.classList.remove("file-dragging");

    // Remove any drag-target-active classes
    document.querySelectorAll(".drag-target-active").forEach((el) => {
      el.classList.remove("drag-target-active");
    });

    // Remove any dragging attributes
    document.querySelectorAll("[data-dragging='true']").forEach((el) => {
      el.removeAttribute("data-dragging");
    });

    // Remove any drag-over attributes
    document.querySelectorAll("[data-drag-over='true']").forEach((el) => {
      el.removeAttribute("data-drag-over");
    });

    // Reset cursor styles explicitly
    document.body.style.cursor = "";
    document.querySelectorAll("*").forEach((el) => {
      if (el.style && el.style.cursor === "grabbing") {
        el.style.cursor = "";
      }
    });

    console.log("Drag ended and cursor reset");
  };

  const handleFolderDragOver = (e, folderId, draggedFiles) => {
    e.preventDefault(); // Set the drop effect to show a 'move' cursor
    e.dataTransfer.dropEffect = "move";

    // Check if *any* dragged file originates from a different folder than the target
    if (
      draggedFiles &&
      draggedFiles.length > 0 &&
      draggedFiles[0].folderId !== folderId
    ) {
      // Check if the folder already has the active class to avoid reapplying it
      const folderElements = document.querySelectorAll(
        `[data-folder-id="${folderId}"]`
      );

      // Only add the class if it's not already there
      folderElements.forEach((el) => {
        if (!el.classList.contains("drag-target-active")) {
          el.classList.add("drag-target-active");
        }
      });

      return folderId;
    }

    return null;
  };

  const handleFolderDragLeave = (e) => {
    // Only clear if we're not entering a child element
    if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) {
      const folderId = e.currentTarget.getAttribute("data-folder-id");

      if (folderId) {
        // Only remove the highlight from this specific folder
        const folderElements = document.querySelectorAll(
          `[data-folder-id="${folderId}"]`
        );

        folderElements.forEach((el) => {
          el.classList.remove("drag-target-active");
        });
      }

      return null;
    }

    // If we're just moving within the folder, don't change the dragOverFolderId
    return e.currentTarget.getAttribute("data-folder-id");
  };

  const handleFolderDrop = (e, targetFolderId, draggedFiles) => {
    e.preventDefault();

    // Ensure draggedFiles is an array and not empty
    if (
      !Array.isArray(draggedFiles) ||
      draggedFiles.length === 0 ||
      draggedFiles[0].folderId === targetFolderId // Check only the first file's origin
    ) {
      // Reset cursor even if no valid drop occurred
      document.body.classList.remove("file-dragging");
      document.body.style.cursor = "";
      return null;
    }

    console.log(
      `Dropping ${draggedFiles.length} files into folder ${targetFolderId}`
    );

    const sourceFolderId = draggedFiles[0].folderId; // All files come from the same source in box selection

    setFolderFiles((prev) => {
      const newState = { ...prev };

      // Create arrays to work with instead of modifying while iterating
      const filesToRemove = draggedFiles.map((file) => file.id);
      const filesToAdd = draggedFiles.map((file) => ({
        ...file,
        folderId: targetFolderId,
      }));

      // Remove all files from source folder
      newState[sourceFolderId] = prev[sourceFolderId].filter(
        (f) => !filesToRemove.includes(f.id)
      );

      // Add all files to target folder
      newState[targetFolderId] = [
        ...(prev[targetFolderId] || []),
        ...filesToAdd,
      ];

      return newState;
    });

    // Update folderData to reflect the new item counts
    if (setFolderData) {
      setFolderData((prev) => {
        if (!Array.isArray(prev)) {
          console.error("folderData is not an array:", prev);
          return prev;
        }

        return prev.map((folder) => {
          if (folder.id === sourceFolderId) {
            // Decrease count for source folder
            return {
              ...folder,
              itemCount: Math.max(0, folder.itemCount - draggedFiles.length),
            };
          } else if (folder.id === targetFolderId) {
            // Increase count for target folder
            return {
              ...folder,
              itemCount: folder.itemCount + draggedFiles.length,
            };
          }
          return folder;
        });
      });
    }

    toast({
      title: "Files moved",
      description: `${draggedFiles.length} file(s) moved to ${
        getFolderById(targetFolderId)?.name
      }`,
      duration: 3000,
    });

    setHasChanges(true);

    // Reset cursor styles explicitly after drop - use setTimeout to ensure it runs after all event handlers
    setTimeout(() => {
      document.body.classList.remove("file-dragging");
      document.body.style.cursor = "";

      // Remove any drag-related classes from all elements
      document.querySelectorAll(".drag-target-active").forEach((el) => {
        el.classList.remove("drag-target-active");
      });

      document.querySelectorAll("[data-dragging='true']").forEach((el) => {
        el.removeAttribute("data-dragging");
      });

      // Add a temporary class to force cursor reset
      document.body.classList.add("cursor-reset");
      setTimeout(() => {
        document.body.classList.remove("cursor-reset");
      }, 100);

      console.log("Cursor reset after drop");
    }, 0);

    return null;
  };

  return {
    handleFileDragStart,
    handleFileDragEnd,
    handleFolderDragOver,
    handleFolderDragLeave,
    handleFolderDrop,
  };
}

export async function saveChanges(
  folderFiles,
  setHasChanges,
  setIsSaving,
  baseOutput,
  toast,
  copyOrMove
) {
  setIsSaving(true);

  const updateJsonFile = async () => {
    try {
      const jsonData = convertToJsonFormat(folderFiles);
      const appDataPath = await appDataDir();

      if (!(await exists(appDataPath))) {
        await mkdir(appDataPath, { recursive: true });
        console.log(`Created directory: ${appDataPath}`);
      }

      const filePath = await join(appDataPath, "Organization_Structure.json");
      console.log(`Attempting to save to: ${filePath}`);

      await writeTextFile(filePath, JSON.stringify(jsonData, null, 2));

      toast({
        title: "Changes saved",
        description: `Your changes have been saved to ${filePath}.`,
        duration: 3000,
      });

      setHasChanges(false);
      return true;
    } catch (error) {
      console.error("Error saving JSON file with Tauri:", error);
      toast({
        title: "Error saving JSON",
        description: `Could not save file.json. Error: ${
          error.message || error
        }`,
        variant: "destructive",
        duration: 5000,
      });
      return false;
    }
  };

  const convertToJsonFormat = (folderFiles) => {
    const result = [];
    Object.entries(folderFiles).forEach(([folderId, files]) => {
      files.forEach((file) => {
        result.push({
          path: file.path || `Unknown path for ${file.name}`,
          label: Number.parseInt(folderId, 10),
        });
      });
    });
    return result;
  };

  const jsonSaveSuccess = await updateJsonFile();
  if (!jsonSaveSuccess) {
    setIsSaving(false);
    return; // Stop execution if saving fails
  }
  try {
    await invoke("organize_files_from_json", {
      baseOutput: baseOutput,
      copyOrMove: copyOrMove,
    });

    toast({
      title: "Changes saved & Processed",
      description: "File organization updated.",
      duration: 3000,
    });
  } catch (error) {
    console.error("Error invoking:", error);
    toast({
      title: "Error processing changes",
      description: `Could not run organize model. Error: ${error}`,
      variant: "destructive",
      duration: 5000,
    });
  } finally {
    setIsSaving(false); // Always reset the saving state
  }
}
