import { randomBytes } from "crypto";
import fs from "fs/promises";
import path from "path";

import {
  getSupabaseAdminClient,
  getSupabaseStorageBucket,
  isSupabaseStorageConfigured,
} from "@/lib/supabase-storage";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

function extensionForMime(mime: string): string | null {
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return null;
  }
}

function isVercelRuntime() {
  return process.env.VERCEL === "1";
}

function requireUploadStorage() {
  if (isSupabaseStorageConfigured()) {
    return;
  }

  if (isVercelRuntime()) {
    throw new Error(
      "Photo uploads require Supabase Storage on Vercel. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and optionally SUPABASE_STORAGE_BUCKET, then redeploy.",
    );
  }
}

export function isObjectStorageEnabled() {
  return isSupabaseStorageConfigured();
}

export function getUploadRoot() {
  return UPLOAD_ROOT;
}

export function uploadPublicUrl(relativePath: string) {
  return `/api/uploads/${relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

export function normalizeUploadKey(relativePath: string): string | null {
  const normalized = path.posix
    .normalize(relativePath.replace(/\\/g, "/"))
    .replace(/^(\.\.(\/|$))+/, "");

  if (
    !normalized ||
    normalized.startsWith("..") ||
    path.posix.isAbsolute(normalized)
  ) {
    return null;
  }

  return normalized;
}

export async function saveCustomerImage(
  customerId: string,
  kind: "id-card" | "profile",
  file: File,
): Promise<string> {
  if (!file || file.size === 0) {
    throw new Error("Empty file");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File too large (max 5MB).");
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Only JPEG, PNG, or WebP images are allowed.");
  }

  const ext = extensionForMime(file.type);
  if (!ext) {
    throw new Error("Unsupported image type.");
  }

  const suffix = randomBytes(4).toString("hex");
  const relativePath = path.posix.join(
    "customers",
    customerId,
    `${kind}-${suffix}${ext}`,
  );
  const buffer = Buffer.from(await file.arrayBuffer());

  if (isSupabaseStorageConfigured()) {
    const supabase = getSupabaseAdminClient();
    const bucket = getSupabaseStorageBucket();
    const { error } = await supabase.storage.from(bucket).upload(relativePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      throw new Error(error.message || "Photo upload failed.");
    }

    return relativePath;
  }

  requireUploadStorage();

  const absolutePath = path.join(UPLOAD_ROOT, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return relativePath;
}

export async function readUpload(
  relativePath: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  const key = normalizeUploadKey(relativePath);
  if (!key) {
    return null;
  }

  if (isSupabaseStorageConfigured()) {
    try {
      const supabase = getSupabaseAdminClient();
      const bucket = getSupabaseStorageBucket();
      const { data, error } = await supabase.storage.from(bucket).download(key);

      if (error || !data) {
        return null;
      }

      return {
        data: Buffer.from(await data.arrayBuffer()),
        contentType: data.type || contentTypeForKey(key),
      };
    } catch {
      return null;
    }
  }

  const absolutePath = path.join(UPLOAD_ROOT, key);
  if (!absolutePath.startsWith(UPLOAD_ROOT)) {
    return null;
  }

  try {
    const data = await fs.readFile(absolutePath);
    return {
      data,
      contentType: contentTypeForKey(key),
    };
  } catch {
    return null;
  }
}

function contentTypeForKey(key: string) {
  const ext = path.extname(key).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

/** @deprecated Use normalizeUploadKey / readUpload instead. */
export function resolveUploadPath(relativePath: string): string | null {
  const key = normalizeUploadKey(relativePath);
  if (!key || isSupabaseStorageConfigured()) {
    return null;
  }

  const absolute = path.join(UPLOAD_ROOT, key);
  if (!absolute.startsWith(UPLOAD_ROOT)) {
    return null;
  }
  return absolute;
}
