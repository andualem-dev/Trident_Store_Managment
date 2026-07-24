import { randomBytes } from "crypto";
import fs from "fs/promises";
import path from "path";

import {
  downloadFromSupabaseStorage,
  isSupabaseStorageConfigured,
  uploadToSupabaseStorage,
} from "@/lib/supabase-storage";
import {
  OPTIMIZED_IMAGE_EXT,
  OPTIMIZED_IMAGE_MIME,
  optimizeCustomerImage,
} from "@/lib/image-optimize";
import { uploadPublicUrl } from "@/lib/upload-url";

export { uploadPublicUrl };

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
]);
const MAX_INPUT_BYTES = 10 * 1024 * 1024;

function isAllowedCustomerImage(file: File) {
  if (ALLOWED_MIME.has(file.type)) {
    return true;
  }

  const extension = path.extname(file.name).toLowerCase();
  return ALLOWED_EXTENSIONS.has(extension);
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
      "Photo uploads require Supabase Storage on Vercel. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (legacy service_role JWT), and optionally SUPABASE_STORAGE_BUCKET, then redeploy.",
    );
  }
}

export function isObjectStorageEnabled() {
  return isSupabaseStorageConfigured();
}

export function getUploadRoot() {
  return UPLOAD_ROOT;
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
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("File too large (max 10MB).");
  }
  if (!isAllowedCustomerImage(file)) {
    throw new Error(
      "Only JPEG, PNG, WebP, or HEIC (iPhone) images are allowed.",
    );
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  let optimizedBuffer: Buffer;

  try {
    optimizedBuffer = await optimizeCustomerImage(inputBuffer, kind);
  } catch {
    throw new Error("Could not process image. Try a different photo.");
  }

  if (optimizedBuffer.length === 0) {
    throw new Error("Empty file");
  }

  const suffix = randomBytes(4).toString("hex");
  const relativePath = path.posix.join(
    "customers",
    customerId,
    `${kind}-${suffix}${OPTIMIZED_IMAGE_EXT}`,
  );

  if (isSupabaseStorageConfigured()) {
    await uploadToSupabaseStorage(
      relativePath,
      optimizedBuffer,
      OPTIMIZED_IMAGE_MIME,
    );
    return relativePath;
  }

  requireUploadStorage();

  const absolutePath = path.join(UPLOAD_ROOT, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, optimizedBuffer);

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
      const result = await downloadFromSupabaseStorage(key);
      if (!result) {
        return null;
      }

      return {
        data: result.data,
        contentType: result.contentType || contentTypeForKey(key),
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
