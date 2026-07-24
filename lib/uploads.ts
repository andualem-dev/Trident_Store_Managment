import { randomBytes } from "crypto";
import fs from "fs/promises";
import path from "path";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

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

function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME,
  );
}

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 storage is not configured.");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function getR2Bucket() {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error("R2_BUCKET_NAME is not configured.");
  }
  return bucket;
}

export function isObjectStorageEnabled() {
  return isR2Configured();
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

  if (isR2Configured()) {
    const client = getR2Client();
    await client.send(
      new PutObjectCommand({
        Bucket: getR2Bucket(),
        Key: relativePath,
        Body: buffer,
        ContentType: file.type,
      }),
    );
    return relativePath;
  }

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

  if (isR2Configured()) {
    try {
      const client = getR2Client();
      const object = await client.send(
        new GetObjectCommand({
          Bucket: getR2Bucket(),
          Key: key,
        }),
      );

      if (!object.Body) {
        return null;
      }

      return {
        data: Buffer.from(await object.Body.transformToByteArray()),
        contentType: object.ContentType ?? contentTypeForKey(key),
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
  if (!key || isR2Configured()) {
    return null;
  }

  const absolute = path.join(UPLOAD_ROOT, key);
  if (!absolute.startsWith(UPLOAD_ROOT)) {
    return null;
  }
  return absolute;
}
