import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dayjs } from "@/lib/dayjs";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api/client";
import { importsApi } from "@/lib/api/imports";
import type { ImportListItem } from "@/types/imports";

import { formatDuration, statusToBadgeVariant } from "./lib";

export default function ImportHistoryPage() {
  const { t } = useTranslation(["imports", "common"]);
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<ImportListItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["imports", "list"],
    queryFn: () => importsApi.list(),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => importsApi.deleteById(id),
    onSuccess: () => {
      setPendingDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["imports", "list"] });
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : t("imports:errors.delete_failed"));
    },
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("imports:history.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("imports:page_subtitle")}</p>
        </div>
        <Button asChild>
          <Link to="/import">{t("imports:tab_new")}</Link>
        </Button>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {listQuery.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t("imports:errors.history_load_failed")}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          {listQuery.isPending ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (listQuery.data?.length ?? 0) === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              {t("imports:history.empty")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("imports:history.col_id")}</TableHead>
                    <TableHead>{t("imports:history.col_data_type")}</TableHead>
                    <TableHead>{t("imports:history.col_file_name")}</TableHead>
                    <TableHead>{t("imports:history.col_status")}</TableHead>
                    <TableHead className="text-right">
                      {t("imports:history.col_total_rows")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("imports:history.col_inserted")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("imports:history.col_invalid")}
                    </TableHead>
                    <TableHead>{t("imports:history.col_duration")}</TableHead>
                    <TableHead>{t("imports:history.col_created_at")}</TableHead>
                    <TableHead className="text-right">
                      {t("imports:history.col_actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(listQuery.data ?? []).map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-mono text-xs">{it.id}</TableCell>
                      <TableCell>{it.data_type}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={it.file_name}>
                        {it.file_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusToBadgeVariant(it.status)}>
                          {t(`imports:status.${it.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {it.total_rows?.toLocaleString("tr-TR") ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {it.inserted_rows?.toLocaleString("tr-TR") ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {it.invalid_rows ? (
                          <span className="text-destructive">
                            {it.invalid_rows.toLocaleString("tr-TR")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDuration(it.duration_seconds)}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {dayjs.utc(it.created_at).tz("Europe/Istanbul").format("DD.MM.YYYY HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingDelete(it)}
                          aria-label={t("imports:history.btn_delete")}
                        >
                          <Trash2 className="h-4 w-4" />
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

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("imports:history.delete_confirm_title")}</DialogTitle>
            <DialogDescription>
              {t("imports:history.delete_confirm_body", {
                rows: pendingDelete?.inserted_rows?.toLocaleString("tr-TR") ?? "0",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleteMutation.isPending}
            >
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                pendingDelete && deleteMutation.mutate(pendingDelete.id)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {t("imports:history.delete_confirm_yes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
