import { MapPin, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cities as turkeyCities } from "turkey-map-react/lib/data";

import { ChartEmpty } from "@/components/feature/charts/ChartEmpty";
import { formatCurrency, formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface GeoCity {
  city: string;
  revenue: number;
  orders: number;
}

interface TurkeyMapProps {
  data: GeoCity[];
  loading?: boolean;
  selectedCity?: string | null;
  onCityClick?: (city: string) => void;
}

type TurkeyCityPath = {
  id: string;
  plateNumber: number;
  name: string;
  path: string;
};

const LABEL_POINTS: Record<string, { x: number; y: number }> = {
  Istanbul: { x: 235, y: 216 },
  Tekirdag: { x: 162, y: 220 },
  Kocaeli: { x: 292, y: 236 },
  Sakarya: { x: 326, y: 235 },
  Bursa: { x: 254, y: 315 },
  Balikesir: { x: 180, y: 337 },
  Izmir: { x: 130, y: 430 },
  Manisa: { x: 165, y: 395 },
  Aydin: { x: 142, y: 474 },
  Mugla: { x: 190, y: 520 },
  Denizli: { x: 250, y: 455 },
  Antalya: { x: 355, y: 545 },
  Afyonkarahisar: { x: 345, y: 395 },
  Eskisehir: { x: 355, y: 320 },
  Ankara: { x: 470, y: 335 },
  Konya: { x: 485, y: 470 },
  Mersin: { x: 610, y: 555 },
  Adana: { x: 655, y: 520 },
  Hatay: { x: 715, y: 600 },
  Kayseri: { x: 625, y: 405 },
  Samsun: { x: 625, y: 215 },
  Ordu: { x: 710, y: 220 },
  Trabzon: { x: 820, y: 220 },
  Gaziantep: { x: 750, y: 505 },
  Sanliurfa: { x: 830, y: 480 },
  Diyarbakir: { x: 865, y: 405 },
  Malatya: { x: 755, y: 400 },
  Elazig: { x: 800, y: 380 },
  Erzurum: { x: 900, y: 300 },
  Van: { x: 1000, y: 405 },
};

function normalizeCityName(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "");
}

function formatShare(value: number): string {
  return `%${value.toFixed(1).replace(".", ",")}`;
}

export function TurkeyMap({
  data,
  loading,
  selectedCity,
  onCityClick,
}: TurkeyMapProps) {
  const { t } = useTranslation("dashboard");
  const [hoveredCity, setHoveredCity] = useState<GeoCity | null>(null);

  const sorted = useMemo(
    () => [...data].sort((a, b) => b.revenue - a.revenue),
    [data],
  );
  const cityStats = useMemo(() => {
    const stats = new Map<string, GeoCity>();
    for (const city of data) stats.set(normalizeCityName(city.city), city);
    return stats;
  }, [data]);
  const totalRevenue = useMemo(
    () => sorted.reduce((sum, city) => sum + city.revenue, 0),
    [sorted],
  );
  const totalOrders = useMemo(
    () => sorted.reduce((sum, city) => sum + city.orders, 0),
    [sorted],
  );
  const maxRevenue = sorted[0]?.revenue ?? 1;
  const focusCity =
    hoveredCity ??
    (selectedCity ? sorted.find((city) => city.city === selectedCity) : null) ??
    sorted[0] ??
    null;
  const selectedKey = selectedCity ? normalizeCityName(selectedCity) : null;
  const topMarkers = sorted
    .filter((city) => LABEL_POINTS[city.city])
    .slice(0, 8);

  if (loading) {
    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="h-[420px] animate-pulse rounded-md bg-muted/45" />
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-muted/45" />
          ))}
        </div>
      </div>
    );
  }

  if (sorted.length === 0) {
    return <ChartEmpty height={360} />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border/70 bg-surface-2/35 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase text-text-dim">
              {focusCity?.city ?? t("overview.geo_card_title")}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {focusCity ? formatCurrency(focusCity.revenue) : "—"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>{t("overview.geo_map_legend_low")}</span>
            <span className="h-2 w-24 rounded-full bg-gradient-to-r from-primary/20 to-primary ring-1 ring-inset ring-border/60" />
            <span>{t("overview.geo_map_legend_high")}</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-md border border-border/70 bg-card p-4">
          <svg
            viewBox="0 80 1050 585"
            role="img"
            aria-label={t("overview.geo_card_title")}
            className="h-auto w-full"
          >
            <g>
              {(turkeyCities as TurkeyCityPath[]).map((mapCity) => {
                const key = normalizeCityName(mapCity.name);
                const stat = cityStats.get(key);
                const active = selectedKey === key;
                const ratio = stat ? Math.sqrt(stat.revenue / maxRevenue) : 0;
                const fillOpacity = active ? 0.95 : stat ? 0.32 + ratio * 0.6 : 0.06;
                return (
                  <path
                    key={mapCity.id}
                    d={mapCity.path}
                    tabIndex={stat ? 0 : -1}
                    role={stat ? "button" : "img"}
                    aria-label={
                      stat
                        ? `${stat.city}: ${formatCurrency(stat.revenue)}`
                        : mapCity.name
                    }
                    className={cn(
                      "stroke-border transition-all duration-150 focus-visible:outline-none",
                      stat
                        ? "cursor-pointer hover:stroke-primary"
                        : "cursor-default",
                    )}
                    style={{
                      fill: stat ? "var(--primary)" : "var(--surface-3)",
                      fillOpacity,
                      strokeWidth: active ? 2.2 : stat ? 1.2 : 0.8,
                      filter: active
                        ? "drop-shadow(0 4px 10px rgba(233, 69, 96, 0.28))"
                        : undefined,
                    }}
                    onMouseEnter={() => setHoveredCity(stat ?? null)}
                    onMouseLeave={() => setHoveredCity(null)}
                    onFocus={() => setHoveredCity(stat ?? null)}
                    onBlur={() => setHoveredCity(null)}
                    onClick={() => {
                      if (stat) onCityClick?.(stat.city);
                    }}
                    onKeyDown={(event) => {
                      if (!stat) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onCityClick?.(stat.city);
                      }
                    }}
                  />
                );
              })}
            </g>

            {topMarkers.map((city, index) => {
              const point = LABEL_POINTS[city.city];
              if (!point) return null;
              const active = selectedCity === city.city;
              const size = 8 + Math.sqrt(city.revenue / maxRevenue) * 16;
              return (
                <g
                  key={city.city}
                  transform={`translate(${point.x} ${point.y})`}
                  className="pointer-events-none"
                >
                  <circle
                    r={size}
                    className={cn(
                      active ? "fill-primary" : "fill-primary/35",
                      "stroke-primary",
                    )}
                    strokeWidth={active ? 2 : 1.2}
                  />
                  {index < 4 && (
                    <text
                      y={-(size + 8)}
                      textAnchor="middle"
                      className="fill-foreground text-[18px] font-semibold"
                    >
                      {city.city}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat
            label={t("overview.geo_orders")}
            value={formatCount(focusCity?.orders ?? 0)}
          />
          <MiniStat
            label={t("overview.geo_revenue_share")}
            value={
              focusCity && totalRevenue > 0
                ? formatShare((focusCity.revenue / totalRevenue) * 100)
                : "—"
            }
          />
          <MiniStat
            label={t("overview.geo_total_revenue")}
            value={formatCurrency(totalRevenue)}
          />
          <MiniStat
            label={t("overview.geo_total_orders")}
            value={formatCount(totalOrders)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sorted.slice(0, 6).map((city, index) => {
          const share = totalRevenue > 0 ? (city.revenue / totalRevenue) * 100 : 0;
          const width = (city.revenue / maxRevenue) * 100;
          const active = selectedCity === city.city;
          return (
            <button
              key={city.city}
              type="button"
              onClick={() => onCityClick?.(city.city)}
              onMouseEnter={() => setHoveredCity(city)}
              onMouseLeave={() => setHoveredCity(null)}
              className={cn(
                "group w-full rounded-md border px-3 py-3 text-left transition-colors",
                active
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/70 bg-card hover:border-primary/25 hover:bg-surface-2/70",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tabular-nums",
                      index < 3
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-text-muted",
                    )}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {city.city}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {formatCount(city.orders)} {t("overview.geo_orders")}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(city.revenue)}
                  </p>
                  <p className="text-xs tabular-nums text-text-muted">
                    {formatShare(share)}
                  </p>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    active ? "bg-primary" : "bg-primary/65 group-hover:bg-primary",
                  )}
                  style={{ width: `${Math.max(width, 4)}%` }}
                />
              </div>
            </button>
          );
        })}

        <div className="rounded-md border border-border/70 bg-surface-2/35 p-3 text-xs sm:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-medium text-text-muted">
              <TrendingUp className="size-3.5 text-emerald-500" />
              {t("overview.geo_total_revenue")}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatCurrency(totalRevenue)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-text-muted">
              <MapPin className="size-3.5 text-primary" />
              {t("overview.geo_total_orders")}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatCount(totalOrders)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-card px-3 py-2">
      <p className="text-[11px] font-medium text-text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
