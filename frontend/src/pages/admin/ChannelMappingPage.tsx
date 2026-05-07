import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Cog,
  Globe,
  Info,
  LayoutGrid,
  Loader2,
  Network,
  Plus,
  Search,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi } from "@/lib/api/admin";
import { cn } from "@/lib/utils";
import type { ChannelMappingItem } from "@/types/admin";

export default function ChannelMappingPage() {
  const { t } = useTranslation(["admin", "common"]);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] =
    useState<ChannelMappingItem | null>(null);
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["channel-mappings"],
    queryFn: () => adminApi.listChannelMappings(),
    staleTime: 60 * 60_000, // 1 saat (statik referans)
  });

  const createMut = useMutation({
    mutationFn: (p: {
      source: string;
      medium: string;
      channel_group: string;
      notes?: string;
    }) => adminApi.createChannelMapping(p),
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["channel-mappings"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteChannelMapping(id),
    onSuccess: () => {
      setPendingDelete(null);
      void qc.invalidateQueries({ queryKey: ["channel-mappings"] });
    },
  });

  const data = useMemo(() => q.data ?? [], [q.data]);
  const total = data.length;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter((m) =>
      [m.source, m.medium, m.channel_group, m.notes ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [data, search]);

  return (
    <div className="container mx-auto max-w-[1400px] space-y-5 px-6 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title-sm font-semibold text-foreground">
            {t("admin:channels.title")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-text-muted">
            {t("admin:channels.subtitle")}
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          {t("admin:channels.new_mapping")}
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[280px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin:channels.search_placeholder")}
            className="h-10 pl-9"
          />
        </div>
        <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-xs font-semibold tabular-nums text-text-muted">
          <Network className="size-3.5 text-text-dim" />
          {filtered.length}
          {filtered.length !== total && (
            <span className="text-text-dim">/ {total}</span>
          )}
        </span>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {q.isPending ? (
            <TableSkeleton />
          ) : filtered.length === 0 ? (
            total === 0 ? (
              <EmptyState
                icon={Network}
                title={t("admin:channels.empty_title")}
                body={t("admin:channels.empty_body")}
                actionLabel={t("admin:channels.empty_cta")}
                onAction={() => setOpen(true)}
              />
            ) : (
              <EmptyState
                icon={Search}
                title={t("admin:channels.no_filtered_title")}
                body={t("admin:channels.no_filtered_body")}
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <colgroup>
                  <col className="w-[180px]" />
                  <col className="w-[180px]" />
                  <col className="w-[220px]" />
                  <col />
                  <col className="w-[110px]" />
                  <col className="w-[60px]" />
                </colgroup>
                <TableHeader>
                  <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                    <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:channels.table_source")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:channels.table_medium")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:channels.table_channel_group")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:channels.table_notes")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:channels.table_origin")}
                    </TableHead>
                    <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                      <span className="sr-only">
                        {t("admin:channels.table_actions")}
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m, idx) => (
                    <TableRow
                      key={m.id}
                      className={cn(
                        "border-b border-border/60 transition-colors",
                        idx % 2 === 1 && "bg-surface-2/40",
                        "hover:bg-primary/[0.04]",
                      )}
                    >
                      <TableCell className="px-4 py-3.5">
                        <CodeChip>{m.source}</CodeChip>
                      </TableCell>
                      <TableCell className="px-3 py-3.5">
                        <CodeChip>{m.medium}</CodeChip>
                      </TableCell>
                      <TableCell className="px-3 py-3.5">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                          <ArrowRight className="size-3" />
                          {m.channel_group}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-xs text-text-muted">
                        <span
                          className="block truncate"
                          title={m.notes ?? undefined}
                        >
                          {m.notes ?? (
                            <span className="text-text-dim">—</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-3.5">
                        {m.is_auto_assigned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20">
                            <Cog className="size-3" />
                            {t("admin:channels.auto_badge")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-text-muted">
                            <UserIcon className="size-3" />
                            {t("admin:channels.manual_badge")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setPendingDelete(m)}
                          aria-label={t("admin:channels.delete_title")}
                          title={t("admin:channels.delete_title")}
                          className="size-8 text-text-muted hover:bg-error-500/10 hover:text-error-600"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Network className="size-4" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-base font-semibold text-foreground">
                  {t("admin:channels.new_mapping")}
                </span>
                <span className="text-xs font-normal text-text-muted">
                  {t("admin:channels.new_mapping_subtitle")}
                </span>
              </span>
            </DialogTitle>
          </DialogHeader>
          <ChannelMappingForm
            onSubmit={(p) => createMut.mutate(p)}
            loading={createMut.isPending}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-error-500/10 text-error-600">
                <Trash2 className="size-4" />
              </span>
              <span className="text-base font-semibold text-foreground">
                {t("admin:channels.delete_title")}
              </span>
            </DialogTitle>
          </DialogHeader>
          {pendingDelete && (
            <div className="space-y-3 py-1">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2.5 text-xs">
                <CodeChip>{pendingDelete.source}</CodeChip>
                <span className="text-text-dim">/</span>
                <CodeChip>{pendingDelete.medium}</CodeChip>
                <ArrowRight className="size-3 text-text-dim" />
                <span className="rounded-md bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                  {pendingDelete.channel_group}
                </span>
              </div>
              <p className="text-sm text-text-muted">
                {t("admin:channels.delete_description_suffix")}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                pendingDelete && deleteMut.mutate(pendingDelete.id)
              }
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && (
                <Loader2 className="mr-1 size-4 animate-spin" />
              )}
              {t("admin:channels.delete_yes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CodeChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
      {children}
    </span>
  );
}

function ChannelMappingForm({
  onSubmit,
  loading,
  onCancel,
}: {
  onSubmit: (p: {
    source: string;
    medium: string;
    channel_group: string;
    notes?: string;
  }) => void;
  loading: boolean;
  onCancel: () => void;
}) {
  const { t } = useTranslation("admin");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [group, setGroup] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          source: source.trim(),
          medium: medium.trim(),
          channel_group: group.trim(),
          notes: notes.trim() || undefined,
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldShell
          icon={Globe}
          label={t("channels.field_source")}
          htmlFor="src"
        >
          <Input
            id="src"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={t("channels.field_source_placeholder")}
            required
            autoFocus
          />
        </FieldShell>
        <FieldShell
          icon={Network}
          label={t("channels.field_medium")}
          htmlFor="med"
        >
          <Input
            id="med"
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            placeholder={t("channels.field_medium_placeholder")}
            required
          />
        </FieldShell>
      </div>

      <FieldShell
        icon={LayoutGrid}
        label={t("channels.field_channel_group")}
        htmlFor="grp"
      >
        <Input
          id="grp"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          placeholder={t("channels.field_channel_group_placeholder")}
          required
        />
      </FieldShell>

      <FieldShell label={t("channels.field_notes")} htmlFor="notes">
        <Input
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("channels.field_notes_placeholder")}
        />
      </FieldShell>

      <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/[0.04] px-3 py-2.5 text-xs text-blue-700 dark:text-blue-400">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p className="leading-relaxed">{t("channels.info_hint")}</p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common:cancel", { defaultValue: "İptal" })}
        </Button>
        <Button type="submit" disabled={loading} className="gap-1.5">
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          {t("channels.add_submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function FieldShell({
  icon: Icon,
  label,
  htmlFor,
  children,
}: {
  icon?: typeof Globe;
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 text-xs font-semibold text-foreground"
      >
        {Icon && <Icon className="size-3.5 text-text-muted" />}
        {label}
      </Label>
      {children}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: typeof Network;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="inline-flex size-12 items-center justify-center rounded-full bg-muted text-text-muted">
        <Icon className="size-5" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-md text-xs text-text-muted">{body}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-1 gap-1.5">
          <Plus className="size-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-md bg-surface-2/40 px-3 py-3"
        >
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-7 w-7 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
