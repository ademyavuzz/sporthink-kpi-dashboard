import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { CampaignDetailDialog } from "@/components/feature/CampaignDetailDialog";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dashboardApi } from "@/lib/api/dashboard";
import {
  formatCount,
  formatCurrency,
  formatMultiplier,
  formatPercent,
  toNumber,
} from "@/lib/format";

import { DashboardHeader, useDashboardRange } from "./_shared";

type PlatformFilter = "all" | "meta" | "google";

export default function CampaignsPage() {
  const [range, setRange] = useDashboardRange();
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [detailCampaign, setDetailCampaign] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["dashboard", "campaign", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.campaign({
        date_from: range.date_from,
        date_to: range.date_to,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;
  const filtered =
    data?.campaigns.filter((c) =>
      platform === "all" ? true : c.platform === platform,
    ) ?? [];

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Kampanya Analizi"
        range={range}
        onChangeRange={setRange}
        actions={
          <Select value={platform} onValueChange={(v) => setPlatform(v as PlatformFilter)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="meta">Meta</SelectItem>
              <SelectItem value="google">Google</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <KPICardSkeleton key={i} />)
          : data && (
              <>
                <KPICard kpi={data.total_spend} />
                <KPICard kpi={data.total_revenue} />
                <KPICard kpi={data.overall_roas} />
              </>
            )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tüm Kampanyalar ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>Kampanya</TableHead>
                  <TableHead className="text-right">Gösterim</TableHead>
                  <TableHead className="text-right">Tıklama</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">Harcama</TableHead>
                  <TableHead className="text-right">Dönüşüm</TableHead>
                  <TableHead className="text-right">Gelir</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                  <TableHead className="text-right w-12">Detay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={10}>
                          <div className="h-5 bg-muted rounded animate-pulse" />
                        </TableCell>
                      </TableRow>
                    ))
                  : filtered.map((c) => {
                      const roasNum = toNumber(c.roas);
                      return (
                        <TableRow
                          key={c.campaign_id}
                          className="cursor-pointer hover:bg-accent/40"
                          onClick={() => c.campaign_name && setDetailCampaign(c.campaign_name)}
                        >
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {c.platform ?? "—"}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className="max-w-[280px] truncate"
                            title={c.campaign_name ?? ""}
                          >
                            {c.campaign_name ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCount(c.impressions)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCount(c.clicks)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {c.ctr ? formatPercent(toNumber(c.ctr)! * 100, 2) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(c.spend)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCount(c.conversions)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(c.conversions_value)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                roasNum && roasNum >= 4 ? "default" : "secondary"
                              }
                            >
                              {formatMultiplier(c.roas)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (c.campaign_name) setDetailCampaign(c.campaign_name);
                              }}
                              aria-label="Kampanya detayı"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CampaignDetailDialog
        open={detailCampaign !== null}
        onOpenChange={(o) => !o && setDetailCampaign(null)}
        campaignName={detailCampaign}
        dateFrom={range.date_from}
        dateTo={range.date_to}
      />
    </div>
  );
}
