import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  buildExportFilename,
  exportCsv,
  exportXlsx,
  type ExportColumn,
} from "@/lib/export";
import { notify } from "@/lib/notify";

interface ExportMenuProps<TRow> {
  /** Disa aktarilacak satirlar — ekranda gosterilen (filtre uygulanmis) veri. */
  rows: TRow[];
  /** Kolon tanimlari — baslik + hucre erisimcisi. */
  columns: ExportColumn<TRow>[];
  /**
   * Dosya adi tabani (orn: "orders"). Uzanti ve tarih son eki otomatik.
   * Tarih araligi verilirse dosya adina eklenir.
   */
  fileBase: string;
  dateFrom?: string;
  dateTo?: string;
  /** XLSX sayfa adi (cevirilmis baslik onerilir). */
  sheetName?: string;
  /** Buton boyutu — ChartCard action slotunda "xs" tercih edilir. */
  size?: "xs" | "sm";
  /** Veri yokken butonu pasiflestir. */
  disabled?: boolean;
}

/**
 * Tabloyu CSV veya XLSX olarak indirme menusu. ChartCard'in `action` slotunda
 * (ColumnSettingsMenu ile yan yana) veya DashboardHeader `actions` icinde
 * kullanilir. Disa aktarilan veri, cagiran tarafin gecirdigi (filtre
 * uygulanmis) `rows` ile birebir aynidir.
 */
export function ExportMenu<TRow>({
  rows,
  columns,
  fileBase,
  dateFrom,
  dateTo,
  sheetName,
  size = "xs",
  disabled,
}: ExportMenuProps<TRow>) {
  const { t } = useTranslation("common");
  const isEmpty = rows.length === 0;
  const filename = buildExportFilename(fileBase, dateFrom, dateTo);

  const handleCsv = () => {
    if (isEmpty) return;
    exportCsv(rows, columns, filename);
    notify({ type: "success", title: t("export.success_csv") });
  };

  const handleXlsx = () => {
    if (isEmpty) return;
    exportXlsx(rows, columns, filename, sheetName);
    notify({ type: "success", title: t("export.success_xlsx") });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          disabled={disabled || isEmpty}
          aria-label={t("export.menu_label")}
          title={t("export.menu_label")}
        >
          <Download />
          <span className="hidden sm:inline">{t("export.button")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[12rem]">
        <DropdownMenuLabel>{t("export.menu_label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleCsv}>
          <FileText />
          {t("export.as_csv")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleXlsx}>
          <FileSpreadsheet />
          {t("export.as_xlsx")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
