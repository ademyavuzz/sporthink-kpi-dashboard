import {
  BarChart3,
  Database,
  Facebook,
  LineChart,
  type LucideIcon,
  PlugZap,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Bağlanılabilecek harici veri kaynaklarının statik tanımı.
 * `id` değerleri i18n key'lerine map'lenir: `imports:sources.<id>.title` vb.
 *
 * İleride gerçek OAuth/bağlantı eklendiğinde her kaynağa `status` ve
 * `connect` handler'ı eklenmesi yeterli; kart yapısı değişmez.
 */
interface SourceDefinition {
  id: "meta_ads" | "google_ads" | "ga4" | "database";
  icon: LucideIcon;
  /** Marka/ürün rengini taşıyan ikon kapsayıcısı için token tabanlı sınıf. */
  accentClassName: string;
}

const SOURCE_DEFINITIONS: readonly SourceDefinition[] = [
  {
    id: "meta_ads",
    icon: Facebook,
    accentClassName: "bg-primary/10 text-primary",
  },
  {
    id: "google_ads",
    icon: BarChart3,
    accentClassName: "bg-warning-500/10 text-warning-600 dark:text-warning-500",
  },
  {
    id: "ga4",
    icon: LineChart,
    accentClassName: "bg-success-500/10 text-success-600 dark:text-success-500",
  },
  {
    id: "database",
    icon: Database,
    accentClassName: "bg-muted text-text-muted",
  },
] as const;

export function SourceConnections() {
  const { t } = useTranslation(["imports", "common"]);
  const [activeSource, setActiveSource] = useState<SourceDefinition["id"] | null>(
    null,
  );

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <header className="flex items-start gap-2.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PlugZap className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">
              {t("imports:sources.section_title")}
            </h2>
            <p className="text-xs text-text-muted">
              {t("imports:sources.section_subtitle")}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SOURCE_DEFINITIONS.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              onConnect={() => setActiveSource(source.id)}
            />
          ))}
        </div>
      </CardContent>

      <ComingSoonDialog
        sourceId={activeSource}
        onClose={() => setActiveSource(null)}
      />
    </Card>
  );
}

// =====================================================================
// SourceCard — tek bir veri kaynağı kartı
// =====================================================================

interface SourceCardProps {
  source: SourceDefinition;
  onConnect: () => void;
}

function SourceCard({ source, onConnect }: SourceCardProps) {
  const { t } = useTranslation("imports");
  const Icon = source.icon;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2/40 p-4 transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "inline-flex size-10 shrink-0 items-center justify-center rounded-lg",
              source.accentClassName,
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {t(`sources.${source.id}.title`)}
            </p>
            <p className="line-clamp-2 text-xs text-text-muted">
              {t(`sources.${source.id}.description`)}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="shrink-0 bg-warning-500/10 text-warning-600 dark:text-warning-500"
        >
          {t("sources.badge_coming_soon")}
        </Badge>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onConnect}
          className="gap-1.5"
        >
          <PlugZap className="size-3.5" />
          {t("sources.btn_connect")}
        </Button>
      </div>
    </div>
  );
}

// =====================================================================
// ComingSoonDialog — bağlantı henüz aktif değil bilgilendirmesi
// =====================================================================

interface ComingSoonDialogProps {
  sourceId: SourceDefinition["id"] | null;
  onClose: () => void;
}

function ComingSoonDialog({ sourceId, onClose }: ComingSoonDialogProps) {
  const { t } = useTranslation(["imports", "common"]);

  return (
    <Dialog open={sourceId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-500/10 text-warning-600 dark:text-warning-500">
              <PlugZap className="size-4.5" />
            </span>
            {sourceId
              ? t("imports:sources.coming_soon_title", {
                  source: t(`imports:sources.${sourceId}.title`),
                })
              : null}
          </DialogTitle>
          <DialogDescription className="pt-1 text-sm text-text-muted">
            {t("imports:sources.coming_soon_body")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {t("common:close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
