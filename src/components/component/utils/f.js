/*
"use client";

import { z } from "zod";
import { appDataDir, join, desktopDir } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, stat } from "@tauri-apps/plugin-fs";

// 1. Define the expected schema for the JSON
const fileSchema = z.object({
  path: z.string(),
  label: z.number(),
});

const folderDataSchema = z.array(fileSchema);

export async function fetchFolderData() {
  try {
    const appDataPath = await appDataDir();

    if (!(await exists(appDataPath))) {
      await mkdir(appDataPath, { recursive: true });
      console.log(`Created directory: ${appDataPath}`);
    }

    const filePath = await join(appDataPath, "Organization_Structure.json");
    console.log(filePath);

    // Use Tauri's fs API instead of fetch
    const fileContent = await readTextFile(filePath);

    // Parse the JSON content
    const data = JSON.parse(fileContent);

    // 3. Validate the data structure
    try {
      folderDataSchema.parse(data); // Will throw an error if invalid
    } catch (err) {
      throw new Error("Invalid data structure in JSON", err);
    }

    // 4. Sanitize the data before using it
    const sanitizedData = sanitizeData(data);

    return sanitizedData;
  } catch (error) {
    console.error("Error loading folder data:", error);
  }
}

// 5. Sanitize file paths and names (remove malicious content, unwanted characters, etc.)
function sanitizeData(data) {
  return data.map((item) => ({
    ...item,
    path: item.path.replace(/[<>"|?*]+/g, ""), // Remove unsafe characters from the path
    label: item.label, // Ensure label is safe (not requiring sanitization in this case)
  }));
}


export function transformFolderData(data) {
  if (!data || !Array.isArray(data)) {
    throw new Error("Invalid folder data format");
  }

  // Get unique labels to create folders
  const uniqueLabels = [...new Set(data.map((item) => item.label))];

  // Create folders from unique labels
  const folders = uniqueLabels.map((label) => {
    const labelStr = String(label);
    const folderName =
      label === -1
        ? "Unclustered"
        : label === -2
        ? "Corrupt"
        : `Cluster ${labelStr}`;

    return {
      id: labelStr,
      name: folderName,
      itemCount: data.filter((item) => item.label === label).length,
      color: getFolderColor(labelStr),
    };
  });

  // Create files for each folder
  const folderFiles = {};

  // Initialize empty arrays for each folder
  uniqueLabels.forEach((label) => {
    folderFiles[String(label)] = [];
  });

  // Add files to their respective folders
  data.forEach((item, index) => {
    const labelStr = String(item.label);
    const fileName = extractFileName(item.path);
    const fileType = getFileTypeFromExtension(fileName);

    const file = {
      id: `file-${index}`,
      name: fileName,
      type: fileType,
      folderId: labelStr,
      path: item.path,
    };

    folderFiles[labelStr].push(file);
  });

  return { folders, folderFiles };
}

function extractFileName(path) {
  // Handle both forward and backward slashes
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1];
}


function getFileTypeFromExtension(fileName) {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";

  const typeMap = {
    // Documents
    doc: "docx",
    docx: "docx",
    pdf: "pdf",
    txt: "document",
    rtf: "document",
    odt: "document",

    // Spreadsheets
    xls: "spreadsheet",
    xlsx: "spreadsheet",
    csv: "spreadsheet",
    ods: "spreadsheet",

    // Presentations
    ppt: "presentation",
    pptx: "presentation",
    odp: "presentation",

    // Images
    jpg: "image",
    jpeg: "image",
    png: "image",
    gif: "image",
    bmp: "image",
    svg: "image",
    webp: "image",

    // Audio
    mp3: "audio",
    wav: "audio",
    ogg: "audio",
    flac: "audio",
    m4a: "audio",

    // Video
    mp4: "video",
    avi: "video",
    mov: "video",
    mkv: "video",
    webm: "video",

    // Archives
    zip: "archive",
    rar: "archive",
    tar: "archive",
    gz: "archive",
    "7z": "archive",

    // Code files
    js: "code",
    jsx: "code",
    ts: "code",
    tsx: "code",
    html: "code",
    css: "code",
    py: "code",
    java: "code",
    c: "code",
    cpp: "code",
    php: "code",
    rb: "code",
    go: "code",
    rs: "code",
    swift: "code",

    // Data files
    json: "data",
    xml: "data",
    sql: "data",
    db: "data",
  };

  return typeMap[extension] || "other";
}


function getRandomFileSize() {
  const size = Math.random() * 10 + 0.1; // Between 0.1 and 10.1
  return `${size.toFixed(1)} MB`;
}


function getRandomLastModified(path) {
  //const desktopPath = await desktopDir();
  //const testFilePath = await join(desktopPath, "test.txt"); // Make sure test.txt exists
  // const metadata = await stat(testFilePath);
  //const metadata = await stat("C:/Users/shabt/Desktop/test.txt");
  const options = [
    "1 day ago",
    "2 days ago",
    "3 days ago",
    "1 week ago",
    "2 weeks ago",
    "Yesterday",
    "1 month ago",
  ];

  return options[Math.floor(Math.random() * options.length)];
}


function getFolderColor(id) {
  const colors = [
    "text-blue-500",
    "text-green-500",
    "text-yellow-500",
    "text-purple-500",
    "text-red-500",
    "text-gray-500",
    "text-indigo-500",
    "text-pink-500",
    "text-orange-500",
    "text-teal-500",
  ];

  // Special color for unclustered
  if (id === "-1") {
    return "text-gray-500";
  }

  // Use the folder ID to deterministically select a color
  const colorIndex = Number.parseInt(id, 10) % colors.length;
  return colors[Math.abs(colorIndex)] || "text-primary";
}
*/
