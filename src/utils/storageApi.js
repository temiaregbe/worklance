import { listFileRecordsByOwner } from "./platformStore";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

function isNetworkFailure(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("ipfs upload failed") ||
    message.includes("upload failed")
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

async function uploadFile(path, fields, file, fallbackCategory) {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });
  formData.append("file", file);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Upload failed with status ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (!isNetworkFailure(error)) {
      throw error;
    }

    const dataUrl = await fileToDataUrl(file);

    return {
      id: `upload-${Date.now()}`,
      ownerWallet: String(fields.ownerWallet || "").toLowerCase(),
      category: fallbackCategory,
      jobId: fields.jobId ? String(fields.jobId) : "",
      label: fields.label || file.name,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      cid: "",
      gatewayUrl: "",
      dataUrl,
      createdAt: new Date().toISOString()
    };
  }
}

export function uploadProfileCv(ownerWallet, file) {
  return uploadFile("/uploads/profile-cv", { ownerWallet }, file, "profile-cv");
}

export function uploadJobFile({ ownerWallet, jobId, label, file }) {
  return uploadFile("/uploads/job-file", { ownerWallet, jobId, label }, file, "project-file");
}

export async function listUploadsByOwner(ownerWallet) {
  try {
    const response = await fetch(`${API_BASE}/uploads/owner/${ownerWallet}`);
    if (!response.ok) {
      throw new Error("Could not load uploads.");
    }
    return response.json();
  } catch (error) {
    if (!isNetworkFailure(error)) {
      throw error;
    }
    return listFileRecordsByOwner(ownerWallet);
  }
}
