import { uploadPublicUrl } from "@/lib/upload-url";

type CustomerAvatarProps = {
  name: string;
  profilePhotoUrl?: string | null;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-10 w-10 text-xs",
  md: "h-16 w-16 text-base",
  lg: "h-24 w-24 text-xl",
};

function initialsForName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function CustomerAvatar({
  name,
  profilePhotoUrl,
  size = "md",
}: CustomerAvatarProps) {
  const className = `${sizeClasses[size]} shrink-0 rounded-full`;

  if (profilePhotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={uploadPublicUrl(profilePhotoUrl)}
        alt={`${name} profile`}
        className={`${className} border border-zinc-200 object-cover bg-zinc-100`}
      />
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center border border-zinc-200 bg-zinc-200 font-semibold text-zinc-700`}
      aria-hidden
    >
      {initialsForName(name) || "?"}
    </div>
  );
}
