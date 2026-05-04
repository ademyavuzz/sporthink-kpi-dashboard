import { Construction } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ComingSoonPageProps {
  /** `nav.<key>` translation key (örn: "overview", "traffic"). */
  navKey: string;
}

/**
 * Sprint 2+'da gerçek implementasyonla değişecek geçici sayfa.
 * Sidebar'daki tüm nav item'ları bu placeholder'la şimdilik eşlenebilir.
 */
export function ComingSoonPage({ navKey }: ComingSoonPageProps) {
  const { t } = useTranslation("common");
  return (
    <div className="flex h-full w-full items-center justify-center px-6 py-10">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <Construction className="size-10 text-text-muted" aria-hidden />
        <div className="text-2xl font-bold tracking-tight">
          {t(`nav.${navKey}`)}
        </div>
        <div className="text-sm text-text-muted">{t("coming_soon")}</div>
        <p className="text-xs text-text-dim">{t("coming_soon_description")}</p>
      </div>
    </div>
  );
}
