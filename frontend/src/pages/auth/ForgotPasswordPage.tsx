import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, Loader2, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { z } from "zod";

import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api/auth";
import { ApiError, NetworkError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useLanguageStore, type Lang } from "@/stores/useLanguageStore";
import { useThemeStore } from "@/stores/useThemeStore";

const forgotSchema = z.object({
  email: z.string().email({ message: "form.email_invalid" }),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const { t } = useTranslation(["auth", "errors"]);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const lang = useLanguageStore((s) => s.lang);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const [submitted, setSubmitted] = useState(false);
  const [serverErrorCode, setServerErrorCode] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotForm) => {
    setServerErrorCode(null);
    try {
      await authApi.forgotPassword({ email: data.email, lang });
      setSubmitted(true);
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
      <div className="pointer-events-none absolute -right-52 -top-52 size-[600px] rounded-full bg-primary/5" />
      <div className="pointer-events-none absolute -bottom-52 -left-52 size-[500px] rounded-full bg-brand-blue/5" />

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
          aria-label={theme === "dark" ? "Light theme" : "Dark theme"}
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
              {submitted ? t("auth:forgot.success_title") : t("auth:forgot.title")}
            </h1>
            <p className="text-sm text-text-muted">
              {submitted ? t("auth:forgot.success_body") : t("auth:forgot.subtitle")}
            </p>
          </div>

          {submitted ? (
            <div className="flex flex-col items-center gap-5">
              <div className="rounded-full bg-primary/10 p-4">
                <CheckCircle2 className="size-10 text-primary" />
              </div>
              <p className="text-center text-xs text-text-muted">
                {t("auth:forgot.success_delay_hint")}
              </p>
              <Link to="/login" className="w-full">
                <Button className="h-11 w-full text-sm font-bold">
                  <ArrowLeft />
                  {t("auth:forgot.back_to_login")}
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="email"
                  className="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
                >
                  {t("auth:forgot.email_label")}
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
                    {t("auth:forgot.submitting")}
                  </>
                ) : (
                  t("auth:forgot.submit")
                )}
              </Button>

              <Link
                to="/login"
                className="mt-2 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <ArrowLeft className="size-3.5" />
                {t("auth:forgot.back_to_login")}
              </Link>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-text-dim">
          {t("auth:footer_copyright")}
        </p>
      </div>
    </div>
  );
}
