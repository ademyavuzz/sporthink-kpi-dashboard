import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Loader2, Save, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { UserAvatar } from "@/components/feature/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";

const profileSchema = z.object({
  first_name: z.string().min(1, { message: "form.required" }).max(100),
  last_name: z.string().min(1, { message: "form.required" }).max(100),
  phone: z.string().max(20).optional(),
  department: z.string().max(100).optional(),
  job_title: z.string().max(100).optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export default function ProfilePage() {
  const { t } = useTranslation(["settings", "errors", "common"]);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setAvatarUrl = useAuthStore((s) => s.setAvatarUrl);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState<"upload" | "remove" | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: user?.first_name ?? "",
      last_name: user?.last_name ?? "",
      phone: user?.phone ?? "",
      department: user?.department ?? "",
      job_title: user?.job_title ?? "",
    },
  });

  if (!user) return null;

  const onSubmit = async (data: ProfileForm) => {
    setServerError(null);
    try {
      const updated = await authApi.updateMe({
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone ?? "",
        department: data.department ?? "",
        job_title: data.job_title ?? "",
      });
      setUser(updated);
      reset({
        first_name: updated.first_name,
        last_name: updated.last_name,
        phone: updated.phone ?? "",
        department: updated.department ?? "",
        job_title: updated.job_title ?? "",
      });
      notify({
        type: "success",
        title: t("settings:profile_saved_title"),
        message: t("settings:profile_saved_message"),
        toast: true,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.code);
      } else {
        setServerError("INTERNAL_ERROR");
      }
    }
  };

  const handleAvatarSelect = () => fileInputRef.current?.click();

  const handleAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setAvatarError(null);
    const file = e.target.files?.[0];
    e.target.value = ""; // aynı dosyayı tekrar seçmeyi mümkün kıl
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setAvatarError(t("settings:avatar_error_format"));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError(t("settings:avatar_error_size"));
      return;
    }

    setAvatarBusy("upload");
    try {
      const res = await authApi.uploadAvatar(file);
      setAvatarUrl(res.avatar_url);
      notify({
        type: "success",
        title: t("settings:avatar_updated_title"),
        toast: true,
      });
    } catch (err) {
      setAvatarError(
        err instanceof ApiError
          ? t(`errors:${err.code}`, { defaultValue: err.message })
          : t("errors:INTERNAL_ERROR"),
      );
    } finally {
      setAvatarBusy(null);
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarError(null);
    setAvatarBusy("remove");
    try {
      const res = await authApi.removeAvatar();
      setAvatarUrl(res.avatar_url);
      notify({
        type: "info",
        title: t("settings:avatar_removed_title"),
        toast: true,
      });
    } catch (err) {
      setAvatarError(
        err instanceof ApiError
          ? t(`errors:${err.code}`, { defaultValue: err.message })
          : t("errors:INTERNAL_ERROR"),
      );
    } finally {
      setAvatarBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Avatar bölümü */}
      <section className="rounded-xl border border-border/60 bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">
          {t("settings:avatar_title")}
        </h2>
        <p className="mt-1 text-xs text-text-muted">
          {t("settings:avatar_hint")}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-5">
          <UserAvatar user={user} size="xl" />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              onClick={handleAvatarSelect}
              disabled={avatarBusy !== null}
              className="gap-1.5"
            >
              {avatarBusy === "upload" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              {t("settings:avatar_change")}
            </Button>
            {user.avatar_url && (
              <Button
                type="button"
                variant="outline"
                onClick={handleAvatarRemove}
                disabled={avatarBusy !== null}
                className="gap-1.5 text-text-muted hover:text-destructive"
              >
                {avatarBusy === "remove" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                {t("settings:avatar_remove")}
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
        </div>
        {avatarError && (
          <p className="mt-3 text-xs text-destructive">{avatarError}</p>
        )}
      </section>

      {/* Profil formu */}
      <section className="rounded-xl border border-border/60 bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">
          {t("settings:profile_section_title")}
        </h2>
        <p className="mt-1 text-xs text-text-muted">
          {t("settings:profile_section_hint")}
        </p>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <Field
            label={t("settings:field_first_name")}
            error={errors.first_name?.message}
            errorNs="errors"
          >
            <Input className="h-10" {...register("first_name")} />
          </Field>

          <Field
            label={t("settings:field_last_name")}
            error={errors.last_name?.message}
            errorNs="errors"
          >
            <Input className="h-10" {...register("last_name")} />
          </Field>

          <Field
            label={t("settings:field_email")}
            hint={t("settings:field_email_hint")}
            className="sm:col-span-2"
          >
            <Input
              className="h-10 cursor-not-allowed bg-muted/50"
              value={user.email}
              readOnly
              tabIndex={-1}
            />
          </Field>

          <Field label={t("settings:field_phone")}>
            <Input
              className="h-10"
              placeholder="+90 555 000 0000"
              {...register("phone")}
            />
          </Field>

          <Field label={t("settings:field_department")}>
            <Input className="h-10" {...register("department")} />
          </Field>

          <Field
            label={t("settings:field_job_title")}
            className="sm:col-span-2"
          >
            <Input className="h-10" {...register("job_title")} />
          </Field>

          {serverError && (
            <div className="sm:col-span-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {t(`errors:${serverError}`, { defaultValue: serverError })}
            </div>
          )}

          <div className="sm:col-span-2 flex justify-end gap-2 border-t border-border/60 pt-4">
            <Button
              type="submit"
              disabled={!isDirty || isSubmitting}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {t("settings:save_changes")}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  errorNs,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  errorNs?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation([errorNs ?? "errors"]);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-[11px] text-text-dim">{hint}</p>
      )}
      {error && (
        <p className="text-[11px] text-destructive">
          {errorNs ? t(`${errorNs}:${error}`, { defaultValue: error }) : error}
        </p>
      )}
    </div>
  );
}
