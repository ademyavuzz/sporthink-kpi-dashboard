import { useTranslation } from "react-i18next";

/** Lazy-loaded sayfalar için Suspense fallback. */
export function PageLoader() {
  const { t } = useTranslation("common");
  return (
    <div className="flex h-full w-full items-center justify-center text-text-muted text-sm">
      {t("loading")}
    </div>
  );
}
