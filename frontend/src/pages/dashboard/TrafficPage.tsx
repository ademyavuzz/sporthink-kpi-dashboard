import { useQuery } from "@tanstack/react-query";
import { FileText, MapPin, Radio, Smartphone, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/feature/ChartCard";
import { ExportMenu } from "@/components/feature/ExportMenu";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { BarChart } from "@/components/feature/charts/BarChart";
import { LineChart } from "@/components/feature/charts/LineChart";
import { GlobalFilterBar } from "@/components/feature/filters/GlobalFilterBar";
import { ColumnSettingsMenu, ManagedColumnHeader } from "@/components/feature/table";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { type ColumnDef, useColumnManager } from "@/hooks/useColumnManager";
import { dashboardApi } from "@/lib/api/dashboard";
import { dayjs } from "@/lib/dayjs";
import {
  formatAxisNumber,
  formatCount,
  formatDurationSeconds,
  formatPercent,
  toNumber,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useFiltersStore } from "@/stores/useFiltersStore";
import type { LandingPageRow } from "@/types/dashboard";

import { DashboardHeader, PageShell, useDashboardRange } from "./_shared";

/**
 * Trafik (GA4) sayfasi. 7 trafik KPI'si, gunluk oturum trendi, kanal/cihaz
 * kirilimleri, sehir bazli trafik ve kolon-ozellestirilebilir/disa
 * aktarilabilir acilis sayfalari tablosu. Kanal, cihaz ve sehir filtreleri
 * cross-filter olarak query'ye baglidir.
 */

/** Acilis sayfalari tablosu kolon tanimi (id = stabil localStorage anahtari). */
interface LandingColumn extends ColumnDef {
  /** Kolonun colgroup genisligi. */
  width: string;
  /** Saga hizali sayisal kolon mu? */
  numeric?: boolean;
  /** Tek satir icin hucre icerigini render eder (idx: 0 tabanli sira). */
  cell: (row: LandingPageRow, idx: number, maxSessions: number) => ReactNode;
  /** Disa aktarmada kullanilacak ham hucre degeri (formatsiz). */
  exportValue: (row: LandingPageRow, idx: number) => string | number | null;
}

const LANDING_COLUMNS: LandingColumn[] = [
  {
    id: "rank",
    labelKey: "traffic.landing_col_rank",
    required: true,
    width: "w-[52px]",
    cell: (_r, idx) => (
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-md text-[11px] font-bold tabular-nums",
          idx < 3 ? "bg-primary/10 text-primary" : "bg-muted text-text-muted",
        )}
      >
        {idx + 1}
      </span>
    ),
    exportValue: (_r, idx) => idx + 1,
  },
  {
    id: "page",
    labelKey: "traffic.landing_col_page",
    required: true,
    width: "w-auto",
    cell: (r) => (
      <span
        className="block truncate font-mono text-xs text-foreground"
        title={r.page_path}
      >
        {r.page_path}
      </span>
    ),
    exportValue: (r) => r.page_path,
  },
  {
    id: "sessions",
    labelKey: "traffic.landing_col_sessions",
    width: "w-[170px]",
    numeric: true,
    cell: (r, _idx, maxSessions) => {
      const barPct = (r.sessions / maxSessions) * 100;
      return (
        <div className="flex items-center justify-end gap-2">
          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted/50 sm:block">
            <div
              className="h-full rounded-full bg-blue-500/70"
              style={{ width: `${Math.max(barPct, 3)}%` }}
            />
          </div>
          <span className="tabular-nums text-sm font-semibold text-foreground">
            {formatCount(r.sessions)}
          </span>
        </div>
      );
    },
    exportValue: (r) => r.sessions,
  },
  {
    id: "users",
    labelKey: "traffic.landing_col_users",
    width: "w-[110px]",
    numeric: true,
    cell: (r) => (
      <span className="tabular-nums text-sm text-text-muted">
        {formatCount(r.users)}
      </span>
    ),
    exportValue: (r) => r.users,
  },
  {
    id: "bounce",
    labelKey: "traffic.landing_col_bounce",
    width: "w-[120px]",
    numeric: true,
    cell: (r) => (
      <span className="tabular-nums text-sm text-text-muted">
        {r.bounce_rate !== null ? formatPercent(r.bounce_rate, 1) : "—"}
      </span>
    ),
    exportValue: (r) => toNumber(r.bounce_rate),
  },
  {
    id: "duration",
    labelKey: "traffic.landing_col_duration",
    width: "w-[120px]",
    numeric: true,
    cell: (r) => (
      <span className="tabular-nums text-sm text-text-muted">
        {r.avg_session_duration !== null
          ? formatDurationSeconds(r.avg_session_duration)
          : "—"}
      </span>
    ),
    exportValue: (r) => toNumber(r.avg_session_duration),
  },
  {
    id: "conversion",
    labelKey: "traffic.landing_col_conversion",
    width: "w-[120px]",
    numeric: true,
    cell: (r) => (
      <span className="tabular-nums text-sm">
        {r.conversion_rate !== null ? formatPercent(r.conversion_rate, 2) : "—"}
      </span>
    ),
    exportValue: (r) => toNumber(r.conversion_rate),
  },
];

export default function TrafficPage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useDashboardRange();
  const channels = useFiltersStore((s) => s.selected_channels);
  const devices = useFiltersStore((s) => s.selected_devices);
  const cities = useFiltersStore((s) => s.selected_cities);

  const landingColumns = useColumnManager("traffic-landing-pages", LANDING_COLUMNS);

  const q = useQuery({
    queryKey: ["dashboard", "traffic", range.date_from, range.date_to, channels, devices, cities],
    queryFn: () =>
      dashboardApi.traffic({
        date_from: range.date_from,
        date_to: range.date_to,
        channels: channels.length ? channels : undefined,
        devices: devices.length ? devices : undefined,
        cities: cities.length ? cities : undefined,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;
  const sessionsLabel = t("traffic.series_sessions");
  const fmtSessions = (v: number) =>
    `${formatAxisNumber(v)} ${t("traffic.value_sessions_suffix")}`;

  const landingRows = useMemo(() => data?.landing_pages ?? [], [data]);
  const maxSessions = useMemo(
    () => Math.max(...landingRows.map((r) => r.sessions), 1),
    [landingRows],
  );
  const landingExportColumns = useMemo(
    () =>
      landingColumns.visibleColumns.map((col) => ({
        header: t(col.labelKey),
        accessor: (row: LandingPageRow) => col.exportValue(row, landingRows.indexOf(row)),
      })),
    [landingColumns.visibleColumns, landingRows, t],
  );

  return (
    <PageShell>
      <div className="sticky top-0 z-20 -mx-1 space-y-3 bg-background/85 px-1 pb-3 pt-1 backdrop-blur">
        <DashboardHeader title={t("traffic.title")} range={range} onChangeRange={setRange} />
        <GlobalFilterBar fields={["channels", "devices", "cities"]} />
      </div>

      {/* Trafik KPI'lari */}
      <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-4 xl:grid-cols-7">
        {isLoading || !data
          ? Array.from({ length: 7 }).map((_, i) => <KPICardSkeleton key={i} compact />)
          : (
              <>
                <KPICard kpi={data.sessions} compact />
                <KPICard kpi={data.users} compact />
                <KPICard kpi={data.new_users} compact />
                <KPICard kpi={data.bounce_rate} compact />
                <KPICard kpi={data.pages_per_session} compact />
                <KPICard kpi={data.avg_session_duration} compact />
                <KPICard kpi={data.conversion_rate} compact />
              </>
            )}
      </div>

      {/* Gunluk oturum trendi */}
      <ChartCard
        title={t("traffic.trend_card_title")}
        hint={t("traffic.trend_hint")}
        icon={TrendingUp}
      >
        <LineChart
          loading={isLoading}
          height={320}
          series={
            data
              ? [
                  {
                    name: sessionsLabel,
                    color: "#2563eb",
                    data: data.daily_series.map((p) => ({
                      x: dayjs(p.date).valueOf(),
                      y: p.sessions,
                    })),
                    formatter: formatCount,
                  },
                  {
                    name: t("traffic.series_users"),
                    color: "#10b981",
                    data: data.daily_series.map((p) => ({
                      x: dayjs(p.date).valueOf(),
                      y: p.users,
                    })),
                    formatter: formatCount,
                  },
                  {
                    name: t("traffic.series_new_users"),
                    color: "#7a5af8",
                    data: data.daily_series.map((p) => ({
                      x: dayjs(p.date).valueOf(),
                      y: p.new_users,
                    })),
                    formatter: formatCount,
                  },
                ]
              : []
          }
          yFormatter={formatAxisNumber}
        />
      </ChartCard>

      {/* Kanal + Cihaz kirilimi */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("traffic.by_channel_card_title")}
          hint={t("traffic.by_channel_hint")}
          icon={Radio}
          className="h-full self-stretch"
        >
          <BarChart
            loading={isLoading}
            horizontal
            height={340}
            categories={
              data
                ? data.by_channel.map((c) => c.label ?? t("traffic.label_other"))
                : []
            }
            series={
              data
                ? [
                    {
                      name: sessionsLabel,
                      data: data.by_channel.map((c) => toNumber(c.value) ?? 0),
                    },
                  ]
                : []
            }
            valueFormatter={fmtSessions}
          />
        </ChartCard>

        <ChartCard
          title={t("traffic.by_device_card_title")}
          hint={t("traffic.by_device_hint")}
          icon={Smartphone}
          className="h-full self-stretch"
        >
          <BarChart
            loading={isLoading}
            height={340}
            categories={
              data
                ? data.by_device.map((d) => d.label ?? t("traffic.label_other"))
                : []
            }
            series={
              data
                ? [
                    {
                      name: sessionsLabel,
                      data: data.by_device.map((d) => toNumber(d.value) ?? 0),
                    },
                  ]
                : []
            }
            valueFormatter={fmtSessions}
          />
        </ChartCard>
      </div>

      {/* Sehir bazli trafik */}
      <ChartCard
        title={t("traffic.by_city_card_title")}
        hint={t("traffic.by_city_hint")}
        icon={MapPin}
      >
        <BarChart
          loading={isLoading}
          horizontal
          height={420}
          categories={
            data ? data.by_city.map((c) => c.label ?? t("traffic.label_other")) : []
          }
          series={
            data
              ? [
                  {
                    name: sessionsLabel,
                    data: data.by_city.map((c) => toNumber(c.value) ?? 0),
                  },
                ]
              : []
          }
          valueFormatter={fmtSessions}
        />
      </ChartCard>

      {/* Acilis sayfalari */}
      <ChartCard
        title={t("traffic.landing_pages_card_title")}
        hint={t("traffic.landing_pages_hint")}
        icon={FileText}
        contentClassName="p-0"
        action={
          <div className="flex items-center gap-2">
            <ExportMenu
              rows={landingRows}
              columns={landingExportColumns}
              fileBase="traffic-landing-pages"
              dateFrom={range.date_from}
              dateTo={range.date_to}
              sheetName={t("traffic.landing_pages_card_title")}
            />
            <ColumnSettingsMenu manager={landingColumns} ns="dashboard" />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <colgroup>
              {landingColumns.visibleColumns.map((col) => (
                <col key={col.id} className={col.width} />
              ))}
            </colgroup>
            <ManagedColumnHeader
              manager={landingColumns}
              ns="dashboard"
              headClassName={(col) => (col.numeric ? "text-right" : undefined)}
            />
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell
                      colSpan={landingColumns.visibleColumns.length}
                      className="px-4 py-3.5"
                    >
                      <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                    </TableCell>
                  </TableRow>
                ))
              ) : landingRows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={landingColumns.visibleColumns.length}
                    className="py-12 text-center text-sm text-text-muted"
                  >
                    {t("traffic.landing_pages_empty")}
                  </TableCell>
                </TableRow>
              ) : (
                landingRows.map((r, idx) => (
                  <TableRow
                    key={r.page_path}
                    className="border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
                  >
                    {landingColumns.visibleColumns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn("px-3 py-3.5", col.numeric && "text-right")}
                      >
                        {col.cell(r, idx, maxSessions)}
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
