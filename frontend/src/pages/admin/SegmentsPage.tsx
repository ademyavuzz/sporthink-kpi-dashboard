import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type {
  SegmentCreate,
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

const RFM_COLORS: Record<string, string> = {
  Champions: "bg-emerald-500/80",
  Loyal: "bg-cyan-500/80",
  "Potential Loyalist": "bg-blue-500/80",
  New: "bg-violet-500/80",
  "At Risk": "bg-amber-500/80",
  Lost: "bg-rose-500/80",
  Other: "bg-slate-400/80",
};

export default function SegmentsPage() {
  const { t } = useTranslation("admin");
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">{t("segments.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("segments.subtitle")}
        </p>
      </div>

      <Tabs defaultValue="custom">
        <TabsList>
          <TabsTrigger value="custom">{t("segments.tab_custom")}</TabsTrigger>
          <TabsTrigger value="rfm">{t("segments.tab_rfm")}</TabsTrigger>
        </TabsList>
        <TabsContent value="custom" className="space-y-4">
          <CustomSegmentsTab />
        </TabsContent>
        <TabsContent value="rfm" className="space-y-4">
          <RFMTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CustomSegmentsTab() {
  const { t } = useTranslation(["admin", "common"]);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["segments"],
    queryFn: () => adminApi.listSegments(),
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: (p: SegmentCreate) => adminApi.createSegment(p),
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["segments"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteSegment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["segments"] }),
  });

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("admin:segments.new_segment")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin:segments.table_name")}</TableHead>
                <TableHead>{t("admin:segments.table_description")}</TableHead>
                <TableHead>{t("admin:segments.table_customer_count")}</TableHead>
                <TableHead>{t("admin:segments.table_shared")}</TableHead>
                <TableHead className="text-right">{t("admin:segments.table_actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isPending ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    {t("common:loading")}
                  </TableCell>
                </TableRow>
              ) : (q.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {t("admin:segments.no_segments")}
                  </TableCell>
                </TableRow>
              ) : (
                (q.data ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {s.description ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {s.cached_count !== null ? formatCount(s.cached_count) : "—"}
                    </TableCell>
                    <TableCell>
                      {s.is_shared ? <Badge>{t("admin:segments.shared_badge")}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMut.mutate(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("admin:segments.new_segment")}</DialogTitle>
          </DialogHeader>
          <SegmentBuilder
            onSubmit={(p) => createMut.mutate(p)}
            loading={createMut.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function SegmentBuilder({
  onSubmit,
  loading,
}: {
  onSubmit: (p: SegmentCreate) => void;
  loading: boolean;
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t("admin:segments.field_name")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>{t("admin:segments.field_description")}</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t("admin:segments.field_logic")}</Label>
        <Select value={logic} onValueChange={(v) => setLogic(v as "AND" | "OR")}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">{t("admin:segments.logic_and")}</SelectItem>
            <SelectItem value="OR">{t("admin:segments.logic_or")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t("admin:segments.rules_label")}</Label>
        {rules.map((rule, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_120px_1fr_auto] gap-2 items-center">
            <Select
              value={rule.field}
              onValueChange={(v) => updateRule(idx, { field: v as SegmentRuleField })}
            >
              <SelectTrigger>
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
              onValueChange={(v) => updateRule(idx, { op: v as SegmentRuleOp })}
            >
              <SelectTrigger>
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
                  value: !isNaN(num) && v !== "" && /^[-\d.]+$/.test(v) ? num : v,
                });
              }}
              placeholder={t("admin:segments.rule_value_placeholder")}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => removeRule(idx)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addRule}>
          <Plus className="h-4 w-4 mr-1" />
          {t("admin:segments.add_rule")}
        </Button>
      </div>

      <div className="flex items-center gap-3 py-2">
        <Button type="button" variant="outline" onClick={handlePreview} disabled={previewLoading}>
          {previewLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t("admin:segments.preview")}
        </Button>
        {previewCount !== null && (
          <span className="text-sm">
            <strong>{formatCount(previewCount)}</strong> {t("admin:segments.preview_count")}
          </span>
        )}
      </div>

      <DialogFooter>
        <Button
          onClick={() =>
            onSubmit({
              name,
              description: description || undefined,
              rules: { op: logic, rules },
            })
          }
          disabled={loading || !name}
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t("common:save")}
        </Button>
      </DialogFooter>
    </div>
  );
}

function RFMTab() {
  const { t } = useTranslation("admin");
  const q = useQuery({
    queryKey: ["rfm"],
    queryFn: () => adminApi.getRFM(),
    staleTime: 60 * 60_000, // 1 saat
  });

  const data = q.data;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("segments.rfm_distribution_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isPending ? (
            <div className="h-32 bg-muted/40 rounded animate-pulse" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(data?.distribution ?? {}).map(([seg, count]) => (
                <div key={seg} className="p-3 rounded-lg border space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${RFM_COLORS[seg] ?? "bg-slate-400"}`}
                    />
                    <span className="text-xs font-medium">{seg}</span>
                  </div>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatCount(count)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("segments.rfm_table_title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>{t("segments.rfm_customer")}</TableHead>
                  <TableHead>{t("segments.rfm_city")}</TableHead>
                  <TableHead className="text-right">{t("segments.rfm_r_score")}</TableHead>
                  <TableHead className="text-right">{t("segments.rfm_f_score")}</TableHead>
                  <TableHead className="text-right">{t("segments.rfm_m_score")}</TableHead>
                  <TableHead className="text-right">{t("segments.rfm_recency")}</TableHead>
                  <TableHead className="text-right">{t("segments.rfm_frequency")}</TableHead>
                  <TableHead className="text-right">{t("segments.rfm_monetary")}</TableHead>
                  <TableHead>{t("segments.rfm_segment")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.rows ?? []).slice(0, 100).map((r) => (
                  <TableRow key={r.customer_id}>
                    <TableCell>
                      <div className="text-sm">{r.customer_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {r.customer_id}
                      </div>
                    </TableCell>
                    <TableCell>{r.city ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {r.r_score}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {r.f_score}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {r.m_score}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.recency_days}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.frequency}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.monetary)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${RFM_COLORS[r.segment] ?? ""} text-white border-transparent`}
                      >
                        {r.segment}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
