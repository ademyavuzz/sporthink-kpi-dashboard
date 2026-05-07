import {
  Bell,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  Info,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

/** Tile (icon background) — solid soft tint per type. */
const TYPE_TILE: Record<NotificationType, string> = {
  info: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  success:
    "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500",
  warning:
    "bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500",
  error:
    "bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-500",
};

/** Left accent stripe for unread rows. */
const TYPE_ACCENT: Record<NotificationType, string> = {
  info: "bg-blue-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  error: "bg-error-500",
};

type Filter = "all" | "unread" | NotificationType;

export default function NotificationsPage() {
  const { t } = useTranslation(["notifications", "common"]);
  const lang = useLanguageStore((s) => s.lang);

  const notifications = useNotificationsStore((s) => s.notifications);
  const unread = useNotificationsStore(selectUnreadCount);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const remove = useNotificationsStore((s) => s.remove);
  const clear = useNotificationsStore((s) => s.clear);

  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const acc = { info: 0, success: 0, warning: 0, error: 0 };
    for (const n of notifications) acc[n.type] += 1;
    return acc;
  }, [notifications]);

  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((n) => !n.read);
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: t("filter_all"), count: notifications.length },
    { id: "unread", label: t("filter_unread"), count: unread },
    { id: "info", label: t("type_info"), count: counts.info },
    { id: "success", label: t("type_success"), count: counts.success },
    { id: "warning", label: t("type_warning"), count: counts.warning },
    { id: "error", label: t("type_error"), count: counts.error },
  ];

  return (
    <div className="container mx-auto max-w-5xl space-y-5 px-6 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title-sm font-semibold text-foreground">
            {t("page_title")}
          </h1>
          <p className="mt-1 text-sm text-text-muted">{t("page_subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead()}
              className="gap-1.5"
            >
              <CheckCheck className="size-4" />
              {t("mark_all_read")}
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clear()}
              className="gap-1.5 text-text-muted hover:text-destructive"
            >
              <Trash2 className="size-4" />
              {t("clear_all")}
            </Button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => {
          const active = filter === f.id;
          const isUnreadHighlight = f.id === "unread" && f.count > 0 && !active;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : isUnreadHighlight
                    ? "border-primary/30 bg-primary/[0.04] text-primary"
                    : "border-border bg-surface text-text-muted hover:bg-muted hover:text-foreground",
              )}
            >
              {f.label}
              {f.count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums",
                    active
                      ? "bg-primary/20 text-primary"
                      : isUnreadHighlight
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-text-muted",
                  )}
                >
                  {f.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Body */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="rounded-full bg-muted p-4 text-text-muted">
              <Bell className="size-6" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t("empty_title")}
            </p>
            <p className="max-w-md text-xs text-text-muted">
              {t("empty_body")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              lang={lang}
              onMarkRead={() => markRead(n.id)}
              onRemove={() => remove(n.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationRow({
  n,
  lang,
  onMarkRead,
  onRemove,
}: {
  n: Notification;
  lang: string;
  onMarkRead: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation("notifications");
  const Icon = TYPE_ICON[n.type];

  const Inner = (
    <div
      className={cn(
        "group relative flex items-start gap-3 overflow-hidden rounded-xl border bg-card pl-4 pr-3 py-3.5 transition-all",
        n.read
          ? "border-border hover:border-border/80"
          : "border-primary/20 bg-primary/[0.025] shadow-xs",
      )}
    >
      {/* Left accent stripe — unread only */}
      {!n.read && (
        <span
          className={cn(
            "absolute inset-y-0 left-0 w-1",
            TYPE_ACCENT[n.type],
          )}
          aria-hidden
        />
      )}

      {/* Type tile */}
      <span
        className={cn(
          "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
          TYPE_TILE[n.type],
        )}
      >
        <Icon className="size-4" />
      </span>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {n.title}
            {!n.read && (
              <span
                className="inline-block size-1.5 shrink-0 rounded-full bg-primary"
                aria-hidden
              />
            )}
          </h3>
          <time
            className="shrink-0 text-[11px] text-text-dim"
            dateTime={dayjs(n.createdAt).toISOString()}
          >
            {dayjs(n.createdAt).locale(lang).fromNow()}
          </time>
        </div>
        {n.message && (
          <p className="text-sm leading-relaxed text-text-muted">{n.message}</p>
        )}
      </div>

      {/* Actions — appear on hover, always visible on touch */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {!n.read && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMarkRead();
            }}
            aria-label={t("mark_read")}
            title={t("mark_read")}
            className="inline-flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-muted hover:text-foreground transition-colors"
          >
            <CheckCheck className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          aria-label={t("remove")}
          title={t("remove")}
          className="inline-flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-error-500/10 hover:text-error-600 transition-colors"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <li>
      {n.link ? (
        <Link to={n.link} onClick={() => !n.read && onMarkRead()}>
          {Inner}
        </Link>
      ) : (
        Inner
      )}
    </li>
  );
}
