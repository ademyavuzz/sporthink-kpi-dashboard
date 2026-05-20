import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  History,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/feature/ChartCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api/client";
import { reportsApi } from "@/lib/api/reports";
import { dayjs } from "@/lib/dayjs";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type {
  ReportLanguage,
  ReportListItem,
  ReportSectionKey,
  ReportStatus,
} from "@/types/reports";

const ALL_SECTIONS: ReportSectionKey[] = [
  "overview",
  "ga4",
  "ads",
  "ecommerce",
  "funnel",
  "top",
];

type PresetId = "last_7" | "last_30" | "this_month" | "last_month";

function presetRange(preset: PresetId): { from: string; to: string } {
  const today = dayjs().tz("Europe/Istanbul");
  switch (preset) {
    case "last_7":
      return {
        from: today.subtract(6, "day").format("YYYY-MM-DD"),
        to: today.format("YYYY-MM-DD"),
      };
    case "last_30":
      return {
        from: today.subtract(29, "day").format("YYYY-MM-DD"),
        to: today.format("YYYY-MM-DD"),
      };
    case "this_month":
      return {
        from: today.startOf("month").format("YYYY-MM-DD"),
        to: today.format("YYYY-MM-DD"),
      };
    case "last_month": {
      const lm = today.subtract(1, "month");
      return {
        from: lm.startOf("month").format("YYYY-MM-DD"),
        to: lm.endOf("month").format("YYYY-MM-DD"),
      };
    }
  }
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const STATUS_TONE: Record<
  ReportStatus,
  { className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  pending: {
    className:
      "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20",
    Icon: Clock,
  },
  generating: {
    className:
      "bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-100 dark:bg-warning-500/10 dark:text-warning-500 dark:ring-warning-500/20",
    Icon: Loader2,
  },
  completed: {
    className:
      "bg-success-50 text-success-700 ring-1 ring-inset ring-success-100 dark:bg-success-500/10 dark:text-success-500 dark:ring-success-500/20",
    Icon: CheckCircle2,
  },
  failed: {
    className:
      "bg-error-50 text-error-700 ring-1 ring-inset ring-error-100 dark:bg-error-500/10 dark:text-error-500 dark:ring-error-500/20",
    Icon: XCircle,
  },
};

export default function ReportsPage() {
  const { t, i18n } = useTranslation(["reports", "common"]);
  const queryClient = useQueryClient();
  const isTr = i18n.language === "tr";

  const today = dayjs().tz("Europe/Istanbul").format("YYYY-MM-DD");
  const sevenDaysAgo = dayjs()
    .tz("Europe/Istanbul")
    .subtract(6, "day")
    .format("YYYY-MM-DD");

  const [name, setName] = useState("");
  const [dateFrom, setDateFrom] = useState(sevenDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [language, setLanguage] = useState<ReportLanguage>(
    isTr ? "tr" : "en",
  );
  const [selectedSections, setSelectedSections] =
    useState<ReportSectionKey[]>(ALL_SECTIONS);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ReportListItem | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const sectionsMetaQuery = useQuery({
    queryKey: ["reports", "sections"],
    queryFn: () => reportsApi.getSections(),
    staleTime: 30 * 60_000,
  });

  const listQuery = useQuery({
    queryKey: ["reports", "list"],
    queryFn: () => reportsApi.list(),
    // poll every 3s while any report is pending/generating
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return false;
      const hasActive = data.some(
        (r) => r.status === "pending" || r.status === "generating",
      );
      return hasActive ? 3000 : false;
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      reportsApi.create({
        name: name.trim() || undefined,
        date_from: dateFrom,
        date_to: dateTo,
        sections: selectedSections,
        language,
      }),
    onSuccess: () => {
      notify({
        type: "info",
        title: t("reports:create.success_toast"),
      });
      void queryClient.invalidateQueries({ queryKey: ["reports", "list"] });
    },
    onError: (err) => {
      setValidationError(
        err instanceof ApiError ? err.message : t("reports:create.create_failed"),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => reportsApi.deleteById(id),
    onSuccess: () => {
      setPendingDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["reports", "list"] });
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError ? err.message : t("reports:history.delete_failed"),
      );
    },
  });

  const sectionLabels = useMemo(() => {
    const map = new Map<ReportSectionKey, { label: string; description: string }>();
    for (const meta of sectionsMetaQuery.data ?? []) {
      map.set(meta.key, {
        label: isTr ? meta.label_tr : meta.label_en,
        description: isTr ? meta.description_tr : meta.description_en,
      });
    }
    // Fallback while meta is loading — uses i18n labels
    for (const k of ALL_SECTIONS) {
      if (!map.has(k)) {
        map.set(k, { label: t(`reports:section.${k}`), description: "" });
      }
    }
    return map;
  }, [sectionsMetaQuery.data, isTr, t]);

  const handleToggleSection = (key: ReportSectionKey, checked: boolean) => {
    setValidationError(null);
    setSelectedSections((prev) =>
      checked ? [...new Set([...prev, key])] : prev.filter((s) => s !== key),
    );
  };

  const handlePreset = (p: PresetId) => {
    const r = presetRange(p);
    setDateFrom(r.from);
    setDateTo(r.to);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (selectedSections.length === 0) {
      setValidationError(t("reports:create.validation_no_section"));
      return;
    }
    if (dateFrom > dateTo) {
      setValidationError(t("reports:create.validation_invalid_range"));
      return;
    }
    createMutation.mutate();
  };

  const handleDownload = async (report: ReportListItem) => {
    setActionError(null);
    try {
      const blob = await reportsApi.download(report.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.name.replace(/[^a-zA-Z0-9_-]+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : t("reports:history.download_failed"),
      );
    }
  };

  // Sync language toggle with current UI language by default (only if user hasn't changed it)
  useEffect(() => {
    setLanguage(isTr ? "tr" : "en");
  }, [isTr]);

  const reports = listQuery.data ?? [];

  return (
    <div className="container mx-auto max-w-[1400px] space-y-5 px-6 py-6">
      <PageHeader
        title={t("reports:page.title")}
        subtitle={t("reports:page.subtitle")}
      />

      {/* Create form */}
      <ChartCard title={t("reports:create.section_title")} icon={FileText}>
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="report-name">{t("reports:create.name_label")}</Label>
              <Input
                id="report-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("reports:create.name_placeholder")}
                maxLength={255}
              />
            </div>

            {/* Dates + presets */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="date-from">{t("reports:create.date_from")}</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  max={dateTo}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date-to">{t("reports:create.date_to")}</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom}
                  max={today}
                  required
                />
              </div>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-text-dim">
                {t("reports:create.presets")}
              </span>
              {(
                [
                  ["last_7", "preset_last_7"],
                  ["last_30", "preset_last_30"],
                  ["this_month", "preset_this_month"],
                  ["last_month", "preset_last_month"],
                ] as [PresetId, string][]
              ).map(([id, key]) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handlePreset(id)}
                  className="h-8"
                >
                  {t(`reports:create.${key}`)}
                </Button>
              ))}
            </div>

            {/* Language */}
            <div className="space-y-1.5">
              <Label htmlFor="report-lang">{t("reports:create.language")}</Label>
              <Select
                value={language}
                onValueChange={(v) => setLanguage(v as ReportLanguage)}
              >
                <SelectTrigger id="report-lang" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tr">
                    {t("reports:create.language_tr")}
                  </SelectItem>
                  <SelectItem value="en">
                    {t("reports:create.language_en")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sections grid */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>{t("reports:create.sections_label")}</Label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedSections([...ALL_SECTIONS])}
                    className="h-7 px-2 text-xs"
                  >
                    {t("reports:create.select_all")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedSections([])}
                    className="h-7 px-2 text-xs"
                  >
                    {t("reports:create.clear_all")}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-text-muted">
                {t("reports:create.sections_help")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ALL_SECTIONS.map((key) => {
                  const meta = sectionLabels.get(key);
                  const checked = selectedSections.includes(key);
                  return (
                    <label
                      key={key}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                        checked
                          ? "border-primary/40 bg-primary/[0.04]"
                          : "border-border bg-surface hover:bg-surface-2",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          handleToggleSection(key, v === true)
                        }
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground">
                          {meta?.label}
                        </div>
                        {meta?.description && (
                          <div className="mt-0.5 text-xs text-text-muted">
                            {meta.description}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {validationError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}

            {/* Submit */}
            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="gap-1.5"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("reports:create.submitting")}
                  </>
                ) : (
                  <>
                    <FileText className="size-4" />
                    {t("reports:create.submit")}
                  </>
                )}
              </Button>
            </div>
        </form>
      </ChartCard>

      {/* History */}
      <ChartCard
        title={t("reports:history.section_title")}
        icon={History}
        contentClassName="p-0"
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["reports", "list"] })
            }
            disabled={listQuery.isFetching}
            className="gap-1.5"
          >
            <RefreshCw
              className={cn("size-4", listQuery.isFetching && "animate-spin")}
            />
            {t("reports:history.refresh")}
          </Button>
        }
      >
        <div>
          {actionError && (
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="size-4" />
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}

          {listQuery.isError && (
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="size-4" />
              <AlertDescription>
                {t("reports:history.load_failed")}
              </AlertDescription>
            </Alert>
          )}

          {listQuery.isPending ? (
            <div className="flex items-center justify-center px-6 py-16 text-sm text-text-muted">
              <Loader2 className="mr-2 size-4 animate-spin" />…
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <FileText className="size-10 text-text-dim" />
              <div className="text-base font-medium text-foreground">
                {t("reports:history.empty_title")}
              </div>
              <div className="max-w-md text-sm text-text-muted">
                {t("reports:history.empty_body")}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                    <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("reports:history.col_name")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("reports:history.col_period")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("reports:history.col_sections")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("reports:history.col_status")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                      {t("reports:history.col_size")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("reports:history.col_created_at")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                      {t("reports:history.col_actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => {
                    const tone = STATUS_TONE[r.status];
                    const StatusIcon = tone.Icon;
                    return (
                      <TableRow key={r.id} className="border-b border-border">
                        <TableCell className="px-4 py-3">
                          <div className="font-medium text-foreground">
                            {r.name}
                          </div>
                          {r.error_message && r.status === "failed" && (
                            <div className="mt-0.5 text-xs text-error-600 dark:text-error-500">
                              {r.error_message}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-sm tabular-nums text-text-muted">
                          {dayjs(r.date_from).format("DD.MM.YYYY")}
                          <span className="mx-1 text-text-dim">-</span>
                          {dayjs(r.date_to).format("DD.MM.YYYY")}
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {r.sections.map((s) => (
                              <span
                                key={s}
                                className="inline-flex items-center rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-text-muted"
                              >
                                {sectionLabels.get(s)?.label ??
                                  t(`reports:section.${s}`)}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                              tone.className,
                            )}
                          >
                            <StatusIcon
                              className={cn(
                                "size-3",
                                r.status === "generating" && "animate-spin",
                              )}
                            />
                            {t(`reports:status.${r.status}`)}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right text-sm tabular-nums text-text-muted">
                          {formatBytes(r.file_size_bytes)}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-sm text-text-muted">
                          {dayjs
                            .utc(r.created_at)
                            .tz("Europe/Istanbul")
                            .format("DD.MM.YYYY HH:mm")}
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={r.status !== "completed"}
                              onClick={() => void handleDownload(r)}
                              className="h-8 gap-1"
                            >
                              <Download className="size-3.5" />
                              {t("reports:history.download")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setPendingDelete(r)}
                              className="h-8 px-2 text-text-muted hover:text-error-600"
                              aria-label={t("reports:history.delete")}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </ChartCard>

      {/* Delete confirm */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("reports:history.delete_confirm_title")}
            </DialogTitle>
            <DialogDescription>
              {t("reports:history.delete_confirm_body", {
                name: pendingDelete?.name ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleteMutation.isPending}
            >
              {t("common:cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                pendingDelete && deleteMutation.mutate(pendingDelete.id)
              }
              className="gap-1.5"
            >
              {deleteMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {t("reports:history.delete_confirm_cta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
