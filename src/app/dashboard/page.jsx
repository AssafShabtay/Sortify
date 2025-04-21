"use client";

import React, { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FiInfo } from "react-icons/fi";
import { invoke } from "@tauri-apps/api/core";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import FolderBrowserDialog from "@/components/component/folder-browser-dialog";
import { useToast } from "@/hooks/use-toast";
import { listen } from "@tauri-apps/api/event";

export default function Dashboard() {
  const { toast } = useToast();
  const [fileCount, setFileCount] = useState(0);
  const [isDialogBrowserOpen, setIsDialogBrowserOpen] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  // Add state for loading message
  const [loadingMessage, setLoadingMessage] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);

  const [organizeState, setOrganizeState] = useState({
    selectedFolder: "",
    useTargetAsOutput: true,
    isOrganizeEnabledBackUp: true,
    removeDuplicates: false,
    excludeFolders: false,
    autoRenameFiles: false,
    autoArchiveOldFiles: false,
    manualReviewNotifications: false,
    backgroundRun: false,
  });

  // Array of loading messages to cycle through
  const loadingMessages = [
    "Scanning files...",
    "Analyzing file types...",
    "Identifying patterns...",
    "Creating clusters...",
    "Organizing your files...",
    "Preparing file structure...",
    "Almost there...",
    "Finalizing organization...",
  ];

  // Set up loading message rotation when organizing is active
  useEffect(() => {
    let messageInterval;
    let progressInterval;
    let startTime;
    setLoadingProgress((prev) => {
      // Smaller increments for larger file counts
      const increment = 0.1;
      const newProgress = prev + increment;
      return Math.min(newProgress, 90);
    });
    if (isOrganizing) {
      startTime = Date.now();
      setLoadingMessage(loadingMessages[0]);
      setLoadingProgress(0);

      // Update message every 3 seconds
      let messageIndex = 0;
      messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[messageIndex]);
      }, 3000);

      // Update progress bar
      const baseInterval = 800; // Base interval in ms
      const intervalAdjustment = Math.max(
        100,
        Math.min(1500, baseInterval * (1 + fileCount / 1000))
      );

      // Update progress bar at calculated rate
      progressInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const isFirstThirtySeconds = elapsedTime < 50000;

        setLoadingProgress((prev) => {
          // Very slow increment for first 30 seconds
          if (isFirstThirtySeconds) {
            // Extremely small increments during first 30 seconds
            // Will reach ~15% after 30 seconds
            const tinyIncrement = Math.random() * 0.1;
            return Math.min(prev + tinyIncrement, 10);
          } else {
            const increment =
              fileCount > 500
                ? Math.random() * 2
                : fileCount > 100
                ? Math.random() * 3
                : Math.random() * 5;

            // Increase progress but cap at 90% until complete
            const newProgress = prev + increment;
            return Math.min(newProgress, 90);
          }
        });
      }, intervalAdjustment);
    }

    // Clean up intervals when component unmounts or organizing stops
    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
      if (!isOrganizing) {
        setLoadingProgress(100); // Set to 100% when complete
      }
    };
  }, [isOrganizing]);

  const handleSelectFolder = async () => {
    const folderPath = await open({ directory: true });
    if (folderPath) {
      setOrganizeState((prevState) => ({
        ...prevState,
        selectedFolder: folderPath,
      }));
      try {
        const count = await invoke("count_files_in_folder", { folderPath });
        console.log("count: ", count);
        setFileCount(count);
      } catch (error) {
        console.error("Error getting file count:", error);
        setFileCount(100);
      }
    }
  };

  const handleOrganizeStateChange = (key, value) => {
    setOrganizeState((prevState) => ({
      ...prevState,
      [key]: value,
    }));
  };

  const handleSelectOutputFolder = async () => {
    const folderPath = await open({ directory: true });
    if (folderPath) {
      setOrganizeState((prevState) => ({
        ...prevState,
        outputFolder: folderPath,
      }));
    }
  };

  async function StartOrganizerModel(folder_path) {
    let unlistenFn;
    try {
      setIsOrganizing(true); // Set loading state to true before starting
      setLoadingProgress(0); // Initialize progress at the beginning

      unlistenFn = await listen("organization_progress", (event) => {
        // Update progress based on event data
        switch (event.payload) {
          case "Not enough files":
            setIsOrganizing(false);
            toast({
              title: "Error",
              description: `Not enough files in folder`,
              variant: "destructive",
            });
            return;
          case "Completed":
            setLoadingProgress(90);
            break;
          default:
            // Handle any other progress messages
            console.log(`Received progress update: ${event.payload}`);
        }
      });
      // Wait for the invoke to complete using await
      await invoke("run_organize_model", { folderPath: folder_path });

      console.log("Completed");

      // Only proceed after the invoke is fully complete
      setLoadingProgress(100);

      toast({
        title: "Success",
        description: "Files organized successfully!",
        variant: "success",
      });

      // Only now open the dialog browser
      setIsDialogBrowserOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to organize files: ${error.message || error}`,
        variant: "destructive",
      });
    } finally {
      // Short delay before removing loading screen for better UX
      if (unlistenFn) {
        unlistenFn();
      }
      setTimeout(() => {
        setIsOrganizing(false);
      }, 1000);
    }
  }

  return (
    <TooltipProvider>
      <div className="p-4 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
          {/* ORGANIZE Block */}
          <div className="bg-green-20 rounded-lg border border-gray-300 p-4 md:p-6">
            <div className="space-y-4 md:space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-tight">ORGANIZE</h2>
                <button
                  onClick={handleSelectFolder}
                  className="text-sm text-blue-500 underline hover:text-blue-700"
                >
                  Select Folder
                </button>
              </div>

              {organizeState.selectedFolder && (
                <p className="text-sm text-gray-700 mt-2 md:mt-4">
                  Selected Folder: {organizeState.selectedFolder}
                </p>
              )}

              <div className="space-y-2 md:space-y-2 mt-2 md:mt-4">
                <div className="flex items-center justify-between">
                  <Label className="pl-[0.1rem] font-semibold text-gray-700">
                    Use same folder for output?
                  </Label>
                  <Switch
                    checked={organizeState.useTargetAsOutput}
                    onCheckedChange={(value) =>
                      handleOrganizeStateChange("useTargetAsOutput", value)
                    }
                  />
                </div>

                {!organizeState.useTargetAsOutput && (
                  <div className="flex flex-col space-y-2 border-l-2 border-gray-200 pl-3 ml-1 mb-1">
                    <div className="flex items-center justify-between">
                      <Label className="pl-[0.1rem] font-semibold text-gray-700">
                        Output Folder:
                      </Label>
                      <button
                        onClick={handleSelectOutputFolder}
                        className="text-sm text-blue-500 underline hover:text-blue-700"
                      >
                        Select Output Folder
                      </button>
                    </div>
                    {organizeState.outputFolder && (
                      <p className="text-sm text-gray-700">
                        Output Folder: {organizeState.outputFolder}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <Label className="pl-[0.1rem] font-semibold text-gray-700">
                    Remove duplicates? - not working
                  </Label>
                  <Switch
                    checked={organizeState.removeDuplicates}
                    onCheckedChange={(value) =>
                      handleOrganizeStateChange("removeDuplicates", value)
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="pl-[0.1rem] font-semibold text-gray-700">
                    Back up before organizing? - not working
                  </Label>
                  <Switch
                    checked={organizeState.isOrganizeEnabledBackUp}
                    onCheckedChange={(value) =>
                      handleOrganizeStateChange(
                        "isOrganizeEnabledBackUp",
                        value
                      )
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="pl-[0.1rem] font-semibold text-gray-700">
                    Exclude specific folders? - not working
                  </Label>
                  <Switch
                    checked={organizeState.excludeFolders}
                    onCheckedChange={(value) =>
                      handleOrganizeStateChange("excludeFolders", value)
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="pl-[0.1rem] font-semibold text-gray-700">
                    Auto-rename files? - not working
                  </Label>
                  <Switch
                    checked={organizeState.autoRenameFiles}
                    onCheckedChange={(value) =>
                      handleOrganizeStateChange("autoRenameFiles", value)
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Label className="pl-[0.1rem] font-semibold text-gray-700">
                      Archive old files? - not working
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <FiInfo className="text-lg text-gray-600 cursor-pointer ml-[0.125rem]" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Once this option is enabled, the system will move files
                        that haven&apos;t been used for up to a year into an
                        archive folder. - not working
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    checked={organizeState.autoArchiveOldFiles}
                    onCheckedChange={(value) =>
                      handleOrganizeStateChange("autoArchiveOldFiles", value)
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Label className="pl-[0.1rem] font-semibold text-gray-700">
                      Manual review? - not working
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <FiInfo className="text-lg text-gray-600 cursor-pointer ml-[0.125rem]" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Once the organization is complete, a brief review and
                        confirmation of the arrangement will take place. You can
                        then make any necessary edits to the organization if
                        needed. - not working
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    checked={organizeState.manualReviewNotifications}
                    onCheckedChange={(value) =>
                      handleOrganizeStateChange(
                        "manualReviewNotifications",
                        value
                      )
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="pl-[0.1rem] font-semibold text-gray-700">
                    Run in the background? - not working
                  </Label>
                  <Switch
                    checked={organizeState.backgroundRun}
                    onCheckedChange={(value) =>
                      handleOrganizeStateChange("backgroundRun", value)
                    }
                  />
                </div>
                <div className="flex justify-center items-center w-full h-full mt-4">
                  <Button
                    className="w-full md:w-[12rem]"
                    onClick={() => {
                      if (!organizeState.selectedFolder) {
                        toast({
                          title: "Error",
                          description:
                            "Please select a folder before proceeding.",
                          variant: "destructive",
                        });
                        return;
                      }

                      if (
                        !organizeState.useTargetAsOutput &&
                        !organizeState.outputFolder
                      ) {
                        toast({
                          title: "Error",
                          description: "Please select an output folder.",
                          variant: "destructive",
                        });
                        return;
                      }
                      StartOrganizerModel(organizeState.selectedFolder);
                    }}
                    disabled={isOrganizing}
                  >
                    {isOrganizing ? "Organizing..." : "Button"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Button
          size="lg"
          className="w-full mt-4 md:mt-8"
          onClick={() => setIsDialogBrowserOpen(true)}
        >
          Browse Folders
        </Button>
        <FolderBrowserDialog
          open={isDialogBrowserOpen}
          onOpenChange={setIsDialogBrowserOpen}
          baseOutput={
            organizeState.useTargetAsOutput
              ? organizeState.selectedFolder
              : organizeState.outputFolder
          }
          toast={toast}
        />

        {/* Enhanced Loading Screen with Animation, Updating Text*/}
        {isOrganizing && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-300">
            <div className="bg-background p-8 rounded-xl shadow-2xl flex flex-col items-center max-w-md w-full mx-4 border border-border/50">
              {/* Animated spinner with pulsing effect */}
              <div className="relative mb-6">
                <div className="w-20 h-20 border-4 border-primary/30 rounded-full"></div>
                <div className="absolute top-0 left-0 w-20 h-20 border-4 border-primary rounded-full animate-spin border-t-transparent"></div>
                <div
                  className="absolute top-0 left-0 w-20 h-20 border-4 border-transparent rounded-full animate-pulse border-t-primary/50 border-b-primary/50"
                  style={{ animationDuration: "2s" }}
                ></div>
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold mb-3">Organizing Your Files</h3>

              {/* Animated loading message */}
              <div className="h-6 mb-4 text-center">
                <p className="text-muted-foreground animate-fadeIn">
                  {loadingMessage}
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-2 mb-4 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-500 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>

              {/* Tips section */}
              <div className="text-sm text-muted-foreground text-center mt-2 max-w-xs mb-6">
                <p>
                  This process may take a few moments depending on the number of
                  files being organized.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
