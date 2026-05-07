import { avatarSrc, initialsFor } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import type { User } from "@/types/auth";

interface UserAvatarProps {
  user:
    | (Pick<User, "first_name" | "last_name" | "email"> & {
        full_name?: string | null;
        avatar_url?: string | null;
      })
    | null
    | undefined;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_CLASS = {
  sm: "size-7 text-[11px]",
  md: "size-8 text-[12px]",
  lg: "size-10 text-[13px]",
  xl: "size-20 text-[26px]",
} as const;

/**
 * Kullanıcı avatarı — `avatar_url` varsa görsel, yoksa baş harf fallback.
 *
 * Backend göreli path döner (`/uploads/avatars/<id>.webp?v=ts`); `avatarSrc`
 * helper'ı API origin ile birleştirir. Cache busting query string'i resmin
 * güncellendikten sonra yenilenmesini sağlar.
 */
export function UserAvatar({ user, size = "md", className }: UserAvatarProps) {
  const src = avatarSrc(user?.avatar_url);
  const sizeClass = SIZE_CLASS[size];

  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        className={cn(
          "shrink-0 rounded-full object-cover ring-1 ring-border bg-surface-2",
          sizeClass,
          className,
        )}
      />
    );
  }

  const initials = user ? initialsFor(user) : "?";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground",
        sizeClass,
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}
