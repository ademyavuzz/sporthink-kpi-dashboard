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

import { PageHeader } from "@/components/layout/PageHeader";
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

const TYPE_TONE: Record<NotificationType, string> = {
  info: "text-brand-blue bg-brand-blue/10",
  success: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  warning: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  error: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
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

  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((n) => !n.read);
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const filters: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: t("filter_all"), count: notifications.length },
    { id: "unread", label: t("filter_unread"), count: unread },
    { id: "info", label: t("type_info") },
    { id: "success", label: t("type_success") },
    { id: "warning", label: t("type_warning") },
    { id: "error", label: t("type_error") },
  ];

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-6 py-6">
      <PageHeader
        title={t("page_title")}
        subtitle={t("page_subtitle")}
        actions={
          <div className="flex items-center gap-2">
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
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface text-text-muted hover:bg-muted",
            )}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[10px] font-semibold",
                  filter === f.id
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-text-muted",
                )}
              >
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

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
        "flex items-start gap-3 rounded-xl border bg-surface p-4 transition-all",
        n.read
          ? "border-border"
          : "border-primary/20 bg-primary/[0.03] shadow-xs",
      )}
    >
      <span
        className={cn(
          "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full",
          TYPE_TONE[n.type],
        )}
      >
        <Icon className="size-4" />
      </span>

      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">{n.title}</h3>
          <time className="shrink-0 text-[11px] uppercase tracking-wide text-text-dim">
            {dayjs(n.createdAt).locale(lang).fromNow()}
          </time>
        </div>
        {n.message && (
          <p className="text-sm text-text-muted leading-relaxed">{n.message}</p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {!n.read && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMarkRead();
            }}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-text-muted hover:bg-muted hover:text-foreground transition-colors"
          >
            {t("mark_read")}
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
          className="rounded-md p-1 text-text-muted hover:bg-muted hover:text-destructive transition-colors"
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
