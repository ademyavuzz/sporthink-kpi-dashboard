import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Minimal pagination kontrolü — Önceki/Sonraki düğmeleri + sayfa sayacı.
 *
 * Tek sayfa varsa hiçbir şey render etmez (gürültü olmaması için).
 * i18n key'leri: `common.pagination.*` (her zaman TR + EN paralel).
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: PaginationProps) {
  const { t } = useTranslation("common");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) return null;

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-1 py-3",
        className,
      )}
    >
      <div className="text-xs text-text-muted">
        <span className="font-medium text-foreground">
          {t("pagination.page_of", { page, totalPages })}
        </span>
        <span className="mx-2 text-text-dim">•</span>
        <span>{t("pagination.total_items", { total })}</span>
      </div>
      <div className="inline-flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          aria-label={t("pagination.previous")}
          className="h-8 gap-1 px-2.5"
        >
          <ChevronLeft className="size-3.5" />
          <span className="hidden sm:inline">{t("pagination.previous")}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          aria-label={t("pagination.next")}
          className="h-8 gap-1 px-2.5"
        >
          <span className="hidden sm:inline">{t("pagination.next")}</span>
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
