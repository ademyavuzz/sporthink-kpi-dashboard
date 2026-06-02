import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Database,
  Download,
  FileText,
  History,
  Loader2,
  Play,
  Sparkles,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { SourceConnections } from "@/components/feature/SourceConnections";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { importsApi } from "@/lib/api/imports";
import { cn } from "@/lib/utils";
import type {
  DataTypeMeta,
  ImportDataType,
  ImportPreviewResponse,
  ImportRunResult,
  ImportSampleError,
} from "@/types/imports";

import { StepIndicator, type WizardStep } from "./StepIndicator";
import {
  deriveImportOutcome,
  downloadBlob,
  formatBytes,
  formatDuration,
  type ImportOutcome,
} from "./lib";

export default function ImportPage() {
  const { t } = useTranslation(["imports", "common"]);
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WizardStep>("select");
  const [dataType, setDataType] = useState<ImportDataType | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [previewResp, setPreviewResp] = useState<ImportPreviewResponse | null>(
    null,
  );
  const [runResult, setRunResult] = useState<ImportRunResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dataTypesQuery = useQuery({
    queryKey: ["imports", "data-types"],
    queryFn: () => importsApi.getDataTypes(),
    staleTime: 30 * 60_000,
  });

  const previewMutation = useMutation({
    mutationFn: ({ f, dt }: { f: File; dt: ImportDataType }) =>
      importsApi.preview(f, dt),
    onSuccess: (data) => {
      setPreviewResp(data);
      setStep("preview");
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : t("imports:errors.preview_failed"),
      );
    },
  });

  const runMutation = useMutation({
    mutationFn: ({ f, dt }: { f: File; dt: ImportDataType }) =>
      importsApi.run(f, dt),
    onSuccess: (data) => {
      setRunResult(data);
      setStep("done");
      setErrorMsg(null);
      void queryClient.invalidateQueries({ queryKey: ["imports", "list"] });
    },
    onError: (err) => {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : t("imports:errors.import_failed"),
      );
      setStep("preview");
    },
  });

  function resetWizard() {
    setStep("select");
    setDataType("");
    setFile(null);
    setPreviewResp(null);
    setRunResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function setSelectedFile(f: File | null) {
    if (!f) {
      setFile(null);
      return;
    }
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setErrorMsg(t("imports:errors.file_not_csv"));
      setFile(null);
      return;
    }
    // Backend `import_max_file_size_mb` ile aynı sınır (config.py default 50).
    const MAX_MB = 50;
    if (f.size > MAX_MB * 1024 * 1024) {
      setErrorMsg(
        t("imports:errors.file_too_large", {
          max: MAX_MB,
          size: (f.size / (1024 * 1024)).toFixed(1),
        }),
      );
      setFile(null);
      return;
    }
    setFile(f);
    setErrorMsg(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] ?? null);
  }

  function handlePreviewClick() {
    if (!file) {
      setErrorMsg(t("imports:errors.no_file_selected"));
      return;
    }
    if (!dataType) {
      setErrorMsg(t("imports:errors.no_data_type_selected"));
      return;
    }
    previewMutation.mutate({ f: file, dt: dataType });
  }

  function handleRunClick() {
    if (!file || !dataType) return;
    setStep("importing");
    runMutation.mutate({ f: file, dt: dataType });
  }

  async function handleDownloadErrors() {
    if (!runResult) return;
    try {
      const blob = await importsApi.downloadErrorsCsv(runResult.id);
      downloadBlob(blob, `import-${runResult.id}-errors.csv`);
    } catch {
      setErrorMsg(t("imports:errors.import_failed"));
    }
  }

  return (
    <div className="container mx-auto max-w-[1100px] space-y-5 px-6 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title-sm font-semibold text-foreground">
            {t("imports:page_title")}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {t("imports:page_subtitle")}
          </p>
        </div>
        <Button asChild variant="outline" className="gap-1.5">
          <Link to="/import/history">
            <History className="size-4" />
            {t("imports:tab_history")}
          </Link>
        </Button>
      </div>

      <StepIndicator current={step} />

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {step === "select" && (
        <>
          <SelectStep
            dataType={dataType}
            setDataType={setDataType}
            file={file}
            setSelectedFile={setSelectedFile}
            fileInputRef={fileInputRef}
            handleFileChange={handleFileChange}
            dataTypes={dataTypesQuery.data ?? []}
            dataTypesLoading={dataTypesQuery.isPending}
            dataTypesError={dataTypesQuery.isError}
            onPreview={handlePreviewClick}
            previewLoading={previewMutation.isPending}
          />
          <SourceConnections />
        </>
      )}

      {step === "preview" && previewResp && (
        <PreviewStep
          preview={previewResp}
          dataTypeMeta={dataTypesQuery.data?.find(
            (d) => d.data_type === dataType,
          )}
          onBack={() => setStep("select")}
          onRun={handleRunClick}
          runLoading={runMutation.isPending}
        />
      )}

      {step === "importing" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <div className="inline-flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2 className="size-7 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">
                {t("imports:wizard.importing")}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                {t("imports:wizard.importing_hint")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && runResult && (
        <ResultStep
          result={runResult}
          onDownloadErrors={handleDownloadErrors}
          onNewImport={resetWizard}
        />
      )}
    </div>
  );
}

// =====================================================================
// Step 1 — Select data type + file
// =====================================================================

interface SelectStepProps {
  dataType: ImportDataType | "";
  setDataType: (v: ImportDataType) => void;
  file: File | null;
  setSelectedFile: (f: File | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  dataTypes: DataTypeMeta[];
  dataTypesLoading: boolean;
  dataTypesError: boolean;
  onPreview: () => void;
  previewLoading: boolean;
}

function SelectStep({
  dataType,
  setDataType,
  file,
  setSelectedFile,
  fileInputRef,
  handleFileChange,
  dataTypes,
  dataTypesLoading,
  dataTypesError,
  onPreview,
  previewLoading,
}: SelectStepProps) {
  const { t } = useTranslation(["imports", "common"]);
  const [dragActive, setDragActive] = useState(false);

  const selectedMeta = dataTypes.find((d) => d.data_type === dataType);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setSelectedFile(dropped);
  }

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        {/* Section: data type */}
        <Section
          icon={Database}
          title={t("imports:wizard.select_data_type")}
          subtitle={t("imports:wizard.select_data_type_subtitle")}
          stepNo={1}
        >
          <Label htmlFor="data-type" className="sr-only">
            {t("imports:wizard.select_data_type")}
          </Label>
          <Select
            value={dataType}
            onValueChange={(v) => setDataType(v as ImportDataType)}
            disabled={dataTypesLoading || dataTypesError}
          >
            <SelectTrigger id="data-type" className="h-11">
              <SelectValue
                placeholder={t("imports:wizard.select_data_type_placeholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {dataTypes.map((d) => (
                <SelectItem key={d.data_type} value={d.data_type}>
                  <span className="flex items-center gap-2">
                    <Database className="size-3.5 text-text-dim" />
                    <span>
                      {t(`imports:data_types.${d.data_type}`, {
                        defaultValue: d.label_tr,
                      })}
                    </span>
                    <span className="text-xs text-text-dim">
                      ·{" "}
                      {t("imports:wizard.headers_count", {
                        count: d.csv_headers.length,
                      })}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedMeta && (
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                <Sparkles className="size-3" />
                {t(`imports:data_types.${selectedMeta.data_type}`, {
                  defaultValue: selectedMeta.label_tr,
                })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-text-muted">
                {t("imports:wizard.headers_count", {
                  count: selectedMeta.csv_headers.length,
                })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-mono text-[11px] text-text-muted">
                {selectedMeta.target_table}
              </span>
            </div>
          )}
          {dataTypesError && (
            <p className="text-sm text-error-600">
              {t("imports:errors.load_data_types_failed")}
            </p>
          )}
        </Section>

        <div className="border-t border-border" />

        {/* Section: file */}
        <Section
          icon={Upload}
          title={t("imports:wizard.select_file")}
          subtitle={t("imports:wizard.select_file_subtitle")}
          stepNo={2}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 px-4 py-3">
              <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-semibold text-foreground"
                  title={file.name}
                >
                  {file.name}
                </p>
                <p className="text-xs text-text-muted">
                  {formatBytes(file.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSelectedFile(null)}
                aria-label={t("imports:wizard.remove_file")}
                title={t("imports:wizard.remove_file")}
                className="size-8 text-text-muted hover:bg-error-500/10 hover:text-error-600"
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={cn(
                "group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-all",
                dragActive
                  ? "border-primary bg-primary/[0.06] scale-[1.01]"
                  : "border-border hover:border-primary/40 hover:bg-surface-2/40",
              )}
            >
              <div
                className={cn(
                  "inline-flex size-12 items-center justify-center rounded-full transition-colors",
                  dragActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-text-muted group-hover:bg-primary/10 group-hover:text-primary",
                )}
              >
                <Upload className="size-5" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  {dragActive
                    ? t("imports:wizard.drop_file_active")
                    : t("imports:wizard.drop_file_here")}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {t("imports:wizard.csv_only")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                {t("imports:wizard.browse_files")}
              </Button>
            </div>
          )}
        </Section>

        <div className="flex justify-end">
          <Button
            onClick={onPreview}
            disabled={!file || !dataType || previewLoading}
            className="gap-1.5"
          >
            {previewLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {t("imports:wizard.btn_preview")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================================
// Step 2 — Preview
// =====================================================================

interface PreviewStepProps {
  preview: ImportPreviewResponse;
  dataTypeMeta: DataTypeMeta | undefined;
  onBack: () => void;
  onRun: () => void;
  runLoading: boolean;
}

function PreviewStep({
  preview,
  dataTypeMeta,
  onBack,
  onRun,
  runLoading,
}: PreviewStepProps) {
  const { t } = useTranslation("imports");
  const blocked = preview.missing_required.length > 0;

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-semibold text-foreground"
                  title={preview.file_name}
                >
                  {preview.file_name}
                </p>
                <p className="text-xs text-text-muted">
                  {formatBytes(preview.file_size_bytes)}
                </p>
              </div>
            </div>
            {dataTypeMeta && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                <Database className="size-3" />
                {t(`data_types.${dataTypeMeta.data_type}`, {
                  defaultValue: dataTypeMeta.label_tr,
                })}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <MiniStat
              label={t("wizard.preview_stat_total")}
              value={preview.summary.previewed_rows}
              tone="info"
            />
            <MiniStat
              label={t("wizard.preview_stat_valid")}
              value={preview.summary.valid_rows}
              tone="success"
            />
            <MiniStat
              label={t("wizard.preview_stat_errors")}
              value={preview.summary.error_rows}
              tone={preview.summary.error_rows > 0 ? "error" : "neutral"}
            />
          </div>

          {blocked && (
            <Alert variant="destructive">
              <XCircle className="size-4" />
              <AlertTitle>
                {t("wizard.preview_missing_required", {
                  count: preview.missing_required.length,
                })}
              </AlertTitle>
              <AlertDescription>
                <p className="mb-2">{t("wizard.preview_blocked")}</p>
                <div className="flex flex-wrap gap-1">
                  {preview.missing_required.map((h) => (
                    <code
                      key={h}
                      className="rounded bg-error-500/10 px-1.5 py-0.5 font-mono text-[11px] text-error-700 dark:text-error-400"
                    >
                      {h}
                    </code>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {preview.unknown_headers.length > 0 && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertTitle>
                {t("wizard.preview_unknown_headers", {
                  count: preview.unknown_headers.length,
                })}
              </AlertTitle>
              <AlertDescription>
                <p className="mb-2">{t("wizard.preview_unknown_warning")}</p>
                <div className="flex flex-wrap gap-1">
                  {preview.unknown_headers.map((h) => (
                    <code
                      key={h}
                      className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-text-muted"
                    >
                      {h}
                    </code>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Sample rows */}
      {preview.sample_rows.length > 0 && (
        <Card className="overflow-hidden">
          <header className="flex items-center justify-between border-b border-border bg-surface-2/50 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t("wizard.preview_sample_rows", {
                count: preview.sample_rows.length,
              })}
            </h3>
          </header>
          <CardContent className="p-0">
            <SamplePreviewTable rows={preview.sample_rows} />
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={runLoading}
          className="gap-1.5"
        >
          <ArrowLeft className="size-4" />
          {t("wizard.btn_back")}
        </Button>
        <Button
          onClick={onRun}
          disabled={blocked || runLoading}
          className="gap-1.5"
        >
          {runLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          {t("wizard.btn_run_import")}
        </Button>
      </div>
    </div>
  );
}

function SamplePreviewTable({
  rows,
}: {
  rows: Array<Record<string, unknown>>;
}) {
  const headers = Object.keys(rows[0] ?? {});
  return (
    <div className="max-h-96 overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-surface-2 backdrop-blur-sm">
          <TableRow className="border-b border-border hover:bg-surface-2">
            {headers.map((h) => (
              <TableHead
                key={h}
                className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-dim"
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={i}
              className={cn(
                "border-b border-border/60",
                i % 2 === 1 && "bg-surface-2/40",
                "hover:bg-primary/[0.04]",
              )}
            >
              {headers.map((h) => (
                <TableCell
                  key={h}
                  className="max-w-[240px] truncate whitespace-nowrap px-3 py-2 font-mono text-[11px] text-text-muted"
                  title={formatCell(row[h])}
                >
                  {formatCell(row[h])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "✓" : "✗";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// =====================================================================
// Step 4 — Result
// =====================================================================

interface ResultStepProps {
  result: ImportRunResult;
  onDownloadErrors: () => void;
  onNewImport: () => void;
}

/** Outcome → hero tonu (border + bg + ikon). */
function outcomeHeroTone(o: ImportOutcome): {
  border: string;
  iconBg: string;
  Icon: typeof CheckCircle2;
  titleKey: string;
  hintKey: string | null;
} {
  switch (o) {
    case "completed":
      return {
        border: "border-success-500/20 bg-success-500/[0.02]",
        iconBg: "bg-success-500/10 text-success-600 dark:text-success-500",
        Icon: CheckCircle2,
        titleKey: "wizard.result_success_title",
        hintKey: null,
      };
    case "duplicate":
      return {
        border: "border-warning-500/20 bg-warning-500/[0.02]",
        iconBg: "bg-warning-500/10 text-warning-600 dark:text-warning-500",
        Icon: AlertCircle,
        titleKey: "wizard.result_duplicate_title",
        hintKey: "wizard.result_duplicate_hint",
      };
    case "partial":
      return {
        border: "border-warning-500/20 bg-warning-500/[0.02]",
        iconBg: "bg-warning-500/10 text-warning-600 dark:text-warning-500",
        Icon: AlertCircle,
        titleKey: "wizard.result_partial_title",
        hintKey: "wizard.result_partial_hint",
      };
    case "with_errors":
      return {
        border: "border-warning-500/20 bg-warning-500/[0.02]",
        iconBg: "bg-warning-500/10 text-warning-600 dark:text-warning-500",
        Icon: AlertCircle,
        titleKey: "wizard.result_with_errors_title",
        hintKey: "wizard.result_with_errors_hint",
      };
    case "empty":
      return {
        border: "border-warning-500/20 bg-warning-500/[0.02]",
        iconBg: "bg-warning-500/10 text-warning-600 dark:text-warning-500",
        Icon: AlertCircle,
        titleKey: "wizard.result_empty_title",
        hintKey: "wizard.result_empty_hint",
      };
    case "running":
      // Pratikte burada görünmez; importing step'i ayrı render eder.
      return {
        border: "border-blue-500/20 bg-blue-500/[0.02]",
        iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        Icon: AlertCircle,
        titleKey: "wizard.importing",
        hintKey: null,
      };
    case "failed":
    case "cancelled":
      return {
        border: "border-error-500/20 bg-error-500/[0.02]",
        iconBg: "bg-error-500/10 text-error-600 dark:text-error-500",
        Icon: XCircle,
        titleKey: "wizard.result_failed_title",
        hintKey: null,
      };
  }
}

function ResultStep({
  result,
  onDownloadErrors,
  onNewImport,
}: ResultStepProps) {
  const { t } = useTranslation("imports");
  const outcome = deriveImportOutcome(result);
  const hero = outcomeHeroTone(outcome);
  const skipped = result.skipped_rows ?? 0;
  const hasErrors = (result.invalid_rows ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* Result hero */}
      <Card className={cn("overflow-hidden border-2", hero.border)}>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "inline-flex size-12 shrink-0 items-center justify-center rounded-full",
                hero.iconBg,
              )}
            >
              <hero.Icon className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {t(hero.titleKey)}
              </h3>
              <p className="text-xs text-text-muted">
                {result.file_name} ·{" "}
                {formatDuration(result.duration_seconds)}
              </p>
            </div>
          </div>

          {/* Outcome-spesifik açıklama banner'ı */}
          {hero.hintKey && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>{t(hero.hintKey)}</AlertDescription>
            </Alert>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <ResultStat
              label={t("wizard.result_total_rows")}
              value={result.total_rows}
              tone="neutral"
            />
            <ResultStat
              label={t("wizard.result_valid_rows")}
              value={result.valid_rows}
              tone="success"
            />
            <ResultStat
              label={t("wizard.result_invalid_rows")}
              value={result.invalid_rows}
              tone={
                (result.invalid_rows ?? 0) > 0 ? "error" : "neutral"
              }
            />
            <ResultStat
              label={t("wizard.result_skipped_rows")}
              value={result.skipped_rows}
              tone={
                (result.skipped_rows ?? 0) > 0 ? "warning" : "neutral"
              }
            />
            <ResultStat
              label={t("wizard.result_inserted_rows")}
              value={result.inserted_rows}
              tone={
                (result.inserted_rows ?? 0) > 0 ? "info" : "neutral"
              }
            />
            <ResultStat
              label={t("wizard.result_duration")}
              value={formatDuration(result.duration_seconds)}
              tone="neutral"
              isText
            />
          </div>

          {/* skipped > 0 banner artık duplicate/partial outcome hint'iyle birlikte
              gösterildiği için sadece outcome === completed iken (kenar durum)
              yumuşak bir not olarak duruyor. */}
          {outcome === "completed" && skipped > 0 && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>
                {t("wizard.result_skipped_hint", { count: skipped })}
              </AlertDescription>
            </Alert>
          )}

          {result.error_message && (
            <Alert variant="destructive">
              <XCircle className="size-4" />
              <AlertDescription>{result.error_message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Sample errors */}
      {result.sample_errors.length > 0 && (
        <Card className="overflow-hidden">
          <header className="flex items-center justify-between border-b border-border bg-surface-2/50 px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="inline-flex size-6 items-center justify-center rounded-md bg-error-500/10 text-error-600">
                <AlertCircle className="size-3.5" />
              </span>
              {t("wizard.result_errors_title", {
                count: result.sample_errors.length,
              })}
            </h3>
          </header>
          <CardContent className="p-0">
            <ErrorsTable rows={result.sample_errors} />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {hasErrors && (
          <Button
            variant="outline"
            onClick={onDownloadErrors}
            className="gap-1.5"
          >
            <Download className="size-4" />
            {t("wizard.btn_download_errors")}
          </Button>
        )}
        <Button onClick={onNewImport} className="gap-1.5">
          <Upload className="size-4" />
          {t("wizard.btn_new_import")}
        </Button>
      </div>
    </div>
  );
}

function ErrorsTable({ rows }: { rows: ImportSampleError[] }) {
  const { t } = useTranslation("imports");
  return (
    <div className="max-h-72 overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-surface-2">
          <TableRow className="border-b border-border hover:bg-surface-2">
            <TableHead className="w-[60px] px-3 py-2.5 text-[11px] uppercase tracking-wider text-text-dim">
              {t("wizard.errors_table_row")}
            </TableHead>
            <TableHead className="w-[140px] px-3 py-2.5 text-[11px] uppercase tracking-wider text-text-dim">
              {t("wizard.errors_table_field")}
            </TableHead>
            <TableHead className="w-[160px] px-3 py-2.5 text-[11px] uppercase tracking-wider text-text-dim">
              {t("wizard.errors_table_code")}
            </TableHead>
            <TableHead className="px-3 py-2.5 text-[11px] uppercase tracking-wider text-text-dim">
              {t("wizard.errors_table_message")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e, i) => (
            <TableRow
              key={i}
              className={cn(
                "border-b border-border/60",
                i % 2 === 1 && "bg-surface-2/40",
              )}
            >
              <TableCell className="px-3 py-2.5 font-mono text-xs tabular-nums text-text-muted">
                {e.source_row_number}
              </TableCell>
              <TableCell className="px-3 py-2.5 font-mono text-xs">
                {e.field_name ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                    {e.field_name}
                  </span>
                ) : (
                  <span className="text-text-dim">—</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-2.5">
                <span className="inline-flex items-center rounded-full bg-error-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-error-700 ring-1 ring-inset ring-error-100 dark:bg-error-500/10 dark:text-error-400 dark:ring-error-500/20">
                  {e.error_code}
                </span>
              </TableCell>
              <TableCell className="px-3 py-2.5 text-xs text-text-muted">
                {e.error_message ?? (
                  <span className="text-text-dim">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// =====================================================================
// Helpers
// =====================================================================

function Section({
  icon: Icon,
  title,
  subtitle,
  stepNo,
  children,
}: {
  icon: typeof Database;
  title: string;
  subtitle?: string;
  stepNo?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header className="flex items-center gap-2.5">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          {stepNo !== undefined && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">
              {String(stepNo).padStart(2, "0")}
            </p>
          )}
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle && (
            <p className="text-xs text-text-muted">{subtitle}</p>
          )}
        </div>
      </header>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "info" | "success" | "warning" | "error" | "neutral";
}) {
  const toneClass = {
    info: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    success:
      "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500",
    warning:
      "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-500",
    error:
      "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-500",
    neutral: "bg-muted text-text-muted",
  }[tone];
  return (
    <div className={cn("rounded-lg px-3 py-2.5", toneClass)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ResultStat({
  label,
  value,
  tone,
  isText,
}: {
  label: string;
  value: number | string | null | undefined;
  tone: "info" | "success" | "warning" | "error" | "neutral";
  isText?: boolean;
}) {
  const toneClass = {
    info: "bg-blue-50 dark:bg-blue-500/10",
    success: "bg-success-50 dark:bg-success-500/10",
    warning: "bg-warning-50 dark:bg-warning-500/10",
    error: "bg-error-50 dark:bg-error-500/10",
    neutral: "bg-surface-2/60",
  }[tone];
  const valueClass = {
    info: "text-blue-700 dark:text-blue-400",
    success: "text-success-700 dark:text-success-500",
    warning: "text-warning-700 dark:text-warning-500",
    error: "text-error-700 dark:text-error-500",
    neutral: "text-foreground",
  }[tone];
  const display =
    value === null || value === undefined
      ? "—"
      : isText
        ? String(value)
        : typeof value === "number"
          ? value.toLocaleString("tr-TR")
          : String(value);
  return (
    <div className={cn("min-w-0 rounded-lg px-3 py-2.5", toneClass)}>
      <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate text-base font-semibold tabular-nums",
          valueClass,
        )}
        title={display}
      >
        {display}
      </p>
    </div>
  );
}
