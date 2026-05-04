import { BarChart3 } from "lucide-react";

interface ChartEmptyProps {
  height?: number;
  message?: string;
  icon?: React.ReactNode;
}

/** Chart için tutarlı empty/loading state'ler. */
export function ChartEmpty({
  height = 300,
  message = "Bu dönemde gösterilecek veri yok",
  icon,
}: ChartEmptyProps) {
  return (
    <div
      style={{ height }}
      className="flex flex-col items-center justify-center gap-2 text-muted-foreground border border-dashed rounded-md"
    >
      {icon ?? <BarChart3 className="h-8 w-8 opacity-40" />}
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function ChartLoading({ height = 300 }: { height?: number }) {
  return (
    <div
      style={{ height }}
      className="bg-muted/40 rounded-md animate-pulse flex items-center justify-center"
    >
      <div className="flex items-end gap-1.5 h-1/3">
        {[0.6, 0.8, 0.4, 0.9, 0.5, 0.7, 0.55].map((h, i) => (
          <div
            key={i}
            className="w-3 bg-muted-foreground/30 rounded-sm"
            style={{ height: `${h * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
