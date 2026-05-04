import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Circle, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { forwardRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";

const schema = z
  .object({
    current_password: z.string().min(1, { message: "form.required" }),
    new_password: z.string().min(10, { message: "rule_min_length" }),
    confirm_password: z.string().min(1, { message: "form.required" }),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "passwords_dont_match",
    path: ["confirm_password"],
  });

type SecurityForm = z.infer<typeof schema>;

export default function SecurityPage() {
  const { t } = useTranslation(["settings", "errors", "common"]);
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SecurityForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const watched = useWatch({ control, name: ["new_password", "confirm_password"] });
  const newPw = watched[0] ?? "";
  const confirmPw = watched[1] ?? "";
  const ruleMinLength = newPw.length >= 10;
  const ruleMatch = newPw.length > 0 && newPw === confirmPw;

  const onSubmit = async (data: SecurityForm) => {
    setServerError(null);
    try {
      await authApi.changePassword({
        current_password: data.current_password,
        new_password: data.new_password,
      });
      notify({
        type: "success",
        title: t("settings:password_changed_title"),
        message: t("settings:password_changed_message"),
        toast: true,
      });
      reset();
      // Backend tüm refresh tokenları revoke etti; clean logout + login redirect.
      clearAuth();
      navigate("/login", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.code);
      } else {
        setServerError("INTERNAL_ERROR");
      }
    }
  };

  return (
    <section className="rounded-xl border border-border/60 bg-card p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <KeyRound className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">
            {t("settings:security_title")}
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            {t("settings:security_hint")}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-6 grid grid-cols-1 gap-4"
      >
        <PasswordField
          id="current_password"
          label={t("settings:field_current_password")}
          show={showCurrent}
          onToggle={() => setShowCurrent((v) => !v)}
          error={errors.current_password?.message}
          autoComplete="current-password"
          {...register("current_password")}
        />

        <PasswordField
          id="new_password"
          label={t("settings:field_new_password")}
          placeholder={t("settings:new_password_placeholder")}
          show={showNew}
          onToggle={() => setShowNew((v) => !v)}
          error={errors.new_password?.message}
          autoComplete="new-password"
          {...register("new_password")}
        />

        <PasswordField
          id="confirm_password"
          label={t("settings:field_confirm_password")}
          show={showConfirm}
          onToggle={() => setShowConfirm((v) => !v)}
          error={errors.confirm_password?.message}
          autoComplete="new-password"
          {...register("confirm_password")}
        />

        <ul className="flex flex-col gap-1.5 rounded-md border border-border bg-background/40 p-3 text-xs">
          <Rule satisfied={ruleMinLength} label={t("settings:rule_min_length")} />
          <Rule satisfied={ruleMatch} label={t("settings:rule_match")} />
        </ul>

        {serverError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {t(`errors:${serverError}`, { defaultValue: serverError })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <p className="text-[11px] text-text-dim">
            {t("settings:security_logout_warning")}
          </p>
          <Button type="submit" disabled={isSubmitting} className="gap-1.5">
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {t("settings:change_password")}
          </Button>
        </div>
      </form>
    </section>
  );
}

interface PasswordFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
  label: string;
  show: boolean;
  onToggle: () => void;
  error?: string;
}

const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    { id, label, show, onToggle, error, className, ...rest },
    ref,
  ) {
    const { t } = useTranslation(["settings", "errors", "auth"]);
    return (
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor={id}
          className="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
        >
          {label}
        </Label>
        <div className="relative">
          <Input
            id={id}
            ref={ref}
            type={show ? "text" : "password"}
            className={cn("h-10 pr-11", className)}
            {...rest}
          />
          <button
            type="button"
            onClick={onToggle}
            aria-label={show ? t("auth:hide_password") : t("auth:show_password")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-muted hover:text-foreground"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {error && (
          <p className="text-[11px] text-destructive">
            {t(`settings:${error}`, {
              defaultValue: t(`errors:${error}`, { defaultValue: error }),
            })}
          </p>
        )}
      </div>
    );
  },
);

function Rule({ satisfied, label }: { satisfied: boolean; label: string }) {
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
