/** Client-safe helper — do not import server upload utilities here. */
export function uploadPublicUrl(relativePath: string) {
  return `/api/uploads/${relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}
