import {
  Bell,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { useLanguageStore } from "@/stores/useLanguageStore";
import {
  selectUnreadCount,
  useNotificationsStore,
} from "@/stores/useNotificationsStore";
import type { Notification, NotificationType } from "@/types/notifications";

const TYPE_ICON: Record<NotificationType, typeof Info> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
};

const TYPE_TONE: Record<NotificationType, string> = {
  info: "text-brand-blue bg-brand-blue/10",
  success: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  warning: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  error: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
};

const PREVIEW_LIMIT = 6;

export function NotificationBell() {
  const { t } = useTranslation(["common", "notifications"]);
  const lang = useLanguageStore((s) => s.lang);
  const navigate = useNavigate();

  const notifications = useNotificationsStore((s) => s.notifications);
  const unread = useNotificationsStore(selectUnreadCount);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);

  const preview = notifications.slice(0, PREVIEW_LIMIT);
  const hasMore = notifications.length > PREVIEW_LIMIT;

  const handleItemClick = (n: Notification) => {
    if (!n.read) markRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("notifications:title")}
          className="relative text-text-muted hover:text-foreground"
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground ring-2 ring-surface">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold">{t("notifications:title")}</h3>
            {unread > 0 && (
              <span className="text-[11px] font-medium text-text-muted">
                {t("notifications:unread_count", { count: unread })}
              </span>
            )}
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markAllRead()}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-text-muted hover:bg-muted hover:text-foreground transition-colors"
            >
              <CheckCheck className="size-3.5" />
              {t("notifications:mark_all_read")}
            </button>
          )}
        </div>

        {preview.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <div className="rounded-full bg-muted p-3 text-text-muted">
              <Bell className="size-5" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t("notifications:empty_title")}
            </p>
            <p className="text-xs text-text-muted">
              {t("notifications:empty_body")}
            </p>
          </div>
        ) : (
          <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {preview.map((n) => {
              const Icon = TYPE_ICON[n.type];
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(n)}
                    className={cn(
                      "flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted",
                      !n.read && "bg-primary/[0.04]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full",
                        TYPE_TONE[n.type],
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold text-foreground line-clamp-1">
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      {n.message && (
                        <p className="text-xs text-text-muted line-clamp-2">
                          {n.message}
                        </p>
                      )}
                      <p className="text-[10px] uppercase tracking-wide text-text-dim">
                        {dayjs(n.createdAt).locale(lang).fromNow()}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-border p-1.5">
          <Link
            to="/notifications"
            className="block rounded-md px-2.5 py-2 text-center text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            {hasMore
              ? t("notifications:view_all_more", {
                  count: notifications.length,
                })
              : t("notifications:view_all")}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
