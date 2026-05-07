import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  ChevronDown,
  Eye,
  GitBranch,
  Layers,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminApi } from "@/lib/api/admin";
import { formatCount, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  SegmentCreate,
  SegmentItem,
  SegmentLeafRule,
  SegmentRuleField,
  SegmentRuleOp,
} from "@/types/admin";

const FIELD_LABEL_KEYS: Record<SegmentRuleField, string> = {
  total_revenue: "field_total_revenue",
  total_orders: "field_total_orders",
  city: "field_city",
  gender: "field_gender",
  age_group: "field_age_group",
  registration_source: "field_registration_source",
  is_newsletter_subscriber: "field_newsletter",
};

const OP_LABELS: { value: SegmentRuleOp; label: string; i18nKey?: string }[] = [
  { value: "==", label: "=" },
  { value: "!=", label: "≠" },
  { value: ">", label: ">" },
  { value: ">=", label: "≥" },
  { value: "<", label: "<" },
  { value: "<=", label: "≤" },
  { value: "IN", label: "IN", i18nKey: "op_in" },
  { value: "LIKE", label: "LIKE", i18nKey: "op_like" },
];

/** RFM segment renkleri — design system token'larıyla. */
const RFM_TONE: Record<
  string,
  { dot: string; chip: string }
> = {
  Champions: {
    dot: "bg-success-500",
    chip:
      "bg-success-50 text-success-700 ring-1 ring-inset ring-success-100 dark:bg-success-500/10 dark:text-success-500 dark:ring-success-500/20",
  },
  Loyal: {
    dot: "bg-blue-500",
    chip:
      "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20",
  },
  "Potential Loyalist": {
    dot: "bg-cyan-500",
    chip:
      "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-400 dark:ring-cyan-500/20",
  },
  New: {
    dot: "bg-violet-500",
    chip:
      "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/20",
  },
  "At Risk": {
    dot: "bg-warning-500",
    chip:
      "bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-100 dark:bg-warning-500/10 dark:text-warning-500 dark:ring-warning-500/20",
  },
  Lost: {
    dot: "bg-error-500",
    chip:
      "bg-error-50 text-error-700 ring-1 ring-inset ring-error-100 dark:bg-error-500/10 dark:text-error-500 dark:ring-error-500/20",
  },
  Other: {
    dot: "bg-slate-400",
    chip: "bg-muted text-text-muted",
  },
};

const RFM_TONE_FALLBACK = {
  dot: "bg-slate-400",
  chip: "bg-muted text-text-muted",
};

function rfmTone(segment: string): { dot: string; chip: string } {
  return RFM_TONE[segment] ?? RFM_TONE_FALLBACK;
}

export default function SegmentsPage() {
  const { t } = useTranslation("admin");
  return (
    <div className="container mx-auto max-w-[1400px] space-y-5 px-6 py-6">
      <div>
        <h1 className="text-title-sm font-semibold text-foreground">
          {t("segments.title")}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-text-muted">
          {t("segments.subtitle")}
        </p>
      </div>

      <Tabs defaultValue="custom" className="space-y-5">
        <TabsList>
          <TabsTrigger value="custom" className="gap-1.5">
            <Layers className="size-3.5" />
            {t("segments.tab_custom")}
          </TabsTrigger>
          <TabsTrigger value="rfm" className="gap-1.5">
            <BarChart3 className="size-3.5" />
            {t("segments.tab_rfm")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="custom" className="space-y-5">
          <CustomSegmentsTab />
        </TabsContent>
        <TabsContent value="rfm" className="space-y-5">
          <RFMTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =====================================================================
// Custom Segments Tab
// =====================================================================

function CustomSegmentsTab() {
  const { t } = useTranslation(["admin", "common"]);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SegmentItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["segments"],
    queryFn: () => adminApi.listSegments(),
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: (p: SegmentCreate) => adminApi.createSegment(p),
    onSuccess: () => {
      setErrorMsg(null);
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["segments"] });
    },
    onError: (err) =>
      setErrorMsg(err instanceof Error ? err.message : "Could not save segment"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteSegment(id),
    onSuccess: () => {
      setPendingDelete(null);
      void qc.invalidateQueries({ queryKey: ["segments"] });
    },
  });

  const data = q.data ?? [];
  const total = data.length;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter((s) =>
      [s.name, s.description ?? ""].join(" ").toLowerCase().includes(term),
    );
  }, [data, search]);

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin:segments.search_placeholder")}
            className="h-10 pl-9"
          />
        </div>
        <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-xs font-semibold tabular-nums text-text-muted">
          <Layers className="size-3.5 text-text-dim" />
          {filtered.length}
          {filtered.length !== total && (
            <span className="text-text-dim">/ {total}</span>
          )}
        </span>
        <Button onClick={() => setOpen(true)} className="ml-auto gap-1.5">
          <Plus className="size-4" />
          {t("admin:segments.new_segment")}
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {q.isPending ? (
            <TableSkeleton />
          ) : filtered.length === 0 ? (
            total === 0 ? (
              <EmptyState
                icon={Layers}
                title={t("admin:segments.empty_title")}
                body={t("admin:segments.empty_body")}
                actionLabel={t("admin:segments.empty_cta")}
                onAction={() => setOpen(true)}
              />
            ) : (
              <EmptyState
                icon={Search}
                title={t("admin:segments.no_filtered_title")}
                body={t("admin:segments.no_filtered_body")}
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <colgroup>
                  <col className="w-[260px]" />
                  <col />
                  <col className="w-[160px]" />
                  <col className="w-[120px]" />
                  <col className="w-[60px]" />
                </colgroup>
                <TableHeader>
                  <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                    <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:segments.table_name")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:segments.table_description")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:segments.table_customer_count")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:segments.table_shared")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                      <span className="sr-only">
                        {t("admin:segments.table_actions")}
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s, idx) => (
                    <TableRow
                      key={s.id}
                      className={cn(
                        "border-b border-border/60 transition-colors",
                        idx % 2 === 1 && "bg-surface-2/40",
                        "hover:bg-primary/[0.04]",
                      )}
                    >
                      <TableCell className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Layers className="size-3.5" />
                          </span>
                          <span
                            className="truncate text-sm font-semibold text-foreground"
                            title={s.name}
                          >
                            {s.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-xs text-text-muted">
                        <span
                          className="block truncate"
                          title={s.description ?? undefined}
                        >
                          {s.description ?? (
                            <span className="text-text-dim">—</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right">
                        {s.cached_count !== null ? (
                          <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-foreground">
                            <Users className="size-3 text-text-dim" />
                            {formatCount(s.cached_count)}
                          </span>
                        ) : (
                          <span className="text-text-dim">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-3.5">
                        {s.is_shared ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20">
                            <Eye className="size-3" />
                            {t("admin:segments.shared_badge")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-text-muted">
                            {t("admin:segments.private_badge")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setPendingDelete(s)}
                          aria-label={t("admin:segments.delete_title")}
                          title={t("admin:segments.delete_title")}
                          className="size-8 text-text-muted hover:bg-error-500/10 hover:text-error-600"
                        >
                          <Trash2 className="size-3.5" />
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

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-base font-semibold text-foreground">
                  {t("admin:segments.new_segment")}
                </span>
                <span className="text-xs font-normal text-text-muted">
                  {t("admin:segments.new_segment_subtitle")}
                </span>
              </span>
            </DialogTitle>
          </DialogHeader>
          <SegmentBuilder
            onSubmit={(p) => createMut.mutate(p)}
            loading={createMut.isPending}
            onCancel={() => setOpen(false)}
            errorMessage={errorMsg}
          />
        </DialogContent>
      </Dialog>

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
                {t("admin:segments.delete_title")}
              </span>
            </DialogTitle>
          </DialogHeader>
          {pendingDelete && (
            <p className="text-sm text-text-muted">
              {t("admin:segments.delete_description", {
                name: pendingDelete.name,
              })}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                pendingDelete && deleteMut.mutate(pendingDelete.id)
              }
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && (
                <Loader2 className="mr-1 size-4 animate-spin" />
              )}
              {t("admin:segments.delete_yes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// =====================================================================
// Segment Builder (form inside Create modal)
// =====================================================================

function SegmentBuilder({
  onSubmit,
  loading,
  onCancel,
  errorMessage,
}: {
  onSubmit: (p: SegmentCreate) => void;
  loading: boolean;
  onCancel: () => void;
  errorMessage?: string | null;
}) {
  const { t } = useTranslation(["admin", "common"]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logic, setLogic] = useState<"AND" | "OR">("AND");
  const [rules, setRules] = useState<SegmentLeafRule[]>([
    { field: "total_revenue", op: ">=", value: 5000 },
  ]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fieldOptions = useMemo(
    () =>
      (Object.keys(FIELD_LABEL_KEYS) as SegmentRuleField[]).map((field) => ({
        value: field,
        label: t(`admin:segments.${FIELD_LABEL_KEYS[field]}`),
      })),
    [t],
  );

  const opOptions = useMemo(
    () =>
      OP_LABELS.map((o) => ({
        value: o.value,
        label: o.i18nKey ? t(`admin:segments.${o.i18nKey}`) : o.label,
      })),
    [t],
  );

  function updateRule(idx: number, patch: Partial<SegmentLeafRule>) {
    setRules((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRule() {
    setRules((rs) => [...rs, { field: "total_orders", op: ">=", value: 1 }]);
  }

  function removeRule(idx: number) {
    setRules((rs) => rs.filter((_, i) => i !== idx));
  }

  async function handlePreview() {
    setPreviewLoading(true);
    try {
      const r = await adminApi.previewSegment({
        name: name || "preview",
        rules: { op: logic, rules },
      });
      setPreviewCount(r.count);
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleSave() {
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      rules: { op: logic, rules },
    });
  }

  return (
    <div className="space-y-5">
      {/* Section: Info */}
      <Section title={t("admin:segments.section_info")} icon={Sparkles}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="seg-name" className="text-xs font-semibold">
              {t("admin:segments.field_name")}
            </Label>
            <Input
              id="seg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("admin:segments.field_name_placeholder")}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seg-desc" className="text-xs font-semibold">
              {t("admin:segments.field_description")}
            </Label>
            <Input
              id="seg-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("admin:segments.field_description_placeholder")}
            />
          </div>
        </div>
      </Section>

      {/* Section: Logic */}
      <Section title={t("admin:segments.section_logic")} icon={GitBranch}>
        <div className="space-y-2">
          <div className="inline-flex rounded-lg border border-border bg-surface p-1">
            {(["AND", "OR"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLogic(l)}
                className={cn(
                  "inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold transition-colors",
                  logic === l
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-text-muted hover:bg-muted hover:text-foreground",
                )}
              >
                {l === "AND"
                  ? t("admin:segments.logic_and")
                  : t("admin:segments.logic_or")}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted">
            {logic === "AND"
              ? t("admin:segments.logic_hint_and")
              : t("admin:segments.logic_hint_or")}
          </p>
        </div>
      </Section>

      {/* Section: Rules */}
      <Section title={t("admin:segments.section_rules")} icon={Layers}>
        <div className="space-y-2">
          {rules.map((rule, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/40 p-2"
            >
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-bold tabular-nums text-text-muted">
                {idx + 1}
              </span>
              <Select
                value={rule.field}
                onValueChange={(v) =>
                  updateRule(idx, { field: v as SegmentRuleField })
                }
              >
                <SelectTrigger className="h-9 flex-1 min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fieldOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={rule.op}
                onValueChange={(v) =>
                  updateRule(idx, { op: v as SegmentRuleOp })
                }
              >
                <SelectTrigger className="h-9 w-[100px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={String(rule.value ?? "")}
                onChange={(e) => {
                  const v = e.target.value;
                  const num = Number(v);
                  updateRule(idx, {
                    value:
                      !isNaN(num) && v !== "" && /^[-\d.]+$/.test(v) ? num : v,
                  });
                }}
                placeholder={t("admin:segments.rule_value_placeholder")}
                className="h-9 flex-1 min-w-0"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRule(idx)}
                disabled={rules.length === 1}
                aria-label={t("common:delete", { defaultValue: "Sil" })}
                className="size-8 shrink-0 text-text-muted hover:bg-error-500/10 hover:text-error-600 disabled:opacity-30"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRule}
            className="gap-1.5"
          >
            <Plus className="size-3.5" />
            {t("admin:segments.add_rule")}
          </Button>
        </div>
      </Section>

      {/* Section: Preview */}
      <Section title={t("admin:segments.section_preview")} icon={Eye}>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 px-3 py-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={previewLoading}
            className="gap-1.5"
          >
            {previewLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Eye className="size-3.5" />
            )}
            {t("admin:segments.preview")}
          </Button>
          <ChevronDown className="size-3 text-text-dim" aria-hidden />
          {previewCount !== null ? (
            <span className="text-sm">
              <strong className="text-foreground">
                {formatCount(previewCount)}
              </strong>{" "}
              <span className="text-text-muted">
                {t("admin:segments.preview_count")}
              </span>
            </span>
          ) : (
            <span className="text-xs text-text-muted">
              {t("admin:segments.preview_empty")}
            </span>
          )}
        </div>
      </Section>

      {errorMessage && (
        <p className="rounded-lg border border-error-500/20 bg-error-500/[0.04] px-3 py-2 text-xs text-error-600">
          {errorMessage}
        </p>
      )}

      <DialogFooter className="!mt-6">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common:cancel")}
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={loading || !name.trim() || rules.length === 0}
          className="gap-1.5"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {t("common:save")}
        </Button>
      </DialogFooter>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Layers;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <header className="flex items-center gap-2">
        <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-3" />
        </span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {title}
        </h3>
      </header>
      {children}
    </section>
  );
}

// =====================================================================
// RFM Tab
// =====================================================================

function RFMTab() {
  const { t } = useTranslation("admin");
  const q = useQuery({
    queryKey: ["rfm"],
    queryFn: () => adminApi.getRFM(),
    staleTime: 60 * 60_000, // 1 saat
  });

  const data = q.data;
  const totalCustomers = useMemo(() => {
    if (!data?.distribution) return 0;
    return Object.values(data.distribution).reduce(
      (acc, count) => acc + count,
      0,
    );
  }, [data]);

  return (
    <>
      {/* Distribution */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            {t("segments.rfm_distribution_title")}
          </h2>
          {totalCustomers > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
              <Users className="size-3.5 text-text-dim" />
              {t("segments.rfm_total_customers")}:{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {formatCount(totalCustomers)}
              </span>
            </span>
          )}
        </div>

        {q.isPending ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-[88px] animate-pulse rounded-xl bg-muted"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {Object.entries(data?.distribution ?? {}).map(([seg, count]) => {
              const tone = rfmTone(seg);
              const pct =
                totalCustomers > 0 ? (count / totalCustomers) * 100 : 0;
              return (
                <Card key={seg} className="overflow-hidden">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn("size-2 rounded-full", tone.dot)}
                        aria-hidden
                      />
                      <span className="text-xs font-semibold text-text-muted">
                        {seg}
                      </span>
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <p className="text-2xl font-semibold tabular-nums text-foreground">
                        {formatCount(count)}
                      </p>
                      {totalCustomers > 0 && (
                        <span className="text-xs text-text-dim">
                          {pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* RFM Table */}
      <Card className="overflow-hidden">
        <header className="flex items-center justify-between border-b border-border bg-surface-2/50 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            {t("segments.rfm_table_title")}
          </h2>
          {!q.isPending && data && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-text-muted">
              <Users className="size-3" />
              {Math.min(data.rows?.length ?? 0, 1000)}
            </span>
          )}
        </header>
        <CardContent className="p-0">
          {q.isPending ? (
            <TableSkeleton />
          ) : (
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-surface-2 backdrop-blur-sm">
                  <TableRow className="border-b border-border hover:bg-surface-2">
                    <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("segments.rfm_customer")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("segments.rfm_city")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                      R
                    </TableHead>
                    <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                      F
                    </TableHead>
                    <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                      M
                    </TableHead>
                    <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                      {t("segments.rfm_recency")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                      {t("segments.rfm_frequency")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                      {t("segments.rfm_monetary")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("segments.rfm_segment")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.rows ?? []).slice(0, 100).map((r, idx) => {
                    const tone = rfmTone(r.segment);
                    return (
                      <TableRow
                        key={r.customer_id}
                        className={cn(
                          "border-b border-border/60 transition-colors",
                          idx % 2 === 1 && "bg-surface-2/40",
                          "hover:bg-primary/[0.04]",
                        )}
                      >
                        <TableCell className="px-4 py-3">
                          <div className="text-sm font-medium text-foreground">
                            {r.customer_name ?? "—"}
                          </div>
                          <div className="font-mono text-[11px] text-text-dim">
                            {r.customer_id}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-3 text-xs text-text-muted">
                          {r.city ?? (
                            <span className="text-text-dim">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right">
                          <ScoreChip score={r.r_score} />
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right">
                          <ScoreChip score={r.f_score} />
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right">
                          <ScoreChip score={r.m_score} />
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right tabular-nums text-xs text-text-muted">
                          {r.recency_days}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right tabular-nums text-xs text-text-muted">
                          {r.frequency}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right tabular-nums text-xs font-medium text-foreground">
                          {formatCurrency(r.monetary)}
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
                              tone.chip,
                            )}
                          >
                            <span
                              className={cn("size-1.5 rounded-full", tone.dot)}
                              aria-hidden
                            />
                            {r.segment}
                          </span>
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
    </>
  );
}

function ScoreChip({ score }: { score: number }) {
  // 1–5 RFM skoru için ton: 5 yeşil, 1 kırmızı.
  const tone =
    score >= 4
      ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500"
      : score === 3
        ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
        : score === 2
          ? "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-500"
          : "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-500";
  return (
    <span
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md text-xs font-bold tabular-nums",
        tone,
      )}
    >
      {score}
    </span>
  );
}

// =====================================================================
// Helpers
// =====================================================================

function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: typeof Layers;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="inline-flex size-12 items-center justify-center rounded-full bg-muted text-text-muted">
        <Icon className="size-5" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-md text-xs text-text-muted">{body}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-1 gap-1.5">
          <Plus className="size-4" />
          {actionLabel}
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
          <div className="size-7 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-7 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
