import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnDef, ColumnManager } from "@/hooks/useColumnManager";

interface ColumnSettingsMenuProps<TCol extends ColumnDef> {
  /** Kolon yoneticisi (useColumnManager cikti). */
  manager: ColumnManager<TCol>;
  /**
   * Kolon basligi cevirisi icin namespace. labelKey bu namespace altinda
   * cozulur (orn: "dashboard"). i18n disiplini: hardcode string yok.
   */
  ns: string;
}

/**
 * Tablo kolonlarini goster/gizle ve varsayilana dondur menusu. ChartCard'in
 * `action` slotunda kullanilir. Surukle-birak ile siralama tablo basliginda
 * yapilir; bu menu yalnizca gorunurluk ve sifirlama icindir.
 */
export function ColumnSettingsMenu<TCol extends ColumnDef>({
  manager,
  ns,
}: ColumnSettingsMenuProps<TCol>) {
  const { t } = useTranslation([ns, "common"]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="xs"
          aria-label={t("common:columns.menu_label")}
          title={t("common:columns.menu_label")}
        >
          <SlidersHorizontal />
          <span className="hidden sm:inline">{t("common:columns.button")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[14rem]">
        <DropdownMenuLabel>{t("common:columns.menu_label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {manager.orderedColumns.map((col) => {
          const checked = manager.isVisible(col.id);
          return (
            <DropdownMenuCheckboxItem
              key={col.id}
              checked={checked}
              disabled={col.required}
              // Menu, secimde kapanmasin — birden cok kolon ayarlanabilsin.
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => manager.toggleVisibility(col.id)}
            >
              {t(`${ns}:${col.labelKey}`)}
            </DropdownMenuCheckboxItem>
          );
        })}
        {manager.isCustomized && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => manager.reset()}>
              <RotateCcw />
              {t("common:columns.reset")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
