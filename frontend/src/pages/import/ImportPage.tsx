import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/types/imports";

import { StepIndicator, type WizardStep } from "./StepIndicator";
import { downloadBlob, formatBytes, formatDuration } from "./lib";

export default function ImportPage() {
  const { t } = useTranslation(["imports", "common"]);
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WizardStep>("select");
  const [dataType, setDataType] = useState<ImportDataType | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [previewResp, setPreviewResp] = useState<ImportPreviewResponse | null>(null);
  const [runResult, setRunResult] = useState<ImportRunResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. adım — data types meta (dropdown için)
  const dataTypesQuery = useQuery({
    queryKey: ["imports", "data-types"],
    queryFn: () => importsApi.getDataTypes(),
    staleTime: 30 * 60_000, // 30 dk; nadiren değişir
  });

  // 2. adım — preview
  const previewMutation = useMutation({
    mutationFn: ({ f, dt }: { f: File; dt: ImportDataType }) => importsApi.preview(f, dt),
    onSuccess: (data) => {
      setPreviewResp(data);
      setStep("preview");
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(
        err instanceof ApiError ? err.message : t("imports:errors.preview_failed"),
      );
    },
  });

  // 3. adım — gerçek import
  const runMutation = useMutation({
    mutationFn: ({ f, dt }: { f: File; dt: ImportDataType }) => importsApi.run(f, dt),
    onSuccess: (data) => {
      setRunResult(data);
      setStep("done");
      setErrorMsg(null);
      // History sayfasının cache'ini invalidate et
      void queryClient.invalidateQueries({ queryKey: ["imports", "list"] });
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : t("imports:errors.import_failed"));
      setStep("preview"); // Geri preview'a dön
    },
  });

  function resetWizard() {
    setStep("select");
    setDataType("");
    setFile(null);
    setPreviewResp(null);
    setRunResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setFile(null);
      return;
    }
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setErrorMsg(t("imports:errors.file_not_csv"));
      setFile(null);
      return;
    }
    setFile(f);
    setErrorMsg(null);
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("imports:page_title")}</h1>
          <p className="text-muted-foreground text-sm">{t("imports:page_subtitle")}</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/import/history">{t("imports:tab_history")}</Link>
        </Button>
      </div>

      <StepIndicator current={step} />

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {step === "select" && (
        <SelectStep
          dataType={dataType}
          setDataType={setDataType}
          file={file}
          fileInputRef={fileInputRef}
          handleFileChange={handleFileChange}
          dataTypes={dataTypesQuery.data ?? []}
          dataTypesLoading={dataTypesQuery.isPending}
          dataTypesError={dataTypesQuery.isError}
          onPreview={handlePreviewClick}
          previewLoading={previewMutation.isPending}
        />
      )}

      {step === "preview" && previewResp && (
        <PreviewStep
          preview={previewResp}
          dataTypeMeta={dataTypesQuery.data?.find((d) => d.data_type === dataType)}
          onBack={() => setStep("select")}
          onRun={handleRunClick}
          runLoading={runMutation.isPending}
        />
      )}

      {step === "importing" && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">{t("imports:wizard.importing")}</p>
              <p className="text-sm text-muted-foreground">
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

/* ---------------------------------------------------------------- */
/* Step 1 — Veri kaynağı + dosya seç                                */
/* ---------------------------------------------------------------- */

interface SelectStepProps {
  dataType: ImportDataType | "";
  setDataType: (v: ImportDataType) => void;
  file: File | null;
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
  fileInputRef,
  handleFileChange,
  dataTypes,
  dataTypesLoading,
  dataTypesError,
  onPreview,
  previewLoading,
}: SelectStepProps) {
  const { t } = useTranslation(["imports", "common"]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("imports:wizard.step_1")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="data-type">{t("imports:wizard.select_data_type")}</Label>
          <Select
            value={dataType}
            onValueChange={(v) => setDataType(v as ImportDataType)}
            disabled={dataTypesLoading || dataTypesError}
          >
            <SelectTrigger id="data-type">
              <SelectValue
                placeholder={t("imports:wizard.select_data_type_placeholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {dataTypes.map((d) => (
                <SelectItem key={d.data_type} value={d.data_type}>
                  {d.label_tr}
                  <span className="text-muted-foreground ml-2 text-xs">
                    ({d.csv_headers.length} kolon)
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {dataTypesError && (
            <p className="text-sm text-destructive">
              {t("imports:errors.load_data_types_failed")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>{t("imports:wizard.select_file")}</Label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer",
              "hover:border-primary hover:bg-accent/30 transition-colors",
              file && "border-primary bg-accent/20",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t("imports:wizard.drop_file_here")}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={onPreview}
            disabled={!file || !dataType || previewLoading}
          >
            {previewLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("imports:wizard.btn_preview")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------------- */
/* Step 2 — Önizleme                                                */
/* ---------------------------------------------------------------- */

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t("wizard.preview_title")}</span>
            {dataTypeMeta && (
              <Badge variant="outline">{dataTypeMeta.label_tr}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label={t("wizard.file_name")} value={preview.file_name} mono />
            <Stat label={t("wizard.file_size")} value={formatBytes(preview.file_size_bytes)} />
            <div className="text-xs text-muted-foreground sm:text-right self-end">
              {t("wizard.preview_summary", {
                previewed: preview.summary.previewed_rows,
                valid: preview.summary.valid_rows,
                errors: preview.summary.error_rows,
              })}
            </div>
          </div>

          {blocked && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>
                {t("wizard.preview_missing_required", {
                  count: preview.missing_required.length,
                })}
              </AlertTitle>
              <AlertDescription>
                <p className="mb-2">{t("wizard.preview_blocked")}</p>
                <code className="text-xs bg-background/50 p-1 rounded">
                  {preview.missing_required.join(", ")}
                </code>
              </AlertDescription>
            </Alert>
          )}

          {preview.unknown_headers.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {t("wizard.preview_unknown_headers", {
                  count: preview.unknown_headers.length,
                })}
              </AlertTitle>
              <AlertDescription>
                <p className="mb-2">{t("wizard.preview_unknown_warning")}</p>
                <code className="text-xs bg-background/50 p-1 rounded">
                  {preview.unknown_headers.join(", ")}
                </code>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {preview.sample_rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t("wizard.preview_sample_rows", { count: preview.sample_rows.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SamplePreviewTable rows={preview.sample_rows} />
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={runLoading}>
          {t("wizard.btn_back")}
        </Button>
        <Button onClick={onRun} disabled={blocked || runLoading}>
          {runLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t("wizard.btn_run_import")}
        </Button>
      </div>
    </div>
  );
}

function SamplePreviewTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  const headers = Object.keys(rows[0] ?? {});
  return (
    <div className="border rounded-md overflow-auto max-h-96">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
          <TableRow>
            {headers.map((h) => (
              <TableHead
                key={h}
                className="whitespace-nowrap text-xs font-medium px-3"
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {headers.map((h) => (
                <TableCell
                  key={h}
                  className="whitespace-nowrap text-xs px-3 max-w-[240px] truncate"
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

/* ---------------------------------------------------------------- */
/* Step 4 — Sonuç                                                   */
/* ---------------------------------------------------------------- */

interface ResultStepProps {
  result: ImportRunResult;
  onDownloadErrors: () => void;
  onNewImport: () => void;
}

function ResultStep({ result, onDownloadErrors, onNewImport }: ResultStepProps) {
  const { t } = useTranslation("imports");
  const isSuccess = result.status === "completed";
  const hasErrors = (result.invalid_rows ?? 0) > 0;
  const skipped = result.skipped_rows ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : (
              <XCircle className="h-6 w-6 text-destructive" />
            )}
            {isSuccess
              ? t("wizard.result_success_title")
              : t("wizard.result_failed_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Stat label={t("wizard.result_total_rows")} value={result.total_rows ?? "—"} />
            <Stat label={t("wizard.result_valid_rows")} value={result.valid_rows ?? "—"} />
            <Stat label={t("wizard.result_invalid_rows")} value={result.invalid_rows ?? "—"} />
            <Stat label={t("wizard.result_skipped_rows")} value={result.skipped_rows ?? "—"} />
            <Stat label={t("wizard.result_inserted_rows")} value={result.inserted_rows ?? "—"} />
            <Stat
              label={t("wizard.result_duration")}
              value={formatDuration(result.duration_seconds)}
            />
          </div>

          {skipped > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t("wizard.result_skipped_hint", { count: skipped })}
              </AlertDescription>
            </Alert>
          )}

          {result.error_message && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{result.error_message}</AlertDescription>
            </Alert>
          )}

          {result.sample_errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">
                {t("wizard.result_errors_title", { count: result.sample_errors.length })}
              </h4>
              <div className="border rounded-lg overflow-x-auto max-h-72">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">field</TableHead>
                      <TableHead className="text-xs">code</TableHead>
                      <TableHead className="text-xs">message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.sample_errors.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{e.source_row_number}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {e.field_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline">{e.error_code}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{e.error_message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        {hasErrors && (
          <Button variant="outline" onClick={onDownloadErrors}>
            <Trash2 className="h-4 w-4 mr-2" />
            {t("wizard.btn_download_errors")}
          </Button>
        )}
        <Button onClick={onNewImport}>{t("wizard.btn_new_import")}</Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Helper                                                            */
/* ---------------------------------------------------------------- */

function Stat({
  label,
  value,
  mono,
  span,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
  span?: 2 | 3;
}) {
  return (
    <div
      className={cn(
        "min-w-0 space-y-1",
        span === 2 && "col-span-2",
        span === 3 && "col-span-3",
      )}
    >
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      {value !== "" && (
        <p
          className={cn(
            "text-sm font-medium truncate tabular-nums",
            mono && "font-mono",
          )}
          title={String(value)}
        >
          {value}
        </p>
      )}
    </div>
  );
}
