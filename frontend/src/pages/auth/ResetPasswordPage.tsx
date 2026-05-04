import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Loader2,
  Moon,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import type { ResetTokenPurpose, VerifyResetTokenResponse } from "@/types/auth";

const resetSchema = z
  .object({
    new_password: z.string().min(10, { message: "reset.rule_min_length" }),
    confirm_password: z.string().min(1, { message: "form.required" }),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "reset.passwords_dont_match",
    path: ["confirm_password"],
  });

type ResetForm = z.infer<typeof resetSchema>;

type Status = "verifying" | "valid" | "invalid" | "success";

export default function ResetPasswordPage() {
  const { t } = useTranslation(["auth", "errors"]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const lang = useLanguageStore((s) => s.lang);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const token = searchParams.get("token") ?? "";
  const purposeParam = (searchParams.get("purpose") as ResetTokenPurpose | null) ?? "reset";

  const [status, setStatus] = useState<Status>("verifying");
  const [meta, setMeta] = useState<VerifyResetTokenResponse | null>(null);
  const [serverErrorCode, setServerErrorCode] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { new_password: "", confirm_password: "" },
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const watched = useWatch({ control, name: ["new_password", "confirm_password"] });
  const newPasswordValue = watched[0] ?? "";
  const confirmPasswordValue = watched[1] ?? "";
  const ruleMinLength = newPasswordValue.length >= 10;
  const ruleMatch =
    newPasswordValue.length > 0 && newPasswordValue === confirmPasswordValue;

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    let cancelled = false;
    authApi
      .verifyResetToken(token)
      .then((res) => {
        if (cancelled) return;
        setMeta(res);
        setStatus("valid");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const purpose: ResetTokenPurpose = meta?.purpose ?? purposeParam;
  const isInvite = purpose === "invite";

  const onSubmit = async (data: ResetForm) => {
    setServerErrorCode(null);
    try {
      await authApi.resetPassword({ token, new_password: data.new_password });
      setStatus("success");
    } catch (err) {
      if (err instanceof ApiError) {
        setServerErrorCode(err.code);
        if (err.code === "INVALID_OR_EXPIRED_TOKEN") {
          setStatus("invalid");
        }
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
            {status === "verifying" && (
              <>
                <Loader2 className="mt-2 size-8 animate-spin text-primary" />
                <p className="text-sm text-text-muted">{t("auth:reset.verifying")}</p>
              </>
            )}

            {status === "invalid" && (
              <>
                <div className="mt-2 rounded-full bg-destructive/10 p-4">
                  <AlertCircle className="size-10 text-destructive" />
                </div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight">
                  {t("auth:reset.invalid_title")}
                </h1>
                <p className="text-sm text-text-muted">{t("auth:reset.invalid_body")}</p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="mt-2 rounded-full bg-primary/10 p-4">
                  <CheckCircle2 className="size-10 text-primary" />
                </div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight">
                  {t("auth:reset.success_title")}
                </h1>
                <p className="text-sm text-text-muted">{t("auth:reset.success_body")}</p>
              </>
            )}

            {status === "valid" && (
              <>
                <h1 className="mt-2 text-2xl font-bold tracking-tight">
                  {isInvite ? t("auth:reset.title_invite") : t("auth:reset.title_reset")}
                </h1>
                <p className="text-sm text-text-muted">
                  {isInvite ? t("auth:reset.subtitle_invite") : t("auth:reset.subtitle_reset")}
                </p>
                {meta && (
                  <p className="text-xs text-text-dim">
                    {t("auth:reset.for_account")}:{" "}
                    <span className="font-semibold text-foreground">{meta.user_email}</span>
                  </p>
                )}
              </>
            )}
          </div>

          {status === "valid" && (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="new_password"
                  className="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
                >
                  {t("auth:reset.new_password")}
                </Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t("auth:reset.password_placeholder")}
                    aria-invalid={!!errors.new_password}
                    className="h-11 pr-11"
                    {...register("new_password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t("auth:hide_password") : t("auth:show_password")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-muted hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.new_password && (
                  <p className="text-xs text-destructive">
                    {t(`auth:${errors.new_password.message}`, {
                      defaultValue: t(`errors:${errors.new_password.message}`),
                    })}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="confirm_password"
                  className="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
                >
                  {t("auth:reset.confirm_password")}
                </Label>
                <div className="relative">
                  <Input
                    id="confirm_password"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t("auth:reset.password_placeholder")}
                    aria-invalid={!!errors.confirm_password}
                    className="h-11 pr-11"
                    {...register("confirm_password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? t("auth:hide_password") : t("auth:show_password")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-muted hover:text-foreground transition-colors"
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.confirm_password && (
                  <p className="text-xs text-destructive">
                    {t(`auth:${errors.confirm_password.message}`, {
                      defaultValue: t(`errors:${errors.confirm_password.message}`),
                    })}
                  </p>
                )}
              </div>

              <ul className="flex flex-col gap-1.5 rounded-md border border-border bg-background/40 p-3 text-xs">
                <PasswordRule satisfied={ruleMinLength} label={t("auth:reset.rule_min_length")} />
                <PasswordRule satisfied={ruleMatch} label={t("auth:reset.rule_match")} />
              </ul>

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
                    {t("auth:reset.submitting")}
                  </>
                ) : isInvite ? (
                  t("auth:reset.submit_invite")
                ) : (
                  t("auth:reset.submit_reset")
                )}
              </Button>
            </form>
          )}

          {(status === "invalid" || status === "success") && (
            <Button
              onClick={() => navigate("/login")}
              className="mt-2 h-11 w-full text-sm font-bold"
            >
              {t("auth:reset.go_to_login")}
              <ArrowRight />
            </Button>
          )}

          {status === "invalid" && (
            <Link
              to="/forgot-password"
              className="mt-3 block text-center text-xs font-medium text-primary hover:underline"
            >
              {t("auth:forgot.title")}
            </Link>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-text-dim">
          {t("auth:footer_copyright")}
        </p>
      </div>
    </div>
  );
}

function PasswordRule({ satisfied, label }: { satisfied: boolean; label: string }) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 transition-colors",
        satisfied ? "text-emerald-600 dark:text-emerald-400" : "text-text-muted",
      )}
    >
      {satisfied ? (
        <Check className="size-3.5 shrink-0" strokeWidth={3} />
      ) : (
        <Circle className="size-3.5 shrink-0" />
      )}
      <span>{label}</span>
    </li>
  );
}
