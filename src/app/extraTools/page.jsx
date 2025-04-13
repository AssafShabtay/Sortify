"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";

const tools = [
  {
    name: "Duplicate Scanner",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-8 h-8"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="9" y1="3" x2="9" y2="21" />
      </svg>
    ),
  },
  {
    name: "Junk Remover",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-8 h-8"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    ),
  },
  {
    name: "Driver Updater",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-8 h-8"
      >
        <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
        <rect x="9" y="9" width="6" height="6" />
        <line x1="9" y1="1" x2="9" y2="4" />
        <line x1="15" y1="1" x2="15" y2="4" />
        <line x1="9" y1="20" x2="9" y2="23" />
        <line x1="15" y1="20" x2="15" y2="23" />
        <line x1="20" y1="9" x2="23" y2="9" />
        <line x1="20" y1="14" x2="23" y2="14" />
        <line x1="1" y1="9" x2="4" y2="9" />
        <line x1="1" y1="14" x2="4" y2="14" />
      </svg>
    ),
  },
  {
    name: "Unused Remover",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-8 h-8"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
  },
  {
    name: "Back Up",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-8 h-8"
      >
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      </svg>
    ),
  },
  {
    name: "Empty Folder Remover",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-8 h-8"
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
];

export default function ExtraTools() {
  const { toast } = useToast();
  const [openDialog, setOpenDialog] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [selectedCriteria, setSelectedCriteria] = useState("");
  const [isEnabledPreview, setIsEnabledPreview] = useState(true);
  const [isEnabledBackUp, setIsEnabledBackUp] = useState(true);
  const [similarMatchSliderValue, setSimilarMatchSliderValue] = useState([50]);
  const [similarContentSliderValue, setSimilarContentSliderValue] = useState([
    50,
  ]);

  useEffect(() => {
    if (openDialog === null) {
      setSelectedFolder("");
      setSelectedCriteria("");
      setIsEnabledPreview(true);
      setIsEnabledBackUp(true);
      setSimilarMatchSliderValue([50]);
      setSimilarContentSliderValue([50]);
    }
  }, [openDialog]);

  const handleCriteriaValueChange = (value) => {
    setSelectedCriteria(value);
  };

  const handleChooseFolder = () => {
    // Simulating folder selection
    setSelectedFolder("/path/to/selected/folder");
    toast({
      title: "Folder selected",
      description: "You've selected a folder.",
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!selectedFolder || !selectedCriteria) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description:
          "Please select both a folder and a criteria before submitting.",
      });
      return;
    }

    // Handle form submission logic here
    const submittedDialog = openDialog;
    setOpenDialog(null);
    toast({
      variant: "outline",
      description: `Submitted ${submittedDialog}`,
    });
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-2">Extra Tools</h1>
      <p className="text-lg mb-10 text-gray-600">
        Use extra tools to make your computer cleaner without making a big
        change!
      </p>
      <div className="grid grid-cols-3 gap-4">
        {tools.map((tool) => (
          <Dialog
            key={tool.name}
            open={openDialog === tool.name.toLowerCase().replace(" ", "-")}
            onOpenChange={(open) =>
              setOpenDialog(
                open ? tool.name.toLowerCase().replace(" ", "-") : null
              )
            }
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-32 font-custom flex flex-col items-center justify-center text-center p-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm transition-all duration-200 ease-in-out hover:shadow-md"
              >
                {tool.icon}
                <span className="text-sm font-semibold mt-2">{tool.name}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{tool.name}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleChooseFolder}
                  >
                    Choose Folder
                  </Button>
                  <Input
                    type="text"
                    value={selectedFolder}
                    readOnly
                    className="flex-grow"
                    placeholder="Selected folder path"
                  />
                </div>
                {selectedFolder && (
                  <p className="text-sm text-gray-600">
                    Selected folder: {selectedFolder}
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="criteria">Criteria:</Label>
                  <Select onValueChange={handleCriteriaValueChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a Criteria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Criteria</SelectLabel>
                        <SelectItem value="ExactMatch">
                          By Exact Matches
                        </SelectItem>
                        <SelectItem value="ByContent">
                          By Exact Contents
                        </SelectItem>
                        <SelectItem value="SimilarMatch">
                          By Similar Matches
                        </SelectItem>
                        <SelectItem value="SimilarContent">
                          By Similar Contents
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                {selectedCriteria === "SimilarMatch" && (
                  <div className="space-y-2">
                    <Label htmlFor="similarMatchSlider">
                      Similarity Sensitivity
                    </Label>
                    <Slider
                      id="similarMatchSlider"
                      min={1}
                      max={100}
                      step={1}
                      value={similarMatchSliderValue}
                      onValueChange={setSimilarMatchSliderValue}
                    />
                    <div className="text-sm text-gray-500">
                      Current value: {similarMatchSliderValue[0]}
                    </div>
                  </div>
                )}
                {selectedCriteria === "SimilarContent" && (
                  <div className="space-y-2">
                    <Label htmlFor="similarContentSlider">
                      Similarity Sensitivity
                    </Label>
                    <Slider
                      id="similarContentSlider"
                      min={1}
                      max={100}
                      step={1}
                      value={similarContentSliderValue}
                      onValueChange={setSimilarContentSliderValue}
                    />
                    <div className="text-sm text-gray-500">
                      Current value: {similarContentSliderValue[0]}
                    </div>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="preview-mode"
                    checked={isEnabledPreview}
                    onCheckedChange={setIsEnabledPreview}
                  />
                  <Label htmlFor="preview-mode">Preview Before Deleting</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="backup-mode"
                    checked={isEnabledBackUp}
                    onCheckedChange={setIsEnabledBackUp}
                  />
                  <Label htmlFor="backup-mode">Back Up</Label>
                </div>
                <Button type="submit" className="mt-4">
                  Start Scanning
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        ))}
      </div>
    </div>
  );
}
