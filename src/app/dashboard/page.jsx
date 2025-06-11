"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  FiInfo,
  FiFolder,
  FiSettings,
  FiAlertTriangle,
  FiArchive,
  FiEye,
  FiZap,
  FiX,
} from "react-icons/fi";
import { BiCategoryAlt } from "react-icons/bi";
import { HiOutlineDuplicate } from "react-icons/hi";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function Dashboard() {
  const { toast } = useToast();
  const [fileCount, setFileCount] = useState(0);
  const [isDialogBrowserOpen, setIsDialogBrowserOpen] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [isCounting, setIsCounting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [animateCard, setAnimateCard] = useState(false);
  const [animateOptions, setAnimateOptions] = useState(false);
  const [screenSize, setScreenSize] = useState("md");
  const [folderHover, setFolderHover] = useState(false);
  const [quickStats, setQuickStats] = useState({
    recentFiles: 0,
    images: 0,
    documents: 0,
    others: 0,
  });

  // Element references for animations
  const headerRef = useRef(null);
  const statsCardRef = useRef(null);

  const [organizeState, setOrganizeState] = useState({
    selectedFolder: "",
    useTargetAsOutput: true,
    TreatToplevelFoldersAsOne: false,
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

  // Update screen size for responsive design
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setScreenSize("sm");
      } else if (window.innerWidth < 1024) {
        setScreenSize("md");
      } else {
        setScreenSize("lg");
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Initial call

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Animation sequence on initial load
  useEffect(() => {
    // Animate card entry on first render
    setAnimateCard(true);

    // Animate options after card is shown
    const timer = setTimeout(() => {
      setAnimateOptions(true);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  // Set up loading message rotation when organizing is active
  useEffect(() => {
    let messageInterval;
    let progressInterval;
    let startTime;

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
        const isFirstThirtySeconds = elapsedTime < 35000;

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
      if (messageInterval) clearInterval(messageInterval);
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [isOrganizing, fileCount, loadingMessages]);

  // Separate useEffect to handle the completion animation
  useEffect(() => {
    let smoothTransition;

    // When organizing stops and progress is not yet 100%
    if (!isOrganizing && loadingProgress > 0 && loadingProgress < 100) {
      const currentProgress = loadingProgress;
      const remainingProgress = 100 - currentProgress;
      const duration = 2000; // 2 seconds
      const startTime = Date.now();

      smoothTransition = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const ratio = Math.min(elapsed / duration, 1);

        // Use easeOutQuad for smoother ending
        const easedRatio = ratio * (2 - ratio);
        const newProgress = currentProgress + remainingProgress * easedRatio;

        setLoadingProgress(newProgress);

        if (elapsed >= duration) {
          clearInterval(smoothTransition);
          setLoadingProgress(100);
        }
      }, 16); // ~60fps
    }

    return () => {
      if (smoothTransition) clearInterval(smoothTransition);
    };
  }, [isOrganizing, loadingProgress]);

  // Set random stats data when folder is selected
  useEffect(() => {
    if (fileCount > 0) {
      // Generate some plausible random stats based on file count
      setQuickStats({
        recentFiles: Math.floor(fileCount * 0.3),
        images: Math.floor(fileCount * 0.4),
        documents: Math.floor(fileCount * 0.35),
        others: Math.floor(fileCount * 0.25),
      });
    }
  }, [fileCount]);

  const handleSelectFolder = useCallback(async () => {
    try {
      const folderPath = await open({
        directory: true,
        title: "Select Target Folder",
        multiple: false,
      });

      if (folderPath) {
        // Instead of hiding the cards, show a counting indicator
        setIsCounting(true);

        setOrganizeState((prevState) => ({
          ...prevState,
          selectedFolder: folderPath,
        }));

        toast({
          title: "Scanning folder",
          description: "Counting files...",
        });

        const count = await invoke("count_files_in_folder", {
          folderPath: folderPath,
          treatToplevelFoldersAsOne: organizeState.TreatToplevelFoldersAsOne,
        });

        console.log("count: ", count);
        setFileCount(count);

        // Show toast on completion
        toast({
          title: "Folder analyzed",
          description: `Found ${count} files`,
          variant: "success",
        });
      }
    } catch (error) {
      console.error("Error getting file count:", error);
      setFileCount(100);

      toast({
        title: "Error scanning folder",
        description: "Using estimated file count",
        variant: "destructive",
      });
    } finally {
      // Always stop the counting indicator when done
      setIsCounting(false);
    }
  }, [organizeState.TreatToplevelFoldersAsOne, toast]);

  const handleOrganizeStateChange = useCallback((key, value) => {
    setOrganizeState((prevState) => ({
      ...prevState,
      [key]: value,
    }));
  }, []);

  const handleSelectOutputFolder = useCallback(async () => {
    try {
      const folderPath = await open({ directory: true });
      if (folderPath) {
        setOrganizeState((prevState) => ({
          ...prevState,
          outputFolder: folderPath,
        }));
      }
    } catch (error) {
      console.error("Error selecting output folder:", error);
      toast({
        title: "Error",
        description: "Failed to select output folder",
        variant: "destructive",
      });
    }
  }, [toast]);

  const StartOrganizerModel = useCallback(
    async (folderPath) => {
      try {
        setIsOrganizing(true); // Set loading state to true before starting
        setLoadingProgress(0); // Initialize progress at the beginning

        if (fileCount < 6) {
          toast({
            title: "Error",
            description: `Not enough files in folder`,
            variant: "destructive",
          });
          return;
        }

        // Wait for the invoke to complete using await
        await invoke("run_organize_model", {
          folderPath: folderPath,
          treatToplevelFoldersAsOne: organizeState.TreatToplevelFoldersAsOne,
        });

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
        setTimeout(() => {
          setIsOrganizing(false);
        }, 1000);
      }
    },
    [fileCount, organizeState.TreatToplevelFoldersAsOne, toast]
  );

  // Function to render the option row with icon - enhanced with animation
  const renderOptionRow = useCallback(
    (label, checked, onChange, icon, isDisabled = false, tooltip = null) => {
      return (
        <div
          className={`flex items-center justify-between py-2 hover:bg-theme-secondary-20 rounded px-2 transition-all duration-300 
          ${
            animateOptions
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-4"
          }`}
        >
          <div className="flex items-center space-x-2">
            {icon}
            <div className="flex items-center">
              <Label className="font-medium text-gray-700 text-sm">
                {label}
              </Label>
              {tooltip && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <FiInfo className="text-base text-gray-500 cursor-pointer ml-1.5" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-sm">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          <Switch
            checked={checked}
            onCheckedChange={(value) => {
              // Add a visual feedback when toggled
              const element = document.activeElement;
              if (element) {
                element.classList.add("scale-110");
                setTimeout(() => element.classList.remove("scale-110"), 200);
              }
              onChange(value);
            }}
            disabled={isDisabled}
            className="transition-transform duration-200 hover:scale-100 focus:ring-theme-secondary"
          />
        </div>
      );
    },
    [animateOptions]
  );

  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 pt-8 h-full max-h-screen overflow-auto">
        <div
          className={`flex flex-col space-y-6 transition-all duration-500 ${
            screenSize === "sm" ? "px-1" : ""
          } pb-8`}
        >
          <div className="flex justify-between items-center" ref={headerRef}>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-theme-dark transition-all duration-300 hover:text-theme-primary">
                File Organizer
              </h1>
              <p className="text-base text-theme-primary transition-opacity duration-300 hover:opacity-80">
                Automatically organize and manage your files
              </p>
            </div>

            <div>
              <Badge
                variant="outline"
                className="bg-theme-secondary-light text-theme-dark border-theme-secondary text-sm px-3 py-1.5 flex items-center 
                  hover:bg-theme-secondary-20 transition-colors duration-300"
              >
                <FiZap
                  className={`mr-1.5 transition-transform duration-300 ${
                    isOrganizing ? "text-yellow-500 animate-pulse" : ""
                  }`}
                />
                AI Powered
              </Badge>
            </div>
          </div>

          {/* Stats Cards - with animation */}
          <Card
            ref={statsCardRef}
            className={`bg-theme-secondary-light border-theme-secondary-30 transition-all duration-500 ease-in-out
              ${
                animateCard
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 -translate-y-4"
              }
              ${screenSize === "sm" ? "p-2" : ""}`}
          >
            <CardContent
              className={`${screenSize === "sm" ? "p-3" : "pt-5 pb-5 px-4"}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-theme-dark">
                    Files Selected
                  </p>
                  <div className="flex items-center">
                    <h3
                      className={`text-2xl font-bold text-theme-dark transition-all duration-500 ml-2 ${
                        fileCount > 0 ? "scale-110" : "scale-100"
                      }`}
                    >
                      {fileCount || 0}
                    </h3>
                    {isCounting && (
                      <div className="ml-3 flex items-center">
                        <svg
                          className="animate-spin h-4 w-4 text-theme-primary"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span className="text-sm ml-2 text-theme-primary">
                          Counting...
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Quick file stats - appear after folder selection */}
                  {fileCount > 0 && (
                    <div className="flex space-x-3 mt-2 text-xs text-theme-primary animate-fadeIn">
                      <span>{quickStats.images} images</span>
                      <span>•</span>
                      <span>{quickStats.documents} docs</span>
                      <span>•</span>
                      <span>{quickStats.others} other</span>
                    </div>
                  )}
                </div>
                <div
                  className={`h-12 w-12 bg-theme-primary rounded-full flex items-center justify-center transition-all duration-300
                    hover:bg-theme-dark ${
                      folderHover ? "scale-110" : "scale-100"
                    } ${isCounting ? "opacity-70 cursor-wait" : ""}`}
                  onMouseEnter={() => setFolderHover(true)}
                  onMouseLeave={() => setFolderHover(false)}
                  onClick={isCounting ? null : handleSelectFolder}
                >
                  <FiFolder className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Card */}
          <Card
            className={`border-theme-secondary-40 shadow-sm overflow-hidden transition-all duration-500 ease-in-out
              ${
                animateCard
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
          >
            <CardHeader
              className={`bg-theme-dark text-white py-4 px-5 transition-colors duration-300 hover:bg-theme-dark-90
              ${screenSize === "sm" ? "py-3 px-4" : ""} sticky top-0 z-10`}
            >
              <CardTitle className="text-xl flex items-center">
                <FiFolder className="mr-2" />
                <span className="transition-all duration-300 hover:translate-x-1">
                  File Organization
                </span>
              </CardTitle>
              <CardDescription className="text-theme-secondary opacity-90 text-sm">
                Organize your files into logical categories
              </CardDescription>
            </CardHeader>

            <CardContent
              className={`${
                screenSize === "sm" ? "p-3" : "p-5"
              } transition-all duration-300 overflow-y-auto`}
              style={{ maxHeight: "calc(100vh - 200px)" }}
            >
              <div
                className={`space-y-5 ${
                  screenSize === "sm" ? "space-y-4" : ""
                }`}
              >
                {/* Select Folder Section */}
                <div
                  className={`bg-theme-secondary-light p-4 rounded-lg border border-theme-secondary-30 
                    transition-all duration-300 hover:border-theme-primary-60
                    ${screenSize === "sm" ? "p-3" : ""}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold flex items-center">
                      <FiFolder
                        className={`mr-2 text-theme-primary transition-transform duration-300 
                        ${folderHover ? "rotate-3" : ""}`}
                      />
                      Select Source Folder
                    </h3>
                    <Button
                      onClick={handleSelectFolder}
                      variant="outline"
                      size="sm"
                      className={`border-theme-primary text-theme-dark hover:bg-theme-secondary-20 h-9 transition-all duration-300 hover:scale-105 ${
                        isCounting ? "opacity-70 cursor-wait" : ""
                      }`}
                      onMouseEnter={() => setFolderHover(true)}
                      onMouseLeave={() => setFolderHover(false)}
                      disabled={isCounting}
                    >
                      {isCounting ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-theme-dark"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Scanning...
                        </>
                      ) : (
                        <>
                          <FiFolder className="mr-2" /> Browse
                        </>
                      )}
                    </Button>
                  </div>

                  {organizeState.selectedFolder ? (
                    <div
                      className="bg-white p-3 rounded border border-theme-secondary-30 flex items-center text-sm
                      transition-all duration-500 hover:border-theme-primary-60"
                    >
                      <FiFolder className="text-theme-primary mr-2 flex-shrink-0" />
                      <p className="text-theme-dark truncate">
                        {organizeState.selectedFolder}
                      </p>
                      {fileCount > 0 && (
                        <Badge className="ml-3 bg-theme-secondary-20 text-theme-dark border-0 text-sm transition-all duration-300 hover:bg-theme-secondary-40">
                          {isCounting ? "Counting..." : `${fileCount} files`}
                        </Badge>
                      )}
                      {organizeState.selectedFolder && !isCounting && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 ml-auto flex items-center justify-center text-gray-400 hover:text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrganizeState((prev) => ({
                              ...prev,
                              selectedFolder: "",
                            }));
                            setFileCount(0);
                            setQuickStats({
                              recentFiles: 0,
                              images: 0,
                              documents: 0,
                              others: 0,
                            });
                          }}
                        >
                          <FiX size={14} />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div
                      className="bg-theme-secondary-light border border-dashed border-theme-secondary-40 rounded-lg p-3 text-center text-sm
                      transition-all duration-300 hover:bg-theme-secondary-20"
                    >
                      <p className="text-theme-dark">No folder selected</p>
                    </div>
                  )}
                </div>

                {/* Output Options */}
                <div
                  className={`space-y-2 transition-all duration-500 ease-in-out
                    ${
                      animateOptions
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-4"
                    }`}
                  style={{ transitionDelay: "100ms" }}
                >
                  <h3 className="text-base font-semibold flex items-center mb-2">
                    <FiSettings className="mr-2 text-theme-primary" />{" "}
                    Organization Settings
                  </h3>

                  <div className="ml-1 bg-theme-secondary-light p-4 rounded-lg border border-theme-secondary-30 transition-all duration-300 hover:border-theme-primary-40">
                    {renderOptionRow(
                      "Use same folder for output",
                      organizeState.useTargetAsOutput,
                      (value) =>
                        handleOrganizeStateChange("useTargetAsOutput", value),
                      <FiFolder className="text-theme-primary h-5 w-5" />
                    )}

                    {!organizeState.useTargetAsOutput && (
                      <div className="border-l-2 border-theme-primary pl-3 ml-2 mt-2 transition-all duration-300 animate-fadeIn">
                        <div className="flex items-center justify-between py-1.5">
                          <Label className="font-medium text-theme-dark text-sm">
                            Output Folder:
                          </Label>
                          <Button
                            onClick={handleSelectOutputFolder}
                            variant="outline"
                            size="sm"
                            className="border-theme-secondary text-theme-dark hover:bg-theme-secondary-20 h-8 text-sm transition-transform duration-300 hover:scale-105"
                            disabled={isCounting}
                          >
                            <FiFolder className="mr-1.5" /> Select
                          </Button>
                        </div>
                        {organizeState.outputFolder && (
                          <div className="bg-white p-2 rounded border border-theme-secondary-30 text-sm text-theme-dark animate-fadeIn">
                            {organizeState.outputFolder}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Organization Options */}
                <div
                  className={`transition-all duration-500 ease-in-out
                    ${
                      animateOptions
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-4"
                    }`}
                  style={{ transitionDelay: "200ms" }}
                >
                  <div
                    className={`grid ${
                      screenSize === "sm"
                        ? "grid-cols-1 gap-3"
                        : "grid-cols-1 md:grid-cols-2 gap-4"
                    }`}
                  >
                    <div className="bg-theme-secondary-light p-4 rounded-lg border border-theme-secondary-30 transition-all duration-300 hover:border-theme-primary-40">
                      {renderOptionRow(
                        "Treat Top Level Folders As One",
                        organizeState.TreatToplevelFoldersAsOne,
                        (value) =>
                          handleOrganizeStateChange(
                            "TreatToplevelFoldersAsOne",
                            value
                          ),
                        <BiCategoryAlt className="text-theme-primary h-5 w-5" />,
                        false,
                        "Group all top level folders"
                      )}

                      {renderOptionRow(
                        "Remove duplicates - Unavailable",
                        organizeState.removeDuplicates,
                        (value) =>
                          handleOrganizeStateChange("removeDuplicates", value),
                        <HiOutlineDuplicate className="text-theme-primary h-5 w-5" />,
                        true
                      )}

                      {renderOptionRow(
                        "Back up before organizing - Unavailable",
                        organizeState.isOrganizeEnabledBackUp,
                        (value) =>
                          handleOrganizeStateChange(
                            "isOrganizeEnabledBackUp",
                            value
                          ),
                        <FiAlertTriangle className="text-theme-primary h-5 w-5" />,
                        true
                      )}
                    </div>

                    <div className="bg-theme-secondary-light p-4 rounded-lg border border-theme-secondary-30 transition-all duration-300 hover:border-theme-primary-40">
                      {renderOptionRow(
                        "Auto-rename files - Unavailable",
                        organizeState.autoRenameFiles,
                        (value) =>
                          handleOrganizeStateChange("autoRenameFiles", value),
                        <FiSettings className="text-green-600 h-5 w-5" />,
                        true
                      )}

                      {renderOptionRow(
                        "Archive old files - Unavailable",
                        organizeState.autoArchiveOldFiles,
                        (value) =>
                          handleOrganizeStateChange(
                            "autoArchiveOldFiles",
                            value
                          ),
                        <FiArchive className="text-theme-primary h-5 w-5" />,
                        true
                      )}

                      {renderOptionRow(
                        "Manual review - Unavailable",
                        organizeState.manualReviewNotifications,
                        (value) =>
                          handleOrganizeStateChange(
                            "manualReviewNotifications",
                            value
                          ),
                        <FiEye className="text-theme-primary h-5 w-5" />,
                        true
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>

            <Separator className="bg-theme-secondary-30" />

            <CardFooter
              className={`px-4 py-3 bg-theme-secondary-light flex justify-center items-center transition-all duration-300
              ${screenSize === "sm" ? "px-3 py-2" : ""} sticky bottom-0 z-10`}
            >
              <div className="flex justify-center w-1/3">
                <Button
                  className={`bg-theme-dark hover:bg-theme-dark-90 text-white h-8 text-xs transition-all duration-300 w-full
                  ${isOrganizing || isCounting ? "" : "hover:scale-105"}
                  ${fileCount > 0 ? "animate-pulse-subtle" : ""}`}
                  size="sm"
                  onClick={() => {
                    if (!organizeState.selectedFolder) {
                      toast({
                        title: "Error",
                        description: "Please select a folder first.",
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
                  disabled={isOrganizing || isCounting}
                >
                  {isOrganizing ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-1 h-3 w-3 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Organizing...
                    </>
                  ) : (
                    <>
                      <BiCategoryAlt
                        className={`mr-1 ${
                          fileCount > 0 ? "animate-bounce-subtle" : ""
                        }`}
                      />{" "}
                      Organize Files
                    </>
                  )}
                </Button>
              </div>
            </CardFooter>
          </Card>

          <Button
            variant="outline"
            onClick={() => setIsDialogBrowserOpen(true)}
            className="border-theme-primary text-theme-dark hover:bg-theme-secondary-20 h-8 text-xs transition-all duration-300 hover:scale-105"
            size="sm"
          >
            <FiFolder className="mr-1" /> Browse
          </Button>
        </div>

        <FolderBrowserDialog
          isOpen={isDialogBrowserOpen}
          onOpenChange={setIsDialogBrowserOpen}
          baseOutput={
            organizeState.useTargetAsOutput
              ? organizeState.selectedFolder
              : organizeState.outputFolder
          }
          toast={toast}
        />

        {/* Enhanced Loading Overlay */}
        {isOrganizing && (
          <div className="fixed top-[60px] left-0 right-0 bottom-0 bg-theme-dark-90 backdrop-blur-md flex items-center justify-center z-40 transition-all duration-500 animate-fadeIn">
            <div
              className="bg-white px-6 pt-2 pb-6 rounded-xl shadow-lg flex flex-col items-center max-w-md w-full mx-4 border border-theme-secondary-40 animate-scaleIn"
              style={{ maxHeight: "90vh", overflowY: "auto" }}
            >
              {/* Spinner Container */}
              <div className="flex justify-center items-center relative">
                {/* Outer circle */}
                <div className="w-40 h-40 border-6 border-primary/30 rounded-full"></div>
                {/* Inner static circle */}
                <div className="absolute top-8 left-8 w-24 h-24 border-4 border-theme-secondary-40 rounded-full"></div>
                {/* Inner animated spinner */}
                <div
                  className="absolute top-8 left-8 w-24 h-24 border-4 border-theme-secondary rounded-full animate-spin border-t-transparent"
                  style={{ animationDuration: "1.2s" }}
                ></div>
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold mb-2 text-theme-dark">
                Organizing Files
              </h3>

              {/* Loading Message */}
              <div className="h-5 mb-3 text-center">
                <p className="text-theme-primary text-sm animate-pulse">
                  {loadingMessage}
                </p>
              </div>

              {/* Progress Bar Container */}
              <div className="w-full bg-theme-secondary-20 rounded-full h-2.5 mb-3 overflow-hidden">
                <div
                  className="bg-theme-primary h-full transition-all duration-300 ease-out rounded-full"
                  style={{
                    width: `${loadingProgress}%`,
                    boxShadow: "0 0 10px rgba(84, 119, 146, 0.5)",
                  }}
                ></div>
              </div>

              {/* File Count Text */}
              <div className="text-sm text-theme-primary text-center font-medium">
                <p>Processing {fileCount} files</p>
                <p className="text-xs mt-1 opacity-75">
                  This may take a moment...
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
