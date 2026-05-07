import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  History,
  Loader2,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import { ApiError } from "@/lib/api/client";
import { importsApi } from "@/lib/api/imports";
import { dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import type { ImportListItem } from "@/types/imports";

import { deriveImportOutcome, formatDuration, type ImportOutcome } from "./lib";

type OutcomeFilter =
  | "all"
  | "completed"
  | "partial"
  | "duplicate"
  | "with_errors"
  | "failed"
  | "running";

type Tone = "success" | "warning" | "error" | "info" | "neutral";

function outcomeToTone(o: ImportOutcome): Tone {
  switch (o) {
    case "completed":
      return "success";
    case "duplicate":
    case "partial":
    case "with_errors":
    case "empty":
      return "warning";
    case "failed":
    case "cancelled":
      return "error";
    case "running":
      return "info";
  }
}

function outcomeToIcon(o: ImportOutcome) {
  if (o === "completed") return CheckCircle2;
  if (o === "failed" || o === "cancelled") return XCircle;
  if (o === "running") return Loader2;
  // duplicate / partial / with_errors / empty — bilgilendirici uyarı
  return AlertCircle;
}

const TONE_PILL: Record<Tone, string> = {
  success:
    "bg-success-50 text-success-700 ring-1 ring-inset ring-success-100 dark:bg-success-500/10 dark:text-success-500 dark:ring-success-500/20",
  warning:
    "bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-100 dark:bg-warning-500/10 dark:text-warning-500 dark:ring-warning-500/20",
  error:
    "bg-error-50 text-error-700 ring-1 ring-inset ring-error-100 dark:bg-error-500/10 dark:text-error-500 dark:ring-error-500/20",
  info: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20",
  neutral: "bg-muted text-text-muted",
};

function matchesOutcomeFilter(
  outcome: ImportOutcome,
  filter: OutcomeFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "completed") return outcome === "completed";
  if (filter === "partial") return outcome === "partial";
  if (filter === "duplicate")
    return outcome === "duplicate" || outcome === "empty";
  if (filter === "with_errors") return outcome === "with_errors";
  if (filter === "failed") return outcome === "failed" || outcome === "cancelled";
  if (filter === "running") return outcome === "running";
  return true;
}

export default function ImportHistoryPage() {
  const { t, i18n } = useTranslation(["imports", "common"]);
  const queryClient = useQueryClient();
  const { has } = usePermissions();
  const canCreate = has("imports.create");
  const canDelete = has("imports.delete");
  const [pendingDelete, setPendingDelete] = useState<ImportListItem | null>(
    null,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");

  const listQuery = useQuery({
    queryKey: ["imports", "list"],
    queryFn: () => importsApi.list(),
    staleTime: 30_000,
  });

  // Friendly data type label'ı için meta'yı çekiyoruz (importsApi cache'liyor).
  const dataTypesQuery = useQuery({
    queryKey: ["imports", "data-types"],
    queryFn: () => importsApi.getDataTypes(),
    staleTime: 30 * 60_000,
  });

  // Backend `label_tr` (sabit Türkçe) yerine i18n key kullan; backend label'ı
  // yalnızca eksik key durumunda fallback olarak kalsın.
  const dataTypeLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of dataTypesQuery.data ?? []) {
      map.set(
        d.data_type,
        t(`imports:data_types.${d.data_type}`, { defaultValue: d.label_tr }),
      );
    }
    return map;
  }, [dataTypesQuery.data, t, i18n.language]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => importsApi.deleteById(id),
    onSuccess: () => {
      setPendingDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["imports", "list"] });
    },
    onError: (err) => {
      setErrorMsg(
        err instanceof ApiError ? err.message : t("imports:errors.delete_failed"),
      );
    },
  });

  const data = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const total = data.length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.filter((it) => {
      const outcome = deriveImportOutcome(it);
      if (!matchesOutcomeFilter(outcome, outcomeFilter)) return false;
      if (!term) return true;
      const haystack = [
        it.file_name,
        it.data_type,
        dataTypeLabel.get(it.data_type) ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [data, search, outcomeFilter, dataTypeLabel]);

  const lang = i18n.language;

  return (
    <div className="container mx-auto max-w-[1400px] space-y-5 px-6 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title-sm font-semibold text-foreground">
            {t("imports:history.title")}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {t("imports:history.subtitle")}
          </p>
        </div>
        {canCreate && (
          <Button asChild className="gap-1.5">
            <Link to="/import">
              <Upload className="size-4" />
              {t("imports:tab_new")}
            </Link>
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("imports:history.search_placeholder")}
            className="h-10 pl-9"
          />
        </div>

        <div className="inline-flex h-10 items-center gap-0.5 rounded-lg border border-border bg-surface p-1">
          {(
            [
              "all",
              "completed",
              "partial",
              "duplicate",
              "with_errors",
              "running",
              "failed",
            ] as OutcomeFilter[]
          ).map((s) => {
            const active = outcomeFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setOutcomeFilter(s)}
                className={cn(
                  "inline-flex h-full items-center rounded-md px-2.5 text-[12px] font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-text-muted hover:bg-muted hover:text-foreground",
                )}
              >
                {t(`imports:history.filter_outcome_${s}`)}
              </button>
            );
          })}
        </div>

        <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-xs font-semibold tabular-nums text-text-muted">
          <History className="size-3.5 text-text-dim" />
          {filtered.length}
          {filtered.length !== total && (
            <span className="text-text-dim">/ {total}</span>
          )}
        </span>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {listQuery.isError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {t("imports:errors.history_load_failed")}
          </AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {listQuery.isPending ? (
            <TableSkeleton />
          ) : filtered.length === 0 ? (
            total === 0 ? (
              <EmptyState
                icon={History}
                title={t("imports:history.empty_title")}
                body={t("imports:history.empty_body")}
                actionLabel={canCreate ? t("imports:history.empty_cta") : undefined}
                actionTo={canCreate ? "/import" : undefined}
              />
            ) : (
              <EmptyState
                icon={Search}
                title={t("imports:history.no_filtered_title")}
                body={t("imports:history.no_filtered_body")}
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <colgroup>
                  <col className="w-[60px]" />
                  <col className="w-[180px]" />
                  <col />
                  <col className="w-[150px]" />
                  <col className="w-[170px]" />
                  <col className="w-[80px]" />
                  <col className="w-[140px]" />
                  <col className="w-[60px]" />
                </colgroup>
                <TableHeader>
                  <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                    <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("imports:history.col_id")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("imports:history.col_data_type")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("imports:history.col_file_name")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("imports:history.col_status")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("imports:history.col_rows")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                      {t("imports:history.col_duration")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("imports:history.col_created_at")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                      <span className="sr-only">
                        {t("imports:history.col_actions")}
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((it, idx) => {
                    const outcome = deriveImportOutcome(it);
                    const tone = outcomeToTone(outcome);
                    const OutcomeIcon = outcomeToIcon(outcome);
                    const friendlyType =
                      dataTypeLabel.get(it.data_type) ?? it.data_type;
                    const isRunning = outcome === "running";
                    const hint = t(`imports:history.outcome_hint.${outcome}`, {
                      defaultValue: "",
                    });
                    return (
                      <TableRow
                        key={it.id}
                        className={cn(
                          "border-b border-border/60 transition-colors",
                          idx % 2 === 1 && "bg-surface-2/40",
                          "hover:bg-primary/[0.04]",
                        )}
                      >
                        <TableCell className="px-4 py-3.5 font-mono text-xs text-text-muted">
                          #{it.id}
                        </TableCell>
                        <TableCell className="px-3 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Database className="size-3.5" />
                            </span>
                            <div className="min-w-0 leading-tight">
                              <div
                                className="truncate text-sm font-semibold text-foreground"
                                title={friendlyType}
                              >
                                {friendlyType}
                              </div>
                              <div className="truncate font-mono text-[11px] text-text-dim">
                                {it.data_type}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-3.5 text-xs">
                          <span
                            className="block truncate font-medium text-foreground"
                            title={it.file_name}
                          >
                            {it.file_name}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-3.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
                              TONE_PILL[tone],
                            )}
                            title={hint || undefined}
                          >
                            <OutcomeIcon
                              className={cn(
                                "size-3",
                                isRunning && "animate-spin",
                              )}
                            />
                            {t(`imports:history.outcome.${outcome}`)}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-3.5 text-xs">
                          <RowsSummary item={it} />
                        </TableCell>
                        <TableCell className="px-3 py-3.5 text-right">
                          <span className="inline-flex items-center gap-1 text-xs text-text-muted tabular-nums">
                            <Clock className="size-3 text-text-dim" />
                            {formatDuration(it.duration_seconds)}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-3 py-3.5 text-xs text-text-muted">
                          <div className="font-medium leading-tight text-foreground">
                            {dayjs
                              .utc(it.created_at)
                              .tz("Europe/Istanbul")
                              .locale(lang)
                              .format("DD MMM YYYY")}
                          </div>
                          <div className="mt-1 leading-tight text-text-dim">
                            {dayjs
                              .utc(it.created_at)
                              .tz("Europe/Istanbul")
                              .format("HH:mm")}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-3.5 text-right">
                          {canDelete ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setPendingDelete(it)}
                              aria-label={t("imports:history.btn_delete")}
                              title={t("imports:history.btn_delete")}
                              className="size-8 text-text-muted hover:bg-error-500/10 hover:text-error-600"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-error-500/10 text-error-600">
                <Trash2 className="size-4" />
              </span>
              <span className="text-base font-semibold text-foreground">
                {t("imports:history.delete_confirm_title")}
              </span>
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-text-muted">
              {t("imports:history.delete_confirm_body", {
                rows:
                  pendingDelete?.inserted_rows?.toLocaleString("tr-TR") ?? "0",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleteMutation.isPending}
            >
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                pendingDelete && deleteMutation.mutate(pendingDelete.id)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-1 size-4 animate-spin" />
              )}
              {t("imports:history.delete_confirm_yes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RowsSummary({ item }: { item: ImportListItem }) {
  const { t } = useTranslation("imports");
  const inserted = item.inserted_rows;
  const invalid = item.invalid_rows ?? 0;
  if (inserted === null && invalid === 0) {
    return <span className="text-text-dim">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5 text-[11px]">
      <span className="inline-flex items-center gap-1 font-semibold text-foreground tabular-nums">
        <CheckCircle2 className="size-3 text-success-600 dark:text-success-500" />
        {inserted?.toLocaleString("tr-TR") ?? 0}{" "}
        <span className="font-normal text-text-muted">
          {t("history.rows_inserted")}
        </span>
      </span>
      {invalid > 0 && (
        <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-error-600 dark:text-error-500">
          <XCircle className="size-3" />
          {invalid.toLocaleString("tr-TR")}{" "}
          <span className="font-normal opacity-80">
            {t("history.rows_invalid")}
          </span>
        </span>
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  actionTo,
}: {
  icon: typeof History;
  title: string;
  body: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="inline-flex size-12 items-center justify-center rounded-full bg-muted text-text-muted">
        <Icon className="size-5" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-md text-xs text-text-muted">{body}</p>
      {actionLabel && actionTo && (
        <Button asChild className="mt-1 gap-1.5">
          <Link to={actionTo}>
            <Upload className="size-4" />
            {actionLabel}
          </Link>
        </Button>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-md bg-surface-2/40 px-3 py-3"
        >
          <div className="h-4 w-12 animate-pulse rounded bg-muted" />
          <div className="size-7 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
          <div className="ml-auto h-7 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
