import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  const { t } = useTranslation(["errors", "common"]);
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="text-6xl font-extrabold tracking-tight text-primary">404</div>
        <div className="text-sm text-text-muted">{t("RESOURCE_NOT_FOUND")}</div>
        <Button asChild variant="outline">
          <Link to="/">{t("common:close")}</Link>
        </Button>
      </div>
    </div>
  );
}
