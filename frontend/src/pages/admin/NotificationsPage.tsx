import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Pagination } from "@/components/ui/pagination";
import { notificationsApi } from "@/lib/api/notifications";
import { dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLanguageStore } from "@/stores/useLanguageStore";
import type { Notification, NotificationType } from "@/types/notifications";

const TYPE_ICON: Record<NotificationType, typeof Info> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
};

const TYPE_TILE: Record<NotificationType, string> = {
  info: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  success:
    "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500",
  warning:
    "bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500",
  error:
    "bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-500",
};

const TYPE_ACCENT: Record<NotificationType, string> = {
  info: "bg-blue-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  error: "bg-error-500",
};

type Filter = "all" | "unread" | NotificationType;
const PAGE_SIZE = 25;
const POLL_MS = 30_000;

export default function NotificationsPage() {
  const { t } = useTranslation(["notifications", "common"]);
  const lang = useLanguageStore((s) => s.lang);
  const qc = useQueryClient();
  const isAuthed = useAuthStore((s) => s.user !== null);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);

  // Server-side pagination + 30sn polling
  const listQ = useQuery({
    queryKey: ["notifications", "list", page, PAGE_SIZE],
    queryFn: () => notificationsApi.list(page, PAGE_SIZE),
    enabled: isAuthed,
    refetchInterval: POLL_MS,
    staleTime: POLL_MS / 2,
  });
  const unreadQ = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notificationsApi.unreadCount(),
    enabled: isAuthed,
    refetchInterval: POLL_MS,
    staleTime: POLL_MS / 2,
  });

  const markReadMut = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  const markAllReadMut = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  const removeMut = useMutation({
    mutationFn: (id: number) => notificationsApi.deleteOne(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const items: Notification[] = useMemo(
    () => listQ.data?.items ?? [],
    [listQ.data],
  );
  const total = listQ.data?.total ?? 0;
  const unread = unreadQ.data ?? 0;

  // Filtre + sayım — server-side full count olmadığı için client-side
  // mevcut sayfa üzerinden hesaplar. Tüm DB üzerindeki tipsel sayım UI
  // chip'lerinde "mevcut sayfada N" anlamında — uzun vadede /unread-count
  // gibi /type-counts endpoint'i eklenebilir (backlog).
  const counts = useMemo(() => {
    const acc = { info: 0, success: 0, warning: 0, error: 0 };
    for (const n of items) acc[n.type] += 1;
    return acc;
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unread") return items.filter((n) => !n.is_read);
    return items.filter((n) => n.type === filter);
  }, [items, filter]);

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: t("filter_all"), count: total },
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
              onClick={() => markAllReadMut.mutate()}
              disabled={markAllReadMut.isPending}
              className="gap-1.5"
            >
              <CheckCheck className="size-4" />
              {t("mark_all_read")}
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
              onMarkRead={() => markReadMut.mutate(n.id)}
              onRemove={() => removeMut.mutate(n.id)}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />
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
        n.is_read
          ? "border-border hover:border-border/80"
          : "border-primary/20 bg-primary/[0.025] shadow-xs",
      )}
    >
      {!n.is_read && (
        <span
          className={cn("absolute inset-y-0 left-0 w-1", TYPE_ACCENT[n.type])}
          aria-hidden
        />
      )}

      <span
        className={cn(
          "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
          TYPE_TILE[n.type],
        )}
      >
        <Icon className="size-4" />
      </span>

      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {n.title}
            {!n.is_read && (
              <span
                className="inline-block size-1.5 shrink-0 rounded-full bg-primary"
                aria-hidden
              />
            )}
          </h3>
          <time
            className="shrink-0 text-[11px] text-text-dim"
            dateTime={n.created_at}
          >
            {dayjs.utc(n.created_at).tz("Europe/Istanbul").locale(lang).fromNow()}
          </time>
        </div>
        {n.message && (
          <p className="text-sm leading-relaxed text-text-muted">{n.message}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {!n.is_read && (
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
        <Link to={n.link} onClick={() => !n.is_read && onMarkRead()}>
          {Inner}
        </Link>
      ) : (
        Inner
      )}
    </li>
  );
}
