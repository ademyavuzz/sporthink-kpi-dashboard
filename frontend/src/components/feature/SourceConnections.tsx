import {
  BarChart3,
  CheckCircle2,
  Database,
  Facebook,
  LineChart,
  Loader2,
  type LucideIcon,
  PlugZap,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";

/**
 * Bağlanılabilecek harici veri kaynaklarının statik tanımı.
 * `id` değerleri i18n key'lerine map'lenir: `imports:sources.<id>.title` vb.
 *
 * NOT: Buradaki "bağlan" akışı tamamen client-side bir DEMO'dur. Gerçek
 * OAuth/connect entegrasyonu yoktur; girilen kimlik bilgileri hiçbir yere
 * gönderilmez, sadece bağlantı durumu (kimlik bilgisi HARİÇ) localStorage'da
 * saklanır. Gerçek entegrasyon eklendiğinde `connect` handler'ı gerçek API
 * çağrısıyla değiştirilir; kart/form yapısı korunur.
 */
type SourceId = "meta_ads" | "google_ads" | "ga4" | "database";

/** Bir kaynak formundaki tek bir giriş alanının tanımı. */
interface SourceField {
  /** Form alan adı (kimlik bilgisi — ASLA persist edilmez). */
  name: string;
  /** `multiline` çok satırlı (JSON anahtarı gibi), `secret` maskelenir. */
  kind: "text" | "secret" | "multiline";
  /** Zorunlu mu? Demo akışında min uzunluk doğrulaması için. */
  required: boolean;
}

interface SourceDefinition {
  id: SourceId;
  icon: LucideIcon;
  /** Marka/ürün rengini taşıyan ikon kapsayıcısı için token tabanlı sınıf. */
  accentClassName: string;
  /** Connect dialog'unda gösterilecek alanlar (kaynağa özgü). */
  fields: readonly SourceField[];
}

const SOURCE_DEFINITIONS: readonly SourceDefinition[] = [
  {
    id: "meta_ads",
    icon: Facebook,
    accentClassName: "bg-primary/10 text-primary",
    fields: [
      { name: "app_id", kind: "text", required: true },
      { name: "app_secret", kind: "secret", required: true },
      { name: "access_token", kind: "secret", required: true },
    ],
  },
  {
    id: "google_ads",
    icon: BarChart3,
    accentClassName: "bg-warning-500/10 text-warning-600 dark:text-warning-500",
    fields: [
      { name: "customer_id", kind: "text", required: true },
      { name: "developer_token", kind: "secret", required: true },
    ],
  },
  {
    id: "ga4",
    icon: LineChart,
    accentClassName: "bg-success-500/10 text-success-600 dark:text-success-500",
    fields: [
      { name: "property_id", kind: "text", required: true },
      { name: "service_account_json", kind: "multiline", required: true },
    ],
  },
  {
    id: "database",
    icon: Database,
    accentClassName: "bg-muted text-text-muted",
    fields: [
      { name: "connection_url", kind: "text", required: true },
      { name: "api_key", kind: "secret", required: true },
    ],
  },
] as const;

// =====================================================================
// Demo bağlantı durumu — localStorage'da kalıcı (DEMO, kimlik bilgisi YOK)
// =====================================================================

/** Tek bir kaynağın kalıcı (demo) bağlantı durumu. */
interface ConnectionRecord {
  /** Bağlantının kurulduğu an (ISO 8601, UTC). */
  connectedAt: string;
  /** Son senkron anı (ISO 8601, UTC). Yeniden senkronda güncellenir. */
  lastSyncAt: string;
  /** Demo amaçlı "aktarılan kayıt" sayısı. */
  recordsImported: number;
  /** Kullanıcıya gösterilecek hesap etiketi (örn. girilen hesap ID'si). */
  accountLabel: string;
}

type ConnectionState = Partial<Record<SourceId, ConnectionRecord>>;

const STORAGE_KEY = "sporthink:source-connections:demo";

function loadConnections(): ConnectionState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as ConnectionState;
    }
    return {};
  } catch {
    return {};
  }
}

function persistConnections(state: ConnectionState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage kotası dolu / private mode — sessizce geç (demo).
  }
}

/** Demo için gerçekçi, deterministik olmayan bir kayıt sayısı üretir. */
function fakeRecordCount(): number {
  return 1_000 + Math.floor(Math.random() * 24_000);
}

/** Bağlantı durumunu localStorage ile senkron tutan hook. */
function useSourceConnections() {
  const [connections, setConnections] = useState<ConnectionState>(loadConnections);

  const connect = useCallback((id: SourceId, accountLabel: string) => {
    setConnections((prev) => {
      const now = dayjs.utc().toISOString();
      const next: ConnectionState = {
        ...prev,
        [id]: {
          connectedAt: now,
          lastSyncAt: now,
          recordsImported: fakeRecordCount(),
          accountLabel,
        },
      };
      persistConnections(next);
      return next;
    });
  }, []);

  const resync = useCallback((id: SourceId) => {
    setConnections((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      const next: ConnectionState = {
        ...prev,
        [id]: {
          ...existing,
          lastSyncAt: dayjs.utc().toISOString(),
          recordsImported: existing.recordsImported + fakeRecordCount(),
        },
      };
      persistConnections(next);
      return next;
    });
  }, []);

  const disconnect = useCallback((id: SourceId) => {
    setConnections((prev) => {
      const next = { ...prev };
      delete next[id];
      persistConnections(next);
      return next;
    });
  }, []);

  return { connections, connect, resync, disconnect };
}

// =====================================================================
// SourceConnections — kök bileşen
// =====================================================================

export function SourceConnections() {
  const { t } = useTranslation(["imports", "common"]);
  const { connections, connect, resync, disconnect } = useSourceConnections();
  const [activeSource, setActiveSource] = useState<SourceId | null>(null);

  const activeDefinition =
    activeSource !== null
      ? (SOURCE_DEFINITIONS.find((s) => s.id === activeSource) ?? null)
      : null;

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <header className="flex items-start gap-2.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PlugZap className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">
              {t("imports:sources.section_title")}
            </h2>
            <p className="text-xs text-text-muted">
              {t("imports:sources.section_subtitle")}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
          {SOURCE_DEFINITIONS.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              connection={connections[source.id]}
              onConnect={() => setActiveSource(source.id)}
              onResync={() => resync(source.id)}
              onDisconnect={() => disconnect(source.id)}
            />
          ))}
        </div>
      </CardContent>

      <ConnectDialog
        source={activeDefinition}
        onClose={() => setActiveSource(null)}
        onConnected={(label) => {
          if (activeDefinition) {
            connect(activeDefinition.id, label);
            toast.success(
              t("imports:sources.connect_success_toast", {
                source: t(`imports:sources.${activeDefinition.id}.title`),
              }),
            );
          }
          setActiveSource(null);
        }}
      />
    </Card>
  );
}

// =====================================================================
// SourceCard — tek bir veri kaynağı kartı (bağlı / bağlı değil)
// =====================================================================

interface SourceCardProps {
  source: SourceDefinition;
  connection: ConnectionRecord | undefined;
  onConnect: () => void;
  onResync: () => void;
  onDisconnect: () => void;
}

function SourceCard({
  source,
  connection,
  onConnect,
  onResync,
  onDisconnect,
}: SourceCardProps) {
  const { t } = useTranslation(["imports", "common"]);
  const Icon = source.icon;
  const isConnected = connection !== undefined;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-surface-2/40 p-4 transition-colors",
        isConnected
          ? "border-success-500/30"
          : "border-border hover:border-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "inline-flex size-10 shrink-0 items-center justify-center rounded-lg",
              source.accentClassName,
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {t(`imports:sources.${source.id}.title`)}
            </p>
            <p className="line-clamp-2 text-xs text-text-muted">
              {t(`imports:sources.${source.id}.description`)}
            </p>
          </div>
        </div>
        {isConnected ? (
          <Badge
            variant="outline"
            className="shrink-0 gap-1 border-success-500/30 bg-success-500/10 text-success-700 dark:text-success-500"
          >
            <CheckCircle2 className="size-3" />
            {t("imports:sources.badge_connected")}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="shrink-0 bg-muted text-text-muted"
          >
            {t("imports:sources.badge_not_connected")}
          </Badge>
        )}
      </div>

      {isConnected ? (
        <ConnectedDetails
          connection={connection}
          onResync={onResync}
          onDisconnect={onDisconnect}
        />
      ) : (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onConnect}
            className="gap-1.5"
          >
            <PlugZap className="size-3.5" />
            {t("imports:sources.btn_connect")}
          </Button>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// ConnectedDetails — bağlı kart alt bölümü (senkron + kes)
// =====================================================================

interface ConnectedDetailsProps {
  connection: ConnectionRecord;
  onResync: () => void;
  onDisconnect: () => void;
}

function ConnectedDetails({
  connection,
  onResync,
  onDisconnect,
}: ConnectedDetailsProps) {
  const { t } = useTranslation(["imports", "common"]);
  const [syncing, setSyncing] = useState(false);

  // `fromNow()` saniye saniye tazelensin diye basit bir tick.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const lastSync = dayjs.utc(connection.lastSyncAt).tz("Europe/Istanbul").fromNow();

  function handleResync() {
    if (syncing) return;
    setSyncing(true);
    // Sahte senkron gecikmesi (DEMO).
    window.setTimeout(() => {
      onResync();
      setSyncing(false);
      toast.success(t("imports:sources.resync_success_toast"));
    }, 1_100);
  }

  return (
    <div className="space-y-3 border-t border-border/60 pt-3">
      <dl className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-text-muted">{t("imports:sources.detail_account")}</dt>
          <dd
            className="max-w-[60%] truncate font-mono text-[11px] text-foreground"
            title={connection.accountLabel}
          >
            {connection.accountLabel}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-text-muted">{t("imports:sources.detail_last_sync")}</dt>
          <dd className="font-medium text-foreground">{lastSync}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-text-muted">{t("imports:sources.detail_records")}</dt>
          <dd className="font-semibold tabular-nums text-success-700 dark:text-success-500">
            {t("imports:sources.detail_records_value", {
              count: connection.recordsImported,
              formatted: connection.recordsImported.toLocaleString("tr-TR"),
            })}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleResync}
          disabled={syncing}
          className="gap-1.5 text-text-muted hover:text-foreground"
        >
          {syncing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          {syncing
            ? t("imports:sources.btn_syncing")
            : t("imports:sources.btn_resync")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDisconnect}
          disabled={syncing}
          className="gap-1.5 text-error-600 hover:bg-error-500/10 hover:text-error-700 dark:text-error-500"
        >
          <Unplug className="size-3.5" />
          {t("imports:sources.btn_disconnect")}
        </Button>
      </div>
    </div>
  );
}

// =====================================================================
// ConnectDialog — kimlik bilgisi girişi + sahte bağlanma akışı (DEMO)
// =====================================================================

interface ConnectDialogProps {
  source: SourceDefinition | null;
  onClose: () => void;
  onConnected: (accountLabel: string) => void;
}

function ConnectDialog({ source, onClose, onConnected }: ConnectDialogProps) {
  const { t } = useTranslation(["imports", "common"]);

  // Form değerleri kaynağa göre dinamik olduğundan jenerik bir kayıt tipi
  // kullanıyoruz; doğrulama submit anında elle yapılır (alanlar dinamik).
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Record<string, string>>();

  // Dialog her açıldığında formu temizle.
  useEffect(() => {
    if (source) reset({});
  }, [source, reset]);

  const fieldSchema = z.string().trim().min(3, "field_too_short");

  const onValid = handleSubmit(async (values) => {
    if (!source) return;

    // Sahte ağ gecikmesi (gerçek OAuth/connect akışını taklit).
    await new Promise((resolve) => window.setTimeout(resolve, 1_300));

    // İlk zorunlu alandan kullanıcıya gösterilecek hesap etiketini türet.
    const labelField = source.fields[0]?.name;
    const rawLabel = labelField ? (values[labelField] ?? "") : "";
    const accountLabel = rawLabel.trim() || t("imports:sources.detail_account");

    onConnected(accountLabel);
  });

  return (
    <Dialog open={source !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {source && (
          <form onSubmit={onValid} className="contents">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
                    source.accentClassName,
                  )}
                >
                  <source.icon className="size-4.5" />
                </span>
                {t("imports:sources.connect_title", {
                  source: t(`imports:sources.${source.id}.title`),
                })}
              </DialogTitle>
              <DialogDescription className="pt-1 text-sm text-text-muted">
                {t("imports:sources.connect_body")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {source.fields.map((field) => {
                const fieldId = `${source.id}-${field.name}`;
                const errorMsg = errors[field.name]?.message;
                const label = t(
                  `imports:sources.fields.${source.id}.${field.name}.label`,
                );
                const placeholder = t(
                  `imports:sources.fields.${source.id}.${field.name}.placeholder`,
                );

                return (
                  <div key={field.name} className="flex flex-col gap-1.5">
                    <Label
                      htmlFor={fieldId}
                      className="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
                    >
                      {label}
                    </Label>
                    {field.kind === "multiline" ? (
                      <Textarea
                        id={fieldId}
                        rows={4}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={placeholder}
                        aria-invalid={!!errorMsg}
                        className="font-mono text-xs"
                        {...register(field.name, {
                          validate: (v) =>
                            !field.required ||
                            fieldSchema.safeParse(v).success ||
                            "field_too_short",
                        })}
                      />
                    ) : (
                      <Input
                        id={fieldId}
                        type={field.kind === "secret" ? "password" : "text"}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={placeholder}
                        aria-invalid={!!errorMsg}
                        className="h-10"
                        {...register(field.name, {
                          validate: (v) =>
                            !field.required ||
                            fieldSchema.safeParse(v).success ||
                            "field_too_short",
                        })}
                      />
                    )}
                    {errorMsg && (
                      <p className="text-xs text-destructive">
                        {t(`imports:sources.field_errors.${String(errorMsg)}`)}
                      </p>
                    )}
                  </div>
                );
              })}

              <p className="rounded-md border border-border bg-surface-2/50 px-3 py-2 text-[11px] leading-relaxed text-text-dim">
                {t("imports:sources.connect_demo_note")}
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                {t("common:cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-1.5">
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("imports:sources.btn_connecting")}
                  </>
                ) : (
                  <>
                    <PlugZap className="size-4" />
                    {t("imports:sources.btn_connect")}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
