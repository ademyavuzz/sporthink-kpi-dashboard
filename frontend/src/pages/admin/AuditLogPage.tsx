import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRightLeft,
  ChevronDown,
  Eye,
  FileText,
  Globe,
  KeyRound,
  Search,
  Shield,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi } from "@/lib/api/admin";
import { dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import type { AuditLogItem } from "@/types/admin";

type ActionTone = "success" | "warning" | "error" | "info";
type Category = "all" | "auth" | "user" | "role" | "import" | "system";

const CATEGORY_PREFIX: Record<Category, string[]> = {
  all: [],
  auth: ["login", "logout", "password", "token"],
  user: ["user."],
  role: ["role."],
  import: ["import."],
  system: ["settings", "channel_mapping", "permission"],
};

const CATEGORY_ICON: Record<Category, typeof Activity> = {
  all: Activity,
  auth: ShieldCheck,
  user: UserIcon,
  role: Shield,
  import: FileText,
  system: KeyRound,
};

function getActionTone(action: string): ActionTone {
  const a = action.toLowerCase();
  if (
    a.includes("created") ||
    a.includes("invited") ||
    a.includes("activated") ||
    a === "login.success" ||
    a.includes("completed")
  ) {
    return "success";
  }
  if (
    a.includes("deleted") ||
    a.includes("failed") ||
    a.includes("locked") ||
    a.includes("revoked") ||
    a.includes("denied")
  ) {
    return "error";
  }
  if (
    a.includes("updated") ||
    a.includes("changed") ||
    a.includes("reset") ||
    a.includes("deactivated")
  ) {
    return "warning";
  }
  return "info";
}

const TONE_BADGE: Record<ActionTone, string> = {
  success:
    "bg-success-50 text-success-700 ring-1 ring-inset ring-success-100 dark:bg-success-500/10 dark:text-success-500 dark:ring-success-500/20",
  warning:
    "bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-100 dark:bg-warning-500/10 dark:text-warning-500 dark:ring-warning-500/20",
  error:
    "bg-error-50 text-error-700 ring-1 ring-inset ring-error-100 dark:bg-error-500/10 dark:text-error-500 dark:ring-error-500/20",
  info: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20",
};

const TONE_DOT: Record<ActionTone, string> = {
  success: "bg-success-500",
  warning: "bg-warning-500",
  error: "bg-error-500",
  info: "bg-blue-500",
};

function ActionBadge({ action }: { action: string }) {
  const tone = getActionTone(action);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
        TONE_BADGE[tone],
      )}
    >
      <span className={cn("size-1.5 rounded-full", TONE_DOT[tone])} />
      <span className="font-mono">{action}</span>
    </span>
  );
}

function matchesCategory(action: string, cat: Category): boolean {
  if (cat === "all") return true;
  const prefixes = CATEGORY_PREFIX[cat];
  const lower = action.toLowerCase();
  return prefixes.some((p) => lower.startsWith(p) || lower.includes(p));
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

interface ChangeEntry {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  hasOld: boolean;
}

/**
 * Audit log details çoğunlukla `{field: newValue}` şeklinde, ama bazı eventler
 * `{field: {old, new}}` veya `{field: {before, after}}` ile geliyor. Her iki şekli
 * de yakalayıp side-by-side gösterilebilir bir yapıya çeviriyoruz.
 */
function extractChanges(
  details: Record<string, unknown> | null,
): { entries: ChangeEntry[]; anyHasOld: boolean } {
  if (!details || typeof details !== "object") {
    return { entries: [], anyHasOld: false };
  }
  const entries: ChangeEntry[] = [];
  let anyHasOld = false;

  for (const [field, raw] of Object.entries(details)) {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>;
      const hasOldNew =
        ("old" in obj && "new" in obj) || ("before" in obj && "after" in obj);
      if (hasOldNew) {
        const oldValue = "old" in obj ? obj.old : obj.before;
        const newValue = "new" in obj ? obj.new : obj.after;
        entries.push({ field, oldValue, newValue, hasOld: true });
        anyHasOld = true;
        continue;
      }
    }
    entries.push({ field, oldValue: undefined, newValue: raw, hasOld: false });
  }

  return { entries, anyHasOld };
}

export default function AuditLogPage() {
  const { t, i18n } = useTranslation(["admin", "common"]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [selected, setSelected] = useState<AuditLogItem | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const q = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => adminApi.listAuditLogs(200),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const data = q.data ?? [];
    const term = search.trim().toLowerCase();
    return data.filter((row) => {
      if (!matchesCategory(row.action, category)) return false;
      if (!term) return true;
      const haystack = [
        row.action,
        row.user_email ?? "",
        row.resource_type ?? "",
        row.resource_id ?? "",
        row.ip_address ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [q.data, search, category]);

  const totalCount = (q.data ?? []).length;
  const lang = i18n.language;

  return (
    <div className="container mx-auto max-w-[1400px] space-y-5 px-6 py-6">
      {/* Header */}
      <div>
        <h1 className="text-title-sm font-semibold text-foreground">
          {t("admin:audit.title")}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("admin:audit.subtitle")}
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin:audit.search_placeholder")}
            className="h-10 pl-9"
          />
        </div>

        {/* Category chips — compact */}
        <div className="inline-flex h-10 items-center gap-0.5 rounded-lg border border-border bg-surface p-1">
          {(["all", "auth", "user", "role", "import", "system"] as Category[]).map(
            (cat) => {
              const Icon = CATEGORY_ICON[cat];
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "inline-flex h-full items-center gap-1 rounded-md px-2 text-[12px] font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-text-muted hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  {t(`admin:audit.category_${cat}`)}
                </button>
              );
            },
          )}
        </div>

        {/* Result count */}
        <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-xs font-semibold tabular-nums text-text-muted">
          <Activity className="size-3.5 text-text-dim" />
          {filtered.length}
          {filtered.length !== totalCount && (
            <span className="text-text-dim">/ {totalCount}</span>
          )}
        </span>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {q.isPending ? (
            <AuditTableSkeleton />
          ) : filtered.length === 0 ? (
            totalCount === 0 ? (
              <EmptyState
                title={t("admin:audit.empty_title")}
                body={t("admin:audit.empty_body")}
              />
            ) : (
              <EmptyState
                title={t("admin:audit.no_filtered_title")}
                body={t("admin:audit.no_filtered_body")}
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <colgroup>
                  <col className="w-[140px]" />
                  <col className="w-[200px]" />
                  <col />
                  <col className="w-[120px]" />
                  <col className="w-[90px]" />
                  <col className="w-[140px]" />
                  <col className="w-[60px]" />
                </colgroup>
                <TableHeader>
                  <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                    <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:audit.table_date")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:audit.table_action")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:audit.table_user")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:audit.table_table")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:audit.table_object_id")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:audit.table_ip")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                      <span className="sr-only">{t("admin:audit.view_changes")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row, idx) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        "border-b border-border/60 transition-colors",
                        idx % 2 === 1 && "bg-surface-2/40",
                        "hover:bg-primary/[0.04]",
                      )}
                    >
                      <TableCell className="whitespace-nowrap px-4 py-4 text-xs text-text-muted">
                        <div className="font-medium leading-tight text-foreground">
                          {row.created_at
                            ? dayjs
                                .utc(row.created_at)
                                .tz("Europe/Istanbul")
                                .locale(lang)
                                .format("DD MMM YYYY")
                            : "—"}
                        </div>
                        <div className="mt-1 leading-tight text-text-dim">
                          {row.created_at
                            ? dayjs
                                .utc(row.created_at)
                                .tz("Europe/Istanbul")
                                .format("HH:mm:ss")
                            : ""}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-4">
                        <ActionBadge action={row.action} />
                      </TableCell>
                      <TableCell className="truncate px-3 py-4 text-xs">
                        {row.user_email ? (
                          <span
                            className="block truncate font-medium text-foreground"
                            title={row.user_email}
                          >
                            {row.user_email}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 italic text-text-dim">
                            <Globe className="size-3" />
                            {t("admin:audit.detail_no_user")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-4">
                        {row.resource_type ? (
                          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                            {row.resource_type}
                          </span>
                        ) : (
                          <span className="text-text-dim">—</span>
                        )}
                      </TableCell>
                      <TableCell className="truncate px-3 py-4 font-mono text-xs text-text-muted">
                        {row.resource_id ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-4 font-mono text-xs text-text-muted">
                        {row.ip_address ?? "—"}
                      </TableCell>
                      <TableCell className="px-3 py-4 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setShowRaw(false);
                            setSelected(row);
                          }}
                          aria-label={t("admin:audit.view_changes")}
                          title={t("admin:audit.view_changes")}
                          className="size-8 hover:bg-primary/10 hover:text-primary"
                        >
                          <Eye className="size-4" />
                          <span className="sr-only">
                            {t("admin:audit.view_changes")}
                          </span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail drawer */}
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setShowRaw(false);
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-xl"
        >
          {selected && (
            <DetailPanel
              entry={selected}
              showRaw={showRaw}
              onToggleRaw={() => setShowRaw((v) => !v)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailPanel({
  entry,
  showRaw,
  onToggleRaw,
}: {
  entry: AuditLogItem;
  showRaw: boolean;
  onToggleRaw: () => void;
}) {
  const { t, i18n } = useTranslation(["admin", "common"]);
  const lang = i18n.language;
  const { entries, anyHasOld } = useMemo(
    () => extractChanges(entry.details),
    [entry.details],
  );
  const tone = getActionTone(entry.action);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <SheetHeader className="border-b border-border bg-surface-2/50 px-6 pt-6 pb-5">
        <SheetTitle className="text-base font-semibold text-foreground">
          {t("admin:audit.detail_title")}
        </SheetTitle>
        <SheetDescription className="sr-only">
          {entry.action}
        </SheetDescription>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ActionBadge action={entry.action} />
          <span className="text-xs text-text-muted">
            {entry.created_at
              ? dayjs
                  .utc(entry.created_at)
                  .tz("Europe/Istanbul")
                  .locale(lang)
                  .format("DD MMM YYYY · HH:mm:ss")
              : "—"}
          </span>
        </div>
      </SheetHeader>

      {/* Body */}
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {/* Meta grid */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetaCell
            icon={UserIcon}
            label={t("admin:audit.detail_actor")}
            value={entry.user_email ?? t("admin:audit.detail_no_user")}
            mono={!!entry.user_email}
          />
          <MetaCell
            icon={Globe}
            label={t("admin:audit.detail_ip")}
            value={entry.ip_address ?? "—"}
            mono
          />
          <MetaCell
            icon={FileText}
            label={t("admin:audit.detail_resource")}
            value={entry.resource_type ?? "—"}
            mono={!!entry.resource_type}
          />
          <MetaCell
            icon={ArrowRightLeft}
            label={t("admin:audit.detail_object_id")}
            value={entry.resource_id ?? "—"}
            mono={!!entry.resource_id}
          />
        </section>

        {/* Changes */}
        <section className="space-y-3">
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-lg",
                  tone === "success" && "bg-success-500/10 text-success-600",
                  tone === "warning" && "bg-warning-500/10 text-warning-600",
                  tone === "error" && "bg-error-500/10 text-error-600",
                  tone === "info" && "bg-blue-500/10 text-blue-600",
                )}
              >
                <ArrowRightLeft className="size-3.5" />
              </span>
              <h3 className="text-sm font-semibold text-foreground">
                {t("admin:audit.changes_title")}
              </h3>
            </div>
          </header>

          {entries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-surface-2/50 px-4 py-6 text-center text-xs text-text-muted">
              {t("admin:audit.no_changes")}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-surface-2">
                  <tr className="text-[11px] uppercase tracking-wider text-text-dim">
                    <th className="px-3 py-2 text-left font-semibold">
                      {t("admin:audit.changes_field")}
                    </th>
                    {anyHasOld && (
                      <th className="px-3 py-2 text-left font-semibold">
                        {t("admin:audit.changes_old")}
                      </th>
                    )}
                    <th className="px-3 py-2 text-left font-semibold">
                      {anyHasOld
                        ? t("admin:audit.changes_new")
                        : t("admin:audit.changes_value")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((c, idx) => (
                    <tr
                      key={c.field}
                      className={cn(
                        "border-t border-border/60",
                        idx % 2 === 1 && "bg-surface-2/30",
                      )}
                    >
                      <td className="px-3 py-2 align-top font-mono font-medium text-foreground">
                        {c.field}
                      </td>
                      {anyHasOld && (
                        <td className="px-3 py-2 align-top">
                          {c.hasOld ? (
                            <code className="inline-block max-w-[220px] truncate rounded bg-error-500/10 px-1.5 py-0.5 font-mono text-error-700 line-through dark:text-error-400">
                              {formatValue(c.oldValue)}
                            </code>
                          ) : (
                            <span className="text-text-dim">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2 align-top">
                        <code className="inline-block max-w-[220px] truncate rounded bg-success-500/10 px-1.5 py-0.5 font-mono text-success-700 dark:text-success-400">
                          {formatValue(c.newValue)}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Raw JSON */}
        <section className="space-y-2">
          <button
            type="button"
            onClick={onToggleRaw}
            className="inline-flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                !showRaw && "-rotate-90",
              )}
            />
            {showRaw
              ? t("admin:audit.hide_raw")
              : t("admin:audit.show_raw")}
          </button>
          {showRaw && (
            <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-surface-2/50 p-3 font-mono text-[11px] leading-relaxed text-text-muted">
              {JSON.stringify(entry, null, 2)}
            </pre>
          )}
        </section>
      </div>
    </div>
  );
}

function MetaCell({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof UserIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-dim">
        <Icon className="size-3" />
        {label}
      </div>
      <div
        className={cn(
          "mt-1 truncate text-sm font-medium text-foreground",
          mono && "font-mono text-xs",
        )}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="inline-flex size-12 items-center justify-center rounded-full bg-muted text-text-muted">
        <Activity className="size-5" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-md text-xs text-text-muted">{body}</p>
    </div>
  );
}

function AuditTableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-md bg-surface-2/40 px-3 py-3"
        >
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-7 w-24 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

