import { zodResolver } from "@hookform/resolvers/zod";
import { BarChart3, CheckCircle2, Loader2, Moon, Sun, Users } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api/auth";
import { ApiError, NetworkError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLanguageStore, type Lang } from "@/stores/useLanguageStore";
import { useThemeStore } from "@/stores/useThemeStore";

const loginSchema = z.object({
  email: z.string().min(1, { message: "form.required" }),
  password: z.string().min(1, { message: "form.password_required" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LocationState {
  from?: string;
}

export default function LoginPage() {
  const { t } = useTranslation(["auth", "common", "errors"]);
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const lang = useLanguageStore((s) => s.lang);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const [serverErrorCode, setServerErrorCode] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setServerErrorCode(null);
    try {
      const tokens = await authApi.login(data);
      useAuthStore.getState().setAccessToken(tokens.access_token);
      const me = await authApi.me();
      setAuth({
        user: tokens.user,
        accessToken: tokens.access_token,
        permissions: me.permissions,
      });
      const from = (location.state as LocationState | null)?.from ?? "/";
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerErrorCode(err.code);
      } else if (err instanceof NetworkError) {
        setServerErrorCode("NETWORK_ERROR");
      } else {
        setServerErrorCode("INTERNAL_ERROR");
      }
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* ── Sol panel: brand & değer önerisi (lg+ görünür) ─────────────── */}
      <aside className="relative hidden flex-1 overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -right-32 -top-32 size-[480px] rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 size-[380px] rounded-full bg-black/10 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 text-lg font-extrabold backdrop-blur-sm">
            S
          </div>
          <span className="text-lg font-semibold tracking-wide">Sporthink</span>
        </div>

        <div className="relative z-10 max-w-md space-y-6">
          <h2 className="text-3xl font-bold leading-tight tracking-tight">
            {t("auth:brand_tagline")}
          </h2>
          <p className="text-sm text-white/85">{t("auth:brand_subtagline")}</p>
          <ul className="space-y-3">
            {[
              { icon: BarChart3, key: "auth:brand_feature_1" },
              { icon: BarChart3, key: "auth:brand_feature_2" },
              { icon: Users, key: "auth:brand_feature_3" },
              { icon: CheckCircle2, key: "auth:brand_feature_4" },
            ].map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-start gap-3 text-sm">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-white/90">{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/70">
          {t("auth:footer_copyright")}
        </p>
      </aside>

      {/* ── Sağ panel: form ────────────────────────────────────────────── */}
      <main className="relative flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
        {/* Top-right controls */}
        <div className="absolute right-5 top-5 flex gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-border bg-surface">
            {(["tr", "en"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold transition-colors",
                  lang === l
                    ? "bg-primary text-primary-foreground"
                    : "text-text-muted hover:text-foreground",
                )}
              >
                {l === "tr" ? "🇹🇷 TR" : "🇬🇧 EN"}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? t("common:theme_light") : t("common:theme_dark")}
            className="size-9 border-border bg-surface"
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </div>

        <div className="w-full max-w-md animate-fade-in space-y-8">
          {/* Mobile logo (lg- gizli olduğunda) */}
          <div className="flex justify-center lg:hidden">
            <Logo />
          </div>

          <header className="space-y-2 text-center sm:text-left">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("auth:welcome_back")}
            </h1>
            <p className="text-sm text-text-muted">
              {t("auth:login_subtitle_friendly")}
            </p>
          </header>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="email"
                className="text-sm font-semibold text-foreground"
              >
                {t("auth:email")}
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t("auth:email_placeholder_friendly")}
                aria-invalid={!!errors.email}
                className="h-11"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {t(`errors:${errors.email.message}`)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="password"
                className="text-sm font-semibold text-foreground"
              >
                {t("auth:password")}
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder={t("auth:password_placeholder_friendly")}
                aria-invalid={!!errors.password}
                className="h-11"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">
                  {t(`errors:${errors.password.message}`)}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={rememberMe}
                  onCheckedChange={(v) => setRememberMe(v === true)}
                />
                <span className="text-foreground">{t("auth:remember_me")}</span>
              </label>
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-sm font-medium text-primary hover:underline"
              >
                {t("auth:forgot_password")}
              </button>
            </div>

            {serverErrorCode && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {t(`errors:${serverErrorCode}`)}
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 text-base font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  {t("auth:logging_in")}
                </>
              ) : (
                t("auth:sign_in")
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-text-muted">
            {t("auth:no_account")}{" "}
            <span className="font-medium text-primary">
              {t("auth:contact_admin")}
            </span>
          </p>

          {/* Mobile footer (sol panel görünmediğinde) */}
          <p className="text-center text-xs text-text-dim lg:hidden">
            {t("auth:footer_copyright")}
          </p>
        </div>
      </main>

      {/* Forgot password info dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("auth:forgot_password_title")}</DialogTitle>
            <DialogDescription className="pt-2">
              {t("auth:forgot_password_help")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setForgotOpen(false)}>
              {t("auth:forgot_password_close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
