"use client";

import { z } from "zod";
import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile } from "@tauri-apps/plugin-fs";

const fileSchema = z.object({
  path: z.string(),
  label: z.number(),
});
const clusterNamesSchema = z.record(z.string(), z.string());

const folderDataSchema = z.object({
  cluster_assignments: z.array(fileSchema),
  cluster_names: clusterNamesSchema,
});

export async function fetchFolderData() {
  try {
    const appDataPath = await appDataDir();

    if (!(await exists(appDataPath))) {
      await mkdir(appDataPath, { recursive: true });
    }

    const filePath = await join(appDataPath, "Organization_Structure.json");

    const fileContent = await readTextFile(filePath);
    const data = JSON.parse(fileContent);

    try {
      folderDataSchema.parse(data);
    } catch (err) {
      console.error("Invalid data structure in JSON:", err);
      throw new Error("Invalid data structure in JSON");
    }

    const sanitizedData = sanitizeData(data);

    return sanitizedData;
  } catch (error) {
    console.error("Error loading folder data:", error);
    throw error; // Re-throw the error so callers can handle it
  }
}

function sanitizeData(data) {
  return {
    cluster_assignments: data.cluster_assignments.map((item) => ({
      ...item,
      path: item.path.replace(/[<>"|?*]+/g, ""),
      label: item.label,
    })),
    cluster_names: data.cluster_names,
  };
}

export function transformFolderData(data) {
  if (!data || !data.cluster_assignments || !data.cluster_names) {
    throw new Error("Invalid folder data format");
  }

  const clusterAssignments = data.cluster_assignments;
  const clusterNames = data.cluster_names;

  // Just count items per label first (more efficient than filter)
  const labelCounts = {};
  clusterAssignments.forEach((item) => {
    const label = item.label;
    labelCounts[label] = (labelCounts[label] || 0) + 1;
  });

  const uniqueLabels = Object.keys(labelCounts).map(Number);

  // Create folders structure
  const folders = uniqueLabels.map((label) => {
    const labelStr = String(label);
    const folderName =
      clusterNames[labelStr] ||
      (label === -1
        ? "Unclustered"
        : label === -2
        ? "Corrupt"
        : `Cluster ${labelStr}`);

    return {
      id: labelStr,
      name: folderName,
      itemCount: labelCounts[label],
      color: getFolderColor(labelStr),
    };
  });

  // Initialize empty folderFiles structure
  const folderFiles = {};
  uniqueLabels.forEach((label) => {
    folderFiles[String(label)] = [];
  });

  // Return the raw data too for lazy loading
  return { folders, folderFiles, rawData: data };
}

// Add this new function to load files only when needed:
export function loadFolderFiles(data, folderId, limit = 100, offset = 0) {
  if (!data || !data.cluster_assignments) return [];

  const labelNumber = Number(folderId);

  // Only process files for the selected folder with pagination
  return data.cluster_assignments
    .filter((item) => item.label === labelNumber)
    .slice(offset, offset + limit)
    .map((item, index) => {
      const fileName = extractFileName(item.path);
      const fileType = getFileTypeFromExtension(fileName);

      return {
        id: `file-${folderId}-${offset + index}`,
        name: fileName,
        type: fileType,
        folderId: String(item.label),
        path: item.path,
      };
    });
}

function extractFileName(path) {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1];
}

/**
 * Determine file type based on extension
 * @param fileName Filename with extension
 * @returns File type
 */
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

/**
 * Generate a random file size string
 * @returns Random file size string
 */
//function getRandomFileSize() {
//  const size = Math.random() * 10 + 0.1; // Between 0.1 and 10.1
//  return `${size.toFixed(1)} MB`;
//}
//
///**
// * Generate a random last modified string
// * @returns Random last modified string
// */
//function getRandomLastModified(path) {
//  //const desktopPath = await desktopDir();
//  //const testFilePath = await join(desktopPath, "test.txt"); // Make sure test.txt exists
//  // const metadata = await stat(testFilePath);
//  //const metadata = await stat("C:/Users/shabt/Desktop/test.txt");
//  const options = [
//    "1 day ago",
//    "2 days ago",
//    "3 days ago",
//    "1 week ago",
//    "2 weeks ago",
//    "Yesterday",
//    "1 month ago",
//  ];
//
//  return options[Math.floor(Math.random() * options.length)];
//}

/**
 * Assigns a color to a folder based on its ID
 * @param id Folder ID
 * @returns CSS color class
 */
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
