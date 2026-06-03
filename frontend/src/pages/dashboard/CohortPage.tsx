import { useQuery } from "@tanstack/react-query";
import { BarChart3, Grid3x3, Table2 } from "lucide-react";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/feature/ChartCard";
import { ExportMenu } from "@/components/feature/ExportMenu";
import { BarChart } from "@/components/feature/charts/BarChart";
import { GlobalFilterBar } from "@/components/feature/filters/GlobalFilterBar";
import {
  ColumnSettingsMenu,
  ManagedColumnHeader,
  type SortAccessors,
  useSortedRows,
} from "@/components/feature/table";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { type ColumnDef, useColumnManager } from "@/hooks/useColumnManager";
import { dashboardApi } from "@/lib/api/dashboard";
import { dayjs } from "@/lib/dayjs";
import { formatCount, formatPercent, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useFiltersStore } from "@/stores/useFiltersStore";

import { DashboardHeader, PageShell, useDashboardRange } from "./_shared";

const MAX_OFFSET = 12;

/** Tek bir cohort satiri — tablo ve grafiklerin ortak veri modeli. */
interface CohortRow {
  /** Cohort baslangic ayi (ISO ilk gun). */
  cohort_month: string;
  /** M0 musteri sayisi (cohort boyutu). */
  size: number;
  /** month_offset -> retention yuzdesi (0-100) veya null (veri yok). */
  retention: Map<number, number | null>;
}

/** Belirli bir ay-offsetinin retention yuzdesini dondurur (yoksa null). */
function offsetPct(row: CohortRow, offset: number): number | null {
  return row.retention.get(offset) ?? null;
}

/** Cohort tablosu kolon tanimi (id = stabil localStorage anahtari). */
interface CohortColumn extends ColumnDef {
  width: string;
  numeric?: boolean;
  cell: (row: CohortRow) => ReactNode;
  exportValue: (row: CohortRow) => string | number | null;
}

const COHORT_COLUMNS: CohortColumn[] = [
  {
    id: "cohort",
    labelKey: "cohort.col_cohort",
    required: true,
    width: "w-[150px]",
    cell: (r) => (
      <span className="font-mono text-sm font-semibold text-foreground">
        {dayjs(r.cohort_month).format("YYYY-MM")}
      </span>
    ),
    exportValue: (r) => dayjs(r.cohort_month).format("YYYY-MM"),
  },
  {
    id: "size",
    labelKey: "cohort.col_size",
    width: "w-[120px]",
    numeric: true,
    cell: (r) => (
      <span className="tabular-nums text-sm font-semibold text-foreground">
        {formatCount(r.size)}
      </span>
    ),
    exportValue: (r) => r.size,
  },
  {
    id: "m1",
    labelKey: "cohort.col_m1",
    width: "w-[100px]",
    numeric: true,
    cell: (r) => <RetentionCell value={offsetPct(r, 1)} />,
    exportValue: (r) => offsetPct(r, 1),
  },
  {
    id: "m2",
    labelKey: "cohort.col_m2",
    width: "w-[100px]",
    numeric: true,
    cell: (r) => <RetentionCell value={offsetPct(r, 2)} />,
    exportValue: (r) => offsetPct(r, 2),
  },
  {
    id: "m3",
    labelKey: "cohort.col_m3",
    width: "w-[100px]",
    numeric: true,
    cell: (r) => <RetentionCell value={offsetPct(r, 3)} />,
    exportValue: (r) => offsetPct(r, 3),
  },
  {
    id: "m6",
    labelKey: "cohort.col_m6",
    width: "w-[100px]",
    numeric: true,
    cell: (r) => <RetentionCell value={offsetPct(r, 6)} />,
    exportValue: (r) => offsetPct(r, 6),
  },
];

/** Tablo hucresinde retention yuzdesini renkli pill ile gosterir. */
function RetentionCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-text-dim">—</span>;
  const tone =
    value >= 50
      ? "bg-success-50 text-success-700 ring-success-100 dark:bg-success-500/10 dark:text-success-500 dark:ring-success-500/20"
      : value >= 20
        ? "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20"
        : "bg-muted text-text-muted ring-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset",
        tone,
      )}
    >
      {formatPercent(value, 1)}
    </span>
  );
}

/**
 * Cohort / Retention sayfasi. Backend /dashboard/cohort endpoint'i
 * date_from/date_to + genders/age_groups/cities filtrelerini kabul eder; bu
 * yuzden GlobalFilterBar bu uc alanla (ve gelismis aralik paneliyle) gosterilir,
 * secili degerler query'ye gecirilir. Retention heatmap'i, cohort buyukluk
 * grafigi ve kolon-siralanabilir / -ozellestirilebilir + disa aktarilabilir
 * cohort tablosu sunar. Cross-filter cohort icin anlamli olmadigindan eklenmez.
 */
export default function CohortPage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useDashboardRange();

  const cohortColumns = useColumnManager("cohort-table", COHORT_COLUMNS);

  const genders = useFiltersStore((s) => s.selected_genders);
  const ageGroups = useFiltersStore((s) => s.selected_age_groups);
  const cities = useFiltersStore((s) => s.selected_cities);

  const q = useQuery({
    queryKey: [
      "dashboard",
      "cohort",
      range.date_from,
      range.date_to,
      genders,
      ageGroups,
      cities,
    ],
    queryFn: () =>
      dashboardApi.cohort({
        date_from: range.date_from,
        date_to: range.date_to,
        genders: genders.length ? genders : undefined,
        age_groups: ageGroups.length ? ageGroups : undefined,
        cities: cities.length ? cities : undefined,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const cells = useMemo(() => q.data?.cells ?? [], [q.data?.cells]);
  const isLoading = q.isPending;

  // Hucreleri cohort -> ay-offset matrisine cevir (tek gecis).
  const rows = useMemo<CohortRow[]>(() => {
    const map = new Map<string, CohortRow>();
    for (const c of cells) {
      let row = map.get(c.cohort_month);
      if (!row) {
        row = { cohort_month: c.cohort_month, size: 0, retention: new Map() };
        map.set(c.cohort_month, row);
      }
      row.retention.set(c.month_offset, toNumber(c.retention_pct));
      if (c.month_offset === 0) row.size = c.customer_count;
    }
    return Array.from(map.values()).sort((a, b) =>
      a.cohort_month < b.cohort_month ? -1 : a.cohort_month > b.cohort_month ? 1 : 0,
    );
  }, [cells]);

  // Tablo kolon siralamasi: cohort ay (ISO string) + boyut/retention sayisal.
  // Retention degerleri zaten sayi (toNumber ile cevrilmis) veya null. Varsayilan
  // (sortColumnId=null) backend cohort-ay sirasini korur.
  const sortAccessors = useMemo<SortAccessors<CohortRow>>(
    () => ({
      cohort: (r) => r.cohort_month,
      size: (r) => r.size,
      m1: (r) => offsetPct(r, 1),
      m2: (r) => offsetPct(r, 2),
      m3: (r) => offsetPct(r, 3),
      m6: (r) => offsetPct(r, 6),
    }),
    [],
  );

  const sortedRows = useSortedRows(
    rows,
    sortAccessors,
    cohortColumns.sortColumnId,
    cohortColumns.sortDir,
  );

  const exportColumns = useMemo(
    () =>
      cohortColumns.visibleColumns.map((col) => ({
        header: t(col.labelKey),
        accessor: col.exportValue,
      })),
    [cohortColumns.visibleColumns, t],
  );

  // Cohort buyukluk grafigi — backend customer_count degerini dogrudan cizer.
  const sizeCategories = useMemo(
    () => rows.map((r) => dayjs(r.cohort_month).format("YYYY-MM")),
    [rows],
  );
  const sizeValues = useMemo(() => rows.map((r) => r.size), [rows]);

  return (
    <PageShell>
      <div className="sticky top-0 z-20 -mx-1 space-y-3 bg-background/85 px-1 pb-3 pt-1 backdrop-blur">
        <DashboardHeader title={t("cohort.title")} range={range} onChangeRange={setRange} />
        <GlobalFilterBar fields={["genders", "age_groups", "cities"]} showRanges />
      </div>

      {/* Retention heatmap */}
      <ChartCard
        title={t("cohort.heatmap_card_title")}
        hint={t("cohort.heatmap_hint")}
        icon={Grid3x3}
        action={
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span>{t("cohort.legend_low")}</span>
            <span className="h-3 w-20 rounded-full bg-gradient-to-r from-emerald-500/15 to-emerald-500" />
            <span>{t("cohort.legend_high")}</span>
          </div>
        }
      >
        {isLoading ? (
          <div className="h-64 animate-pulse rounded-lg bg-muted/40" />
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-text-muted">{t("cohort.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-border bg-surface-2 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                    {t("cohort.col_cohort")}
                  </th>
                  <th className="border-b border-border bg-surface-2 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                    {t("cohort.col_size")}
                  </th>
                  {Array.from({ length: MAX_OFFSET + 1 }).map((_, i) => (
                    <th
                      key={i}
                      className="border-b border-border bg-surface-2 px-1 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-text-dim"
                    >
                      {t("cohort.month_offset_short")}
                      {i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.cohort_month} className="border-b border-border/60">
                    <td className="sticky left-0 z-10 bg-card px-3 py-2 font-mono text-xs font-semibold text-foreground">
                      {dayjs(row.cohort_month).format("YYYY-MM")}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-text-muted">
                      {formatCount(row.size)}
                    </td>
                    {Array.from({ length: MAX_OFFSET + 1 }).map((_, i) => {
                      const pct = row.retention.get(i) ?? null;
                      if (pct === null) {
                        return (
                          <td key={i} className="px-0.5 py-1">
                            <div className="h-8 rounded-md bg-muted/20" />
                          </td>
                        );
                      }
                      const intensity = Math.min(pct / 100, 1);
                      return (
                        <td key={i} className="px-0.5 py-1">
                          <div
                            className={cn(
                              "flex h-8 items-center justify-center rounded-md text-xs font-semibold",
                              pct >= 50 ? "text-white" : "text-foreground",
                            )}
                            style={{
                              backgroundColor: `rgba(18, 183, 106, ${0.1 + intensity * 0.85})`,
                            }}
                            title={`${dayjs(row.cohort_month).format("YYYY-MM")} / ${t("cohort.month_offset_short")}${i}: ${formatCount(row.retention.get(i) ?? 0)} (${pct.toFixed(1)}%)`}
                          >
                            <span className="tabular-nums">
                              {pct > 0 ? `${pct.toFixed(0)}%` : ""}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      {/* Cohort buyukluk grafigi */}
      <ChartCard
        title={t("cohort.sizes_chart_title")}
        hint={t("cohort.sizes_chart_hint")}
        icon={BarChart3}
      >
        <BarChart
          categories={sizeCategories}
          series={[{ name: t("cohort.sizes_series"), data: sizeValues }]}
          loading={isLoading}
          height={300}
          valueFormatter={formatCount}
        />
      </ChartCard>

      {/* Cohort tablosu */}
      <ChartCard
        title={t("cohort.table_title")}
        hint={t("cohort.table_hint")}
        icon={Table2}
        contentClassName="p-0"
        action={
          <div className="flex items-center gap-2">
            <ExportMenu
              rows={sortedRows}
              columns={exportColumns}
              fileBase="cohort"
              dateFrom={range.date_from}
              dateTo={range.date_to}
              sheetName={t("cohort.table_title")}
            />
            <ColumnSettingsMenu manager={cohortColumns} ns="dashboard" />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <colgroup>
              {cohortColumns.visibleColumns.map((col) => (
                <col key={col.id} className={col.width} />
              ))}
            </colgroup>
            <ManagedColumnHeader
              manager={cohortColumns}
              ns="dashboard"
              headClassName={(col) => (col.numeric ? "text-right" : undefined)}
            />
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell
                      colSpan={cohortColumns.visibleColumns.length}
                      className="px-4 py-3.5"
                    >
                      <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                    </TableCell>
                  </TableRow>
                ))
              ) : sortedRows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={cohortColumns.visibleColumns.length}
                    className="py-12 text-center text-sm text-text-muted"
                  >
                    {t("cohort.table_empty")}
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((row) => (
                  <TableRow
                    key={row.cohort_month}
                    className="border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
                  >
                    {cohortColumns.visibleColumns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn("px-3 py-3.5", col.numeric && "text-right")}
                      >
                        {col.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ChartCard>
    </PageShell>
  );
}
