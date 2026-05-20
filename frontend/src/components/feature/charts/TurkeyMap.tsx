import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ChartEmpty } from "@/components/feature/charts/ChartEmpty";
import { formatCurrency, formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Türkiye şehir baloncuk haritası — `/dashboard/overview` geo bloğu için.
 *
 * Harici harita kütüphanesi YOK: stilize Türkiye silueti (enlem/boylam
 * poligonu) + ekvanteriktangüler projeksiyonla yerleştirilmiş şehir
 * baloncukları. Baloncuk yarıçapı `sqrt(revenue)` ile orantılı (alan-doğru).
 * Bir şehre tıklamak cross-filter tetikler.
 */

const VB_W = 1000;
const VB_H = 360;
// Projeksiyon sınırları (biraz pay bırakılmış).
const LON_MIN = 25.4;
const LON_MAX = 45.4;
const LAT_MIN = 35.5;
const LAT_MAX = 42.5;

function project(lat: number, lon: number): [number, number] {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * VB_W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * VB_H;
  return [x, y];
}

/** Stilize Türkiye sınır poligonu — [lat, lon] saat yönünde. */
const TR_OUTLINE: [number, number][] = [
  [41.7, 26.6], [41.2, 28.0], [41.1, 29.9], [41.4, 31.8], [42.05, 35.0],
  [41.3, 36.3], [41.1, 38.4], [41.0, 39.7], [41.45, 41.5], [41.2, 43.4],
  [40.0, 43.7], [39.4, 44.4], [38.8, 44.3], [37.7, 44.6], [37.4, 44.2],
  [37.2, 42.5], [37.1, 41.2], [37.3, 40.0], [36.8, 38.8], [36.7, 37.5],
  [36.6, 36.5], [35.9, 36.2], [36.6, 36.0], [36.65, 35.3], [36.8, 34.6],
  [36.6, 33.5], [36.9, 31.5], [36.6, 30.5], [36.2, 29.7], [36.7, 28.5],
  [37.0, 27.3], [38.0, 26.7], [38.4, 26.3], [39.5, 26.6], [40.3, 26.2],
  [40.6, 26.6], [41.0, 26.3], [41.7, 26.6],
];

/** Şehir → [enlem, boylam]. Anahtarlar `orders.city` (İngilizce yazım) ile birebir. */
const CITY_COORDS: Record<string, [number, number]> = {
  Istanbul: [41.01, 28.98], Ankara: [39.93, 32.85], Izmir: [38.42, 27.14],
  Bursa: [40.19, 29.06], Antalya: [36.9, 30.71], Adana: [37.0, 35.32],
  Konya: [37.87, 32.48], Gaziantep: [37.07, 37.38], Mersin: [36.8, 34.63],
  Kayseri: [38.73, 35.49], Samsun: [41.29, 36.33], Trabzon: [41.0, 39.72],
  Eskisehir: [39.78, 30.52], Diyarbakir: [37.91, 40.24], Sanliurfa: [37.17, 38.79],
  Malatya: [38.35, 38.31], Erzurum: [39.9, 41.27], Van: [38.49, 43.41],
  Denizli: [37.78, 29.09], Sakarya: [40.78, 30.4], Kocaeli: [40.77, 29.92],
  Manisa: [38.61, 27.43], Balikesir: [39.65, 27.88], Hatay: [36.2, 36.16],
  Aydin: [37.85, 27.84], Afyonkarahisar: [38.76, 30.54], Tekirdag: [40.98, 27.51],
  Mugla: [37.22, 28.36], Ordu: [40.98, 37.88], Elazig: [38.68, 39.22],
};

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

const OUTLINE_PATH = `${TR_OUTLINE.map(([lat, lon], i) => {
  const [x, y] = project(lat, lon);
  return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
}).join("")}Z`;

export function TurkeyMap({
  data,
  loading,
  selectedCity,
  onCityClick,
}: TurkeyMapProps) {
  const { t } = useTranslation("dashboard");
  const [hover, setHover] = useState<GeoCity | null>(null);

  const bubbles = useMemo(() => {
    const max = Math.max(...data.map((d) => d.revenue), 1);
    return data
      .map((d) => {
        const coord = CITY_COORDS[d.city];
        if (!coord) return null;
        const [x, y] = project(coord[0], coord[1]);
        // Alan-doğru ölçek: r ∝ √value. 5–34px aralığı.
        const r = 5 + Math.sqrt(d.revenue / max) * 29;
        return { ...d, x, y, r };
      })
      .filter((b): b is GeoCity & { x: number; y: number; r: number } => b !== null)
      .sort((a, b) => b.r - a.r); // büyük baloncuklar altta
  }, [data]);

  if (loading) {
    return <div className="h-[340px] w-full animate-pulse rounded-xl bg-muted/40" />;
  }
  if (data.length === 0) {
    return <ChartEmpty />;
  }

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full"
        role="img"
        aria-label={t("overview.geo_card_title")}
      >
        {/* Türkiye silueti */}
        <path
          d={OUTLINE_PATH}
          className="fill-muted/50 stroke-border"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {/* Şehir baloncukları */}
        {bubbles.map((b) => {
          const active = selectedCity === b.city;
          const dim = selectedCity != null && !active;
          return (
            <g
              key={b.city}
              transform={`translate(${b.x} ${b.y})`}
              className="cursor-pointer"
              onMouseEnter={() => setHover(b)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onCityClick?.(b.city)}
            >
              <circle
                r={b.r}
                className={cn(
                  "transition-all duration-150",
                  active
                    ? "fill-primary/85 stroke-primary"
                    : "fill-primary/35 stroke-primary/70 hover:fill-primary/55",
                )}
                strokeWidth={active ? 2 : 1}
                style={{ opacity: dim ? 0.3 : 1 }}
              />
              {b.r > 16 && (
                <text
                  textAnchor="middle"
                  dy="0.34em"
                  className="pointer-events-none fill-primary-foreground text-[10px] font-semibold"
                  style={{ opacity: dim ? 0.3 : 1 }}
                >
                  {b.city}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hover && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-1.5 text-xs shadow-md">
          <span className="font-semibold text-foreground">{hover.city}</span>
          <span className="mx-1.5 text-text-dim">·</span>
          <span className="font-medium text-primary">
            {formatCurrency(hover.revenue)}
          </span>
          <span className="mx-1.5 text-text-dim">·</span>
          <span className="text-text-muted">
            {formatCount(hover.orders)} {t("overview.geo_orders")}
          </span>
        </div>
      )}
    </div>
  );
}
