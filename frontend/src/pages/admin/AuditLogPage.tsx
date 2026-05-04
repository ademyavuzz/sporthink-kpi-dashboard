import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { dayjs } from "@/lib/dayjs";

export default function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState("");
  const q = useQuery({
    queryKey: ["audit-logs", actionFilter],
    queryFn: () => adminApi.listAuditLogs(200, actionFilter || undefined),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Denetim Kayıtları</h1>
        <p className="text-sm text-muted-foreground">
          Sistemdeki kritik işlemlerin denetim izi (login, kullanıcı yönetimi,
          import, ayar değişiklikleri).
        </p>
      </div>

      <div className="flex items-end gap-3 max-w-md">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="filter">Action filtresi</Label>
          <Input
            id="filter"
            placeholder="örn: user., import.completed"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Aksiyon</TableHead>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Kaynak</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Detay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isPending ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Yükleniyor…
                  </TableCell>
                </TableRow>
              ) : (q.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Kayıt yok.
                  </TableCell>
                </TableRow>
              ) : (
                (q.data ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {l.created_at
                        ? dayjs.utc(l.created_at).tz("Europe/Istanbul").format("DD.MM.YYYY HH:mm:ss")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{l.action}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {l.user_email ?? `#${l.user_id ?? "—"}`}
                    </TableCell>
                    <TableCell className="text-xs">
                      {l.resource_type
                        ? `${l.resource_type}/${l.resource_id ?? "—"}`
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {l.ip_address ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[300px] truncate">
                      {l.details ? JSON.stringify(l.details) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
