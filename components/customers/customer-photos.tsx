import { uploadPublicUrl } from "@/lib/uploads";

type CustomerPhotosProps = {
  idCardPhotoUrl?: string | null;
  profilePhotoUrl?: string | null;
  size?: "sm" | "md";
};

const sizeClasses = {
  sm: "h-12 w-12",
  md: "h-28 w-28",
};

export function CustomerPhotos({
  idCardPhotoUrl,
  profilePhotoUrl,
  size = "md",
}: CustomerPhotosProps) {
  const photos = [
    { label: "ID card", path: idCardPhotoUrl },
    { label: "Profile", path: profilePhotoUrl },
  ].filter((photo): photo is { label: string; path: string } => Boolean(photo.path));

  if (photos.length === 0) {
    return <span className="text-zinc-400">—</span>;
  }

  const imageClass = sizeClasses[size];

  return (
    <div className="flex flex-wrap gap-3">
      {photos.map((photo) => (
        <figure key={photo.label} className="flex flex-col gap-1">
          <a
            href={uploadPublicUrl(photo.path)}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={uploadPublicUrl(photo.path)}
              alt={`${photo.label} photo`}
              className={`${imageClass} object-cover`}
            />
          </a>
          {size === "md" ? (
            <figcaption className="text-xs text-zinc-600">{photo.label}</figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}
