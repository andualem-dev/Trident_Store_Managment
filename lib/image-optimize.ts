import sharp from "sharp";

export const OPTIMIZED_IMAGE_MIME = "image/webp";
export const OPTIMIZED_IMAGE_EXT = ".webp";

const WEBP_QUALITY = 80;
const MAX_DIMENSION = {
  "id-card": 1600,
  profile: 800,
} as const;

export async function optimizeCustomerImage(
  input: Buffer,
  kind: "id-card" | "profile",
): Promise<Buffer> {
  // Accepts JPEG, PNG, WebP, and iPhone HEIC/HEIF; always outputs WebP.
  const maxWidth = MAX_DIMENSION[kind];

  return sharp(input, { failOn: "none" })
    .rotate()
    .resize({
      width: maxWidth,
      height: maxWidth,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toBuffer();
}
