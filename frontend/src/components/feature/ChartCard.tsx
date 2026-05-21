import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type IconCmp = React.ComponentType<{ className?: string }>;

interface ChartCardProps {
  /** Kart basligi. */
  title: string;
  /** Baslik altinda kucuk aciklama satiri. */
  hint?: string;
  /** Baslik solunda ikon. */
  icon?: IconCmp;
  /** Baslik sagindaki aksiyon alani (toggle, buton vb.). */
  action?: ReactNode;
  className?: string;
  /** CardContent'e ek sinif (orn: p-0 tablo icin). */
  contentClassName?: string;
  children: ReactNode;
}

/**
 * Tum dashboard sayfalarinda grafik/tablo kartlari icin tutarli sarmalayici.
 * Ikon + baslik + ipucu satiri ile profesyonel, ayni hizada baslik yapisi.
 */
export function ChartCard({
  title,
  hint,
  icon: Icon,
  action,
  className,
  contentClassName,
  children,
}: ChartCardProps) {
  return (
    <Card className={cn("h-fit self-start gap-0 overflow-hidden", className)}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b border-border/70 bg-surface-2/40 py-4">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            {Icon && (
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/10">
                <Icon className="size-3.5 text-primary" />
              </span>
            )}
            <span className="truncate">{title}</span>
          </CardTitle>
          {hint && <p className="mt-1.5 text-xs leading-5 text-text-muted">{hint}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </CardHeader>
      <CardContent className={cn("py-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
