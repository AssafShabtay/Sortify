"use client";

import { z } from "zod";
import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile } from "@tauri-apps/plugin-fs";

const fileSchema = z.object({
  path: z.string(),
  cluster_name: z.string(),
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

    const fileContent = await readTextFile(filePath);

    const data = JSON.parse(fileContent);

    try {
      folderDataSchema.parse(data);
    } catch (err) {
      throw new Error("Invalid data structure in JSON", err);
    }

    const sanitizedData = sanitizeData(data);

    return sanitizedData;
  } catch (error) {
    console.error("Error loading folder data:", error);
  }
}

function sanitizeData(data) {
  return data.map((item) => ({
    ...item,
    path: item.path.replace(/[<>"|?*]+/g, ""),
    cluster_name: item.cluster_name.replace(/[<>"|?*]+/g, ""),
  }));
}

export function transformFolderData(data) {
  if (!data || !Array.isArray(data)) {
    throw new Error("Invalid folder data format");
  }

  const uniqueClusterNames = [
    ...new Set(data.map((item) => item.cluster_name)),
  ];

  const folders = uniqueClusterNames.map((clusterName, index) => {
    const folderId = `cluster-${index}`;

    return {
      id: folderId,
      name: clusterName,
      itemCount: data.filter((item) => item.cluster_name === clusterName)
        .length,
      color: getFolderColor(clusterName, index),
    };
  });

  const clusterNameToFolderId = {};
  folders.forEach((folder) => {
    clusterNameToFolderId[folder.name] = folder.id;
  });

  const folderFiles = {};

  folders.forEach((folder) => {
    folderFiles[folder.id] = [];
  });

  data.forEach((item, index) => {
    const folderId = clusterNameToFolderId[item.cluster_name];
    const fileName = extractFileName(item.path);
    const fileType = getFileTypeFromExtension(fileName);

    const file = {
      id: `file-${index}`,
      name: fileName,
      type: fileType,
      folderId: folderId,
      path: item.path,
    };

    folderFiles[folderId].push(file);
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
