import { zodResolver } from "@hookform/resolvers/zod";
import {
  Briefcase,
  Building2,
  Cake,
  Camera,
  Github,
  Globe,
  Instagram,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { forwardRef, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { AvatarCropModal } from "@/components/feature/AvatarCropModal";
import { UserAvatar } from "@/components/feature/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";

const optionalUrl = z
  .string()
  .max(255)
  .optional()
  .refine((v) => !v || /^https?:\/\//i.test(v), { message: "url_invalid" });

const profileSchema = z.object({
  // Kişisel
  first_name: z.string().min(1, { message: "form.required" }).max(100),
  last_name: z.string().min(1, { message: "form.required" }).max(100),
  phone: z.string().max(20).optional(),
  department: z.string().max(100).optional(),
  job_title: z.string().max(100).optional(),
  // Genişletilmiş
  bio: z.string().max(500).optional(),
  birth_date: z.string().optional(),
  location: z.string().max(100).optional(),
  // Sosyal
  website_url: optionalUrl,
  linkedin_url: optionalUrl,
  twitter_url: optionalUrl,
  github_url: optionalUrl,
  instagram_url: optionalUrl,
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
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
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
      bio: user?.bio ?? "",
      birth_date: user?.birth_date ?? "",
      location: user?.location ?? "",
      website_url: user?.website_url ?? "",
      linkedin_url: user?.linkedin_url ?? "",
      twitter_url: user?.twitter_url ?? "",
      github_url: user?.github_url ?? "",
      instagram_url: user?.instagram_url ?? "",
    },
  });

  const bioValue = watch("bio") ?? "";

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
        bio: data.bio ?? "",
        birth_date: data.birth_date || null,
        location: data.location ?? "",
        website_url: data.website_url ?? "",
        linkedin_url: data.linkedin_url ?? "",
        twitter_url: data.twitter_url ?? "",
        github_url: data.github_url ?? "",
        instagram_url: data.instagram_url ?? "",
      });
      setUser(updated);
      reset({
        first_name: updated.first_name,
        last_name: updated.last_name,
        phone: updated.phone ?? "",
        department: updated.department ?? "",
        job_title: updated.job_title ?? "",
        bio: updated.bio ?? "",
        birth_date: updated.birth_date ?? "",
        location: updated.location ?? "",
        website_url: updated.website_url ?? "",
        linkedin_url: updated.linkedin_url ?? "",
        twitter_url: updated.twitter_url ?? "",
        github_url: updated.github_url ?? "",
        instagram_url: updated.instagram_url ?? "",
      });
      notify({
        type: "success",
        title: t("settings:profile_saved_title"),
        message: t("settings:profile_saved_message"),
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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarError(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setAvatarError(t("settings:avatar_error_format"));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError(t("settings:avatar_error_size"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setCropImageSrc(reader.result as string);
    reader.onerror = () =>
      setAvatarError(t("errors:INTERNAL_ERROR", { defaultValue: "Read error" }));
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = async (cropped: File) => {
    setAvatarBusy("upload");
    try {
      const res = await authApi.uploadAvatar(cropped);
      setAvatarUrl(res.avatar_url);
      notify({
        type: "success",
        title: t("settings:avatar_updated_title"),
      });
      setCropImageSrc(null);
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* AVATAR + IDENTITY HEADER CARD */}
      <section className="rounded-2xl border border-gray-200 bg-card p-6 dark:border-gray-800">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <UserAvatar user={user} size="xl" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">
              {user.full_name}
            </h2>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-gray-500">
              <Mail className="size-3.5" />
              {user.email}
            </p>
            <p className="mt-2 text-xs text-text-muted">
              {t("settings:avatar_hint")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="default"
                onClick={handleAvatarSelect}
                disabled={avatarBusy !== null}
                className="gap-1.5"
                size="sm"
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
                  size="sm"
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
            {avatarError && (
              <p className="mt-2 text-xs text-destructive">{avatarError}</p>
            )}
          </div>
        </div>
        <AvatarCropModal
          open={cropImageSrc !== null}
          imageSrc={cropImageSrc}
          onCancel={() => setCropImageSrc(null)}
          onConfirm={handleCropConfirm}
        />
      </section>

      {/* KİŞİSEL BİLGİLER */}
      <SectionCard
        icon={UserIcon}
        title={t("settings:section_personal")}
        hint={t("settings:section_personal_hint")}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={t("settings:field_first_name")}
            error={errors.first_name?.message}
          >
            <Input className="h-10" {...register("first_name")} />
          </Field>
          <Field
            label={t("settings:field_last_name")}
            error={errors.last_name?.message}
          >
            <Input className="h-10" {...register("last_name")} />
          </Field>
          <Field
            label={t("settings:field_email")}
            hint={t("settings:field_email_hint")}
            className="sm:col-span-2"
          >
            <InputWithIcon
              icon={Mail}
              value={user.email}
              readOnly
              tabIndex={-1}
              className="cursor-not-allowed bg-muted/50"
            />
          </Field>
          <Field label={t("settings:field_phone")}>
            <InputWithIcon
              icon={Phone}
              placeholder="+90 555 000 0000"
              {...register("phone")}
            />
          </Field>
          <Field label={t("settings:field_birth_date")}>
            <InputWithIcon
              icon={Cake}
              type="date"
              {...register("birth_date")}
            />
          </Field>
          <Field label={t("settings:field_location")}>
            <InputWithIcon
              icon={MapPin}
              placeholder={t("settings:placeholder_location")}
              {...register("location")}
            />
          </Field>
          <Field label={t("settings:field_department")}>
            <InputWithIcon icon={Building2} {...register("department")} />
          </Field>
          <Field
            label={t("settings:field_job_title")}
            className="sm:col-span-2"
          >
            <InputWithIcon icon={Briefcase} {...register("job_title")} />
          </Field>
        </div>
      </SectionCard>

      {/* HAKKIMDA */}
      <SectionCard
        icon={UserIcon}
        title={t("settings:section_about")}
        hint={t("settings:section_about_hint")}
      >
        <Field label={t("settings:field_bio")}>
          <div className="relative">
            <Textarea
              {...register("bio")}
              placeholder={t("settings:placeholder_bio")}
              className="min-h-[110px] resize-y"
              maxLength={500}
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] tabular-nums text-text-dim">
              {bioValue.length}/500
            </span>
          </div>
        </Field>
      </SectionCard>

      {/* SOSYAL MEDYA */}
      <SectionCard
        icon={Globe}
        title={t("settings:section_social")}
        hint={t("settings:section_social_hint")}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={t("settings:field_website")}
            error={errors.website_url?.message}
          >
            <InputWithIcon
              icon={Globe}
              placeholder="https://example.com"
              {...register("website_url")}
            />
          </Field>
          <Field
            label={t("settings:field_linkedin")}
            error={errors.linkedin_url?.message}
          >
            <InputWithIcon
              icon={Linkedin}
              placeholder="https://linkedin.com/in/..."
              {...register("linkedin_url")}
            />
          </Field>
          <Field
            label={t("settings:field_twitter")}
            error={errors.twitter_url?.message}
          >
            <InputWithIcon
              icon={XTwitterIcon}
              placeholder="https://x.com/..."
              {...register("twitter_url")}
            />
          </Field>
          <Field
            label={t("settings:field_github")}
            error={errors.github_url?.message}
          >
            <InputWithIcon
              icon={Github}
              placeholder="https://github.com/..."
              {...register("github_url")}
            />
          </Field>
          <Field
            label={t("settings:field_instagram")}
            error={errors.instagram_url?.message}
            className="sm:col-span-2"
          >
            <InputWithIcon
              icon={Instagram}
              placeholder="https://instagram.com/..."
              {...register("instagram_url")}
            />
          </Field>
        </div>
      </SectionCard>

      {/* SAVE BAR (sticky) */}
      <div className="sticky bottom-0 -mx-6 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 bg-background/95 px-6 py-3 backdrop-blur dark:border-gray-800">
        {serverError && (
          <span className="mr-auto rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
            {t(`errors:${serverError}`, { defaultValue: serverError })}
          </span>
        )}
        {isDirty && !serverError && (
          <span className="mr-auto text-xs text-text-muted">
            {t("settings:unsaved_changes")}
          </span>
        )}
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
  );
}

/* ----------------------------- helpers ------------------------------ */

function SectionCard({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-card p-6 dark:border-gray-800">
      <header className="mb-5 flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
            {title}
          </h3>
          {hint && <p className="mt-0.5 text-xs text-text-muted">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation(["errors", "settings"]);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </Label>
      {children}
      {hint && !error && <p className="text-[11px] text-text-dim">{hint}</p>}
      {error && (
        <p className="text-[11px] text-destructive">
          {t(`errors:${error}`, {
            defaultValue: t(`settings:${error}`, { defaultValue: error }),
          })}
        </p>
      )}
    </div>
  );
}

const InputWithIcon = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    icon: React.ComponentType<{ className?: string }>;
  }
>(function InputWithIcon({ icon: Icon, className, ...rest }, ref) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
      <Input ref={ref} className={cn("h-10 pl-9", className)} {...rest} />
    </div>
  );
});

/** Twitter/X logosu — Lucide'da hazır olarak yok. */
function XTwitterIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
