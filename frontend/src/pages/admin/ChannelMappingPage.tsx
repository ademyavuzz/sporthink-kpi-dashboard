import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
import type { ChannelMappingItem } from "@/types/admin";

export default function ChannelMappingPage() {
  const { t } = useTranslation(["admin", "common"]);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChannelMappingItem | null>(null);

  const q = useQuery({
    queryKey: ["channel-mappings"],
    queryFn: () => adminApi.listChannelMappings(),
    staleTime: 60 * 60_000, // 1 saat (statik referans)
  });

  const createMut = useMutation({
    mutationFn: (p: { source: string; medium: string; channel_group: string; notes?: string }) =>
      adminApi.createChannelMapping(p),
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("admin:channels.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("admin:channels.subtitle")}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("admin:channels.new_mapping")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin:channels.table_source")}</TableHead>
                <TableHead>{t("admin:channels.table_medium")}</TableHead>
                <TableHead>{t("admin:channels.table_channel_group")}</TableHead>
                <TableHead>{t("admin:channels.table_notes")}</TableHead>
                <TableHead className="text-right">{t("admin:channels.table_actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isPending ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    {t("common:loading")}
                  </TableCell>
                </TableRow>
              ) : (
                (q.data ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.source}</TableCell>
                    <TableCell className="font-mono text-xs">{m.medium}</TableCell>
                    <TableCell>{m.channel_group}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDelete(m)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin:channels.new_mapping")}</DialogTitle>
          </DialogHeader>
          <ChannelMappingForm
            onSubmit={(p) => createMut.mutate(p)}
            loading={createMut.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={() => setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin:channels.delete_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            <code>{pendingDelete?.source}</code> /{" "}
            <code>{pendingDelete?.medium}</code> →{" "}
            <strong>{pendingDelete?.channel_group}</strong>{" "}
            {t("admin:channels.delete_description_suffix")}
          </p>
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
              {t("admin:channels.delete_yes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChannelMappingForm({
  onSubmit,
  loading,
}: {
  onSubmit: (p: { source: string; medium: string; channel_group: string; notes?: string }) => void;
  loading: boolean;
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
        onSubmit({ source, medium, channel_group: group, notes: notes || undefined });
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="src">{t("channels.table_source")}</Label>
          <Input id="src" value={source} onChange={(e) => setSource(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="med">{t("channels.table_medium")}</Label>
          <Input id="med" value={medium} onChange={(e) => setMedium(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="grp">{t("channels.table_channel_group")}</Label>
        <Input
          id="grp"
          placeholder={t("channels.field_channel_group_placeholder")}
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t("channels.field_notes")}</Label>
        <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t("channels.add_submit")}
        </Button>
      </div>
    </form>
  );
}
