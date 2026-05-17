/* eslint-disable react-refresh/only-export-components --
   Bu dosya hem `WelcomeToastCard` component'ini hem `showWelcomeToast`
   yardımcısını dışa açar (sonner `toast.custom` pattern'i). HMR'da
   `showWelcomeToast` çağrıldıktan sonra yeniden render edilmez —
   geliştirme akışını bozmaz. */
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/feature/UserAvatar";
import { cn } from "@/lib/utils";
import type { User } from "@/types/auth";

type WelcomeUser = Pick<
  User,
  "first_name" | "last_name" | "email" | "avatar_url"
>;

interface WelcomeToastCardProps {
  user: WelcomeUser;
  title: string;
  subtitle: string;
  closeLabel: string;
  toastId: string | number;
}

function WelcomeToastCard({
  user,
  title,
  subtitle,
  closeLabel,
  toastId,
}: WelcomeToastCardProps) {
  return (
    <div
      className={cn(
        "group relative flex w-[360px] max-w-[88vw] items-center gap-2.5 overflow-hidden rounded-xl",
        "border border-border bg-surface p-3",
        "shadow-[0_20px_50px_-12px_rgba(15,23,42,0.4),0_6px_16px_-6px_rgba(15,23,42,0.2)]",
        "ring-1 ring-primary/10",
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -left-12 -top-12 size-32 rounded-full bg-primary/15 blur-2xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -right-10 size-28 rounded-full bg-brand-blue/15 blur-2xl"
      />

      <div className="relative shrink-0">
        <UserAvatar user={user} size="lg" className="ring-2 ring-primary/25" />
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 inline-flex size-4 items-center justify-center rounded-full bg-brand-green text-white shadow-sm ring-2 ring-surface"
        >
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      </div>

      <div className="relative min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {title}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-text-muted">
          {subtitle}
        </p>
      </div>

      <button
        type="button"
        onClick={() => toast.dismiss(toastId)}
        aria-label={closeLabel}
        className={cn(
          "relative inline-flex size-6 shrink-0 items-center justify-center rounded-md",
          "text-text-muted opacity-60 transition-all hover:bg-muted hover:text-foreground hover:opacity-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        )}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

interface ShowWelcomeToastArgs {
  user: WelcomeUser;
  title: string;
  subtitle: string;
  closeLabel: string;
}

/**
 * Login sonrası tek seferlik branded karşılama bildirimi.
 *
 * Standart `notify()` yerine bu helper, kullanıcının avatarı + selamlama ile
 * marka hissi veren bir kartı `toast.custom()` üzerinden gösterir. Konum
 * `bottom-right` — sayfa içeriğini ve header kontrollerini örtmez.
 */
export function showWelcomeToast({
  user,
  title,
  subtitle,
  closeLabel,
}: ShowWelcomeToastArgs): void {
  toast.custom(
    (id) => (
      <WelcomeToastCard
        user={user}
        title={title}
        subtitle={subtitle}
        closeLabel={closeLabel}
        toastId={id}
      />
    ),
    {
      duration: 4500,
      position: "bottom-right",
    },
  );
}
