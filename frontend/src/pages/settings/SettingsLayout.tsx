import { KeyRound, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

interface SettingsTab {
  to: string;
  i18nKey: string;
  icon: typeof UserRound;
}

const TABS: readonly SettingsTab[] = [
  { to: "/settings/profile", i18nKey: "settings:tab_profile", icon: UserRound },
  { to: "/settings/security", i18nKey: "settings:tab_security", icon: KeyRound },
];

/**
 * Ayarlar sayfası kabuk: sol tab nav + sağ Outlet.
 *
 * Profil ve güvenlik gibi alt sayfalar bu layout altında render olur.
 * Tablet ve altı ekranlarda taban üstte yatay tab şeklinde görünür.
 */
export default function SettingsLayout() {
  const { t } = useTranslation(["settings", "common"]);

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-6 py-6">
      <PageHeader
        title={t("settings:page_title")}
        subtitle={t("settings:page_subtitle")}
      />

      <div className="flex flex-col gap-6 md:flex-row">
        <aside className="md:w-56 md:shrink-0">
          <nav className="flex gap-1 overflow-x-auto border-b border-border md:flex-col md:border-b-0 md:border-r md:pr-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors whitespace-nowrap",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-text-muted hover:bg-muted hover:text-foreground",
                    )
                  }
                >
                  <Icon className="size-[16px]" />
                  {t(tab.i18nKey)}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
