import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CreditCard,
  Loader2,
  Mail,
  MapPin,
  Package,
  Receipt,
  ShoppingBag,
  Tag,
  User as UserIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
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
import { dashboardApi } from "@/lib/api/dashboard";
import { dayjs } from "@/lib/dayjs";
import { formatCount, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface OrderDetailDialogProps {
  open: boolean;
  orderPkId: number | null;
  onOpenChange: (open: boolean) => void;
}

export function OrderDetailDialog({
  open,
  orderPkId,
  onOpenChange,
}: OrderDetailDialogProps) {
  const { t } = useTranslation("dashboard");

  const q = useQuery({
    queryKey: ["ecom", "order-detail", orderPkId],
    queryFn: () => dashboardApi.ecomOrderDetail(orderPkId!),
    enabled: open && orderPkId != null,
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const loading = q.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        <DialogHeader className="border-b border-border/60 px-6 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Receipt className="size-4" />
            </span>
            <span className="text-base font-semibold">
              {data?.order_id ?? t("ecom.order_detail_title")}
            </span>
            {data && (
              <StatusBadge status={data.order_status} />
            )}
          </DialogTitle>
        </DialogHeader>

        {loading || !data ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-text-muted" />
          </div>
        ) : (
          <div className="max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-1 gap-4 px-6 py-5 lg:grid-cols-3">
              <SummaryCard
                icon={<CalendarDays className="size-3.5" />}
                label={t("ecom.col_date")}
                value={dayjs(data.order_date).format("DD.MM.YYYY")}
              />
              <SummaryCard
                icon={<CreditCard className="size-3.5" />}
                label={t("ecom.filter_payment")}
                value={t(`ecom.payment_${data.payment_method}`, {
                  defaultValue: data.payment_method,
                })}
              />
              <SummaryCard
                icon={<MapPin className="size-3.5" />}
                label={t("ecom.col_city")}
                value={data.city}
              />
              <SummaryCard
                icon={<Tag className="size-3.5" />}
                label={t("ecom.label_channel")}
                value={data.channel}
              />
              <SummaryCard
                icon={<Package className="size-3.5" />}
                label={t("ecom.label_device")}
                value={t(`ecom.device_${data.device}`, {
                  defaultValue: data.device,
                })}
              />
              <SummaryCard
                icon={<ShoppingBag className="size-3.5" />}
                label={t("ecom.label_campaign")}
                value={data.campaign_name ?? "—"}
              />
            </div>

            <section className="border-t border-border/60 px-6 py-4">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-dim">
                {t("ecom.line_items")}
              </h3>
              <div className="overflow-hidden rounded-lg border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                      <TableHead className="px-3 py-2 text-[11px] uppercase tracking-wider text-text-dim">
                        {t("ecom.col_sku")}
                      </TableHead>
                      <TableHead className="px-3 py-2 text-[11px] uppercase tracking-wider text-text-dim">
                        {t("ecom.col_product")}
                      </TableHead>
                      <TableHead className="px-3 py-2 text-[11px] uppercase tracking-wider text-text-dim">
                        {t("ecom.col_brand")}
                      </TableHead>
                      <TableHead className="px-3 py-2 text-right text-[11px] uppercase tracking-wider text-text-dim">
                        {t("ecom.col_qty")}
                      </TableHead>
                      <TableHead className="px-3 py-2 text-right text-[11px] uppercase tracking-wider text-text-dim">
                        {t("ecom.col_unit_price")}
                      </TableHead>
                      <TableHead className="px-3 py-2 text-right text-[11px] uppercase tracking-wider text-text-dim">
                        {t("ecom.col_total")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.line_items.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-6 text-center text-sm text-text-muted"
                        >
                          —
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.line_items.map((item, idx) => (
                        <TableRow
                          key={`${item.sku}-${idx}`}
                          className={cn(
                            "border-b border-border/60",
                            idx % 2 === 1 && "bg-surface-2/40",
                          )}
                        >
                          <TableCell className="px-3 py-2.5 font-mono text-[11px] text-text-muted">
                            {item.sku}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-xs">
                            <span
                              className="block max-w-[260px] truncate font-medium"
                              title={item.product_name ?? ""}
                            >
                              {item.product_name ?? "—"}
                            </span>
                            {item.category && (
                              <span className="block text-[10px] text-text-dim">
                                {item.category}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-xs text-text-muted">
                            {item.brand ?? "—"}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-right text-xs tabular-nums">
                            {formatCount(item.quantity)}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-right text-xs tabular-nums text-text-muted">
                            {formatCurrency(item.unit_price)}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums">
                            {formatCurrency(item.line_total)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 border-t border-border/60 px-6 py-5 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-dim">
                  {t("ecom.totals")}
                </h3>
                <dl className="space-y-1.5 text-sm">
                  <TotalsRow
                    label={t("ecom.gross_revenue")}
                    value={formatCurrency(data.order_revenue)}
                  />
                  <TotalsRow
                    label={t("ecom.shipping")}
                    value={formatCurrency(data.shipping_cost)}
                  />
                  <TotalsRow
                    label={t("ecom.discount")}
                    value={`- ${formatCurrency(data.discount_amount)}`}
                  />
                  <TotalsRow
                    label={t("ecom.refund")}
                    value={`- ${formatCurrency(data.refund_amount)}`}
                  />
                  <TotalsRow
                    label={t("ecom.net_revenue")}
                    value={formatCurrency(data.net_revenue)}
                    bold
                  />
                </dl>
              </div>

              <div>
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-dim">
                  {t("ecom.customer_info")}
                </h3>
                <div className="space-y-2 text-sm">
                  <CustomerRow
                    icon={<UserIcon className="size-3.5" />}
                    label={t("ecom.col_name")}
                    value={data.customer.customer_name ?? data.customer.customer_id}
                  />
                  <CustomerRow
                    label={t("ecom.col_customer_id")}
                    value={
                      <span className="font-mono text-xs text-text-muted">
                        {data.customer.customer_id}
                      </span>
                    }
                  />
                  {data.customer.city && (
                    <CustomerRow
                      icon={<MapPin className="size-3.5" />}
                      label={t("ecom.col_city")}
                      value={data.customer.city}
                    />
                  )}
                  {data.customer.gender && (
                    <CustomerRow
                      label={t("ecom.col_gender")}
                      value={t(`ecom.gender_${data.customer.gender}`, {
                        defaultValue: data.customer.gender,
                      })}
                    />
                  )}
                  {data.customer.age_group && (
                    <CustomerRow
                      label={t("ecom.col_age_group")}
                      value={data.customer.age_group}
                    />
                  )}
                  <CustomerRow
                    icon={<Mail className="size-3.5" />}
                    label={t("ecom.newsletter")}
                    value={
                      data.customer.is_newsletter_subscriber
                        ? t("ecom.subscribed")
                        : t("ecom.unsubscribed")
                    }
                  />
                  <CustomerRow
                    label={t("ecom.col_orders")}
                    value={formatCount(data.customer.total_orders)}
                  />
                  <CustomerRow
                    label={t("ecom.lifetime_revenue")}
                    value={formatCurrency(data.customer.total_revenue)}
                    bold
                  />
                </div>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-2/50 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-dim">
        {icon}
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-medium text-foreground" title={value}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("dashboard");
  const tone: Record<string, string> = {
    completed: "bg-success/10 text-success border-success/30",
    shipped: "bg-info/10 text-info border-info/30",
    pending: "bg-warning/10 text-warning border-warning/30",
    cancelled: "bg-muted text-text-muted border-border",
    refunded: "bg-error/10 text-error border-error/30",
  };
  return (
    <span
      className={cn(
        "ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tone[status] ?? "bg-muted text-text-muted border-border",
      )}
    >
      {t(`ecom.status_${status}`, { defaultValue: status })}
    </span>
  );
}

function TotalsRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-1",
        bold && "border-t border-border/60 pt-2 font-semibold",
      )}
    >
      <span className={cn("text-text-muted", bold && "text-foreground")}>
        {label}
      </span>
      <span className={cn("tabular-nums", bold && "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

function CustomerRow({
  icon,
  label,
  value,
  bold,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-xs text-text-muted">
        {icon}
        {label}
      </span>
      <span
        className={cn("text-right text-sm", bold && "font-semibold text-foreground")}
      >
        {value}
      </span>
    </div>
  );
}
