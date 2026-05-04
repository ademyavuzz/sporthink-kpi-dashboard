import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
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
      // /me ile permission listesini çek (super admin için 40, diğerleri için role'ün izinleri)
      const me = await (async () => {
        useAuthStore.getState().setAccessToken(tokens.access_token);
        return authApi.me();
      })();
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -right-52 -top-52 size-[600px] rounded-full bg-primary/5" />
      <div className="pointer-events-none absolute -bottom-52 -left-52 size-[500px] rounded-full bg-brand-blue/5" />

      {/* Top-right controls */}
      <div className="absolute right-5 top-5 flex gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-border bg-surface">
          {(["tr", "en"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              className={cn(
                "px-3.5 py-2 text-xs font-bold transition-colors",
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
          className="border-border bg-surface"
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
      </div>

      <div className="w-full max-w-md">
        <div className="animate-fade-in rounded-2xl border border-border bg-surface p-9 shadow-2xl">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <Logo />
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              {t("auth:welcome")}
            </h1>
            <p className="text-sm text-text-muted">
              {t("auth:login_subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="email"
                className="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
              >
                {t("auth:email")}
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t("auth:email_placeholder")}
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
              <div className="flex items-baseline justify-between">
                <Label
                  htmlFor="password"
                  className="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
                >
                  {t("auth:password")}
                </Label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t("auth:forgot_password")}
                </button>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder={t("auth:password_placeholder")}
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

            {serverErrorCode && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {t(`errors:${serverErrorCode}`)}
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 h-11 text-sm font-bold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  {t("auth:logging_in")}
                </>
              ) : (
                t("auth:login")
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-text-muted">
            {t("auth:no_account")}{" "}
            <span className="font-medium text-foreground">
              {t("auth:contact_admin")}
            </span>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-text-dim">
          {t("auth:footer_copyright")}
        </p>
      </div>

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
