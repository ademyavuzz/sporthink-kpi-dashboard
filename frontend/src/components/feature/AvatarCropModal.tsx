import { Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AvatarCropModalProps {
  open: boolean;
  /** Yüklenen dosyanın object URL veya data URL'si. */
  imageSrc: string | null;
  onCancel: () => void;
  /** Kırpılmış 256x256 webp blob ile çağrılır. */
  onConfirm: (file: File) => Promise<void> | void;
  /** Çıkış formatı boyutu (default 256). */
  outputSize?: number;
}

const TARGET_TYPE = "image/webp";
const TARGET_QUALITY = 0.9;

/**
 * Profil resmi kırpma modal'ı — `react-easy-crop` üzerinden 1:1 kare seçim.
 *
 * Kullanım:
 * 1. Kullanıcı dosya seçer (input change)
 * 2. Bu modal açılır, sürükle/yakınlaştır
 * 3. Onay → canvas üzerinden 256x256 webp Blob üretilir
 * 4. `onConfirm(file)` ile kırpılmış File döner; çağıran tarafa upload eder
 */
export function AvatarCropModal({
  open,
  imageSrc,
  onCancel,
  onConfirm,
  outputSize = 256,
}: AvatarCropModalProps) {
  const { t } = useTranslation(["settings", "common"]);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  // Modal kapanınca state sıfırla
  useEffect(() => {
    if (!open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedArea(null);
      setBusy(false);
    }
  }, [open]);

  const handleCropComplete = useCallback(
    (_: Area, areaPixels: Area) => setCroppedArea(areaPixels),
    [],
  );

  const handleConfirm = async () => {
    if (!imageSrc || !croppedArea) return;
    setBusy(true);
    try {
      const blob = await cropToBlob(imageSrc, croppedArea, outputSize);
      const file = new File([blob], `avatar-${Date.now()}.webp`, {
        type: TARGET_TYPE,
      });
      await onConfirm(file);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-b border-border/60 px-6 pt-6 pb-4">
          <DialogTitle>{t("settings:crop_title")}</DialogTitle>
          <DialogDescription>{t("settings:crop_subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          <div className="relative h-72 w-full overflow-hidden rounded-xl bg-gray-900 sm:h-80">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
              />
            )}
          </div>

          {/* Zoom slider */}
          <div className="mt-4 flex items-center gap-3">
            <ZoomOut className="size-4 shrink-0 text-text-muted" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary dark:bg-gray-800"
              aria-label={t("settings:crop_zoom")}
            />
            <ZoomIn className="size-4 shrink-0 text-text-muted" />
            <span className="w-10 shrink-0 text-right tabular-nums text-xs text-text-muted">
              {zoom.toFixed(2)}x
            </span>
          </div>

          <p className="mt-4 text-[11px] text-text-dim">
            {t("settings:crop_hint")}
          </p>
        </div>

        <DialogFooter className="border-t border-border/60 px-6 py-4">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {t("common:cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={busy || !croppedArea} className="gap-1.5">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {t("settings:crop_confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Kırpma alanı + zoom + offset üzerinden hedef boyutta canvas blob üretir.
 *
 * `imageSrc` HTMLImageElement'e yüklenir, sonra istenen `area` (image
 * piksel cinsinden) `outputSize` kareye boyutlandırılarak çizilir.
 */
async function cropToBlob(
  imageSrc: string,
  area: Area,
  outputSize: number,
): Promise<Blob> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))),
      TARGET_TYPE,
      TARGET_QUALITY,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}
