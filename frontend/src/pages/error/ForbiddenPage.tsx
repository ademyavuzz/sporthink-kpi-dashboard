import { ShieldOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  const { t } = useTranslation(["errors", "common"]);
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <ShieldOff className="size-12 text-primary" aria-hidden />
        <div className="text-3xl font-bold tracking-tight">403</div>
        <div className="text-sm text-text-muted">{t("PERMISSION_DENIED")}</div>
        <Button asChild variant="outline">
          <Link to="/">{t("common:close")}</Link>
        </Button>
      </div>
    </div>
  );
}
