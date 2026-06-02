/**
 * Tablo verisi disa aktarma yardimcilari — CSV ve XLSX.
 *
 * Hedef: kullanici ekranda gordugu (filtre uygulanmis) satirlari bire bir
 * indirebilsin. Bu modul saf bir util'dir; React'a, store'a veya API'ye
 * bagimli degildir. Cagiran taraf zaten filtrelenmis `rows` ve gorunmek
 * istenen `columns` listesini gecer.
 *
 * Bagimlilik notu: XLSX cikti dependency-free uretilir. `.xlsx` bir ZIP
 * arsividir; burada kucuk, sikistirmasiz (STORE) bir ZIP yazici + minimal
 * OOXML (SpreadsheetML) sema kullanilir. Boylece yeni bir paket eklemeden
 * Excel/LibreOffice'in dogal actigi gercek bir `.xlsx` uretilir.
 *
 * Turkce karakter: CSV ciktisi UTF-8 BOM ile baslar (Excel'in dogru
 * decode etmesi icin). XLSX zaten UTF-8 XML tasir.
 */

/** Tek bir disa aktarma kolonu tanimi. */
export interface ExportColumn<TRow> {
  /** Basliga yazilacak (cozulmus) metin. Cagiran taraf t() ile cozer. */
  header: string;
  /**
   * Satirdan hucre degerini cikarir. Donus string | number | null olabilir.
   * Para/sayi degerleri ham (formatlanmamis) verilebilir; sayi olarak gecmek
   * Excel'de dogru sayisal hucre uretir. UI'daki gorsel formatla birebir
   * eslesme isteniyorsa cagiran taraf formatli string dondurebilir.
   */
  accessor: (row: TRow) => string | number | null | undefined;
}

/** CSV/XLSX icin tarayicida dosya indirmeyi tetikler. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Bir sonraki tick'te revoke et — bazi tarayicilarda hemen revoke indirmeyi bozar.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** RFC 4180: tirnak, virgul, satir sonu varsa hucreyi cift tirnakla sar. */
function escapeCsvCell(value: string): string {
  if (/["\n\r,;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cellToString(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return typeof value === "number" ? String(value) : value;
}

/**
 * Satirlari CSV olarak indirir. UTF-8 BOM ile baslar (Turkce karakter).
 * Ayrac noktali virgul (`;`) — Excel TR locale'de virgul ondalik ayraci
 * oldugu icin `;` daha guvenli acilir.
 */
export function exportCsv<TRow>(
  rows: TRow[],
  columns: ExportColumn<TRow>[],
  filename: string,
): void {
  const sep = ";";
  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(sep);
  const bodyLines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(cellToString(c.accessor(row)))).join(sep),
  );
  const content = [headerLine, ...bodyLines].join("\r\n");
  // UTF-8 BOM (U+FEFF) — Excel'in UTF-8 algilamasi icin (Turkce karakter).
  const bom = "\uFEFF";
  const blob = new Blob([bom + content], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(blob, ensureExtension(filename, "csv"));
}

// --- XLSX (dependency-free, STORE-only ZIP + minimal OOXML) ---

/** XML metin kacisi. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Sutun indeksini (0 tabanli) Excel sutun harfine cevirir (0 → A, 26 → AA). */
function colLetter(index: number): string {
  let n = index;
  let letter = "";
  do {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letter;
}

/** Tek bir hucre icin <c> XML'i — sayi ise numeric, degilse inlineStr. */
function buildCellXml(
  value: string | number | null | undefined,
  ref: string,
): string {
  if (value === null || value === undefined || value === "") {
    return `<c r="${ref}"/>`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(
    String(value),
  )}</t></is></c>`;
}

function buildSheetXml<TRow>(rows: TRow[], columns: ExportColumn<TRow>[]): string {
  const allRows: string[] = [];

  // Baslik satiri (Excel satir numarasi 1).
  const headerCells = columns
    .map((c, ci) => buildCellXml(c.header, `${colLetter(ci)}1`))
    .join("");
  allRows.push(`<row r="1">${headerCells}</row>`);

  rows.forEach((row, ri) => {
    const rowNum = ri + 2;
    const cells = columns
      .map((c, ci) => buildCellXml(c.accessor(row), `${colLetter(ci)}${rowNum}`))
      .join("");
    allRows.push(`<row r="${rowNum}">${cells}</row>`);
  });

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${allRows.join("")}</sheetData>` +
    "</worksheet>"
  );
}

/**
 * Satirlari gercek bir `.xlsx` (OOXML) dosyasi olarak indirir.
 * Yeni bir kutuphane gerektirmez; minimal sema + STORE ZIP ile uretilir.
 */
export function exportXlsx<TRow>(
  rows: TRow[],
  columns: ExportColumn<TRow>[],
  filename: string,
  sheetName = "Sheet1",
): void {
  const safeSheet = escapeXml(sheetName).slice(0, 31) || "Sheet1";

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    "</Types>";

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    "</Relationships>";

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${safeSheet}" sheetId="1" r:id="rId1"/></sheets>` +
    "</workbook>";

  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    "</Relationships>";

  const sheet = buildSheetXml(rows, columns);

  const blob = createZip([
    { name: "[Content_Types].xml", content: contentTypes },
    { name: "_rels/.rels", content: rootRels },
    { name: "xl/workbook.xml", content: workbook },
    { name: "xl/_rels/workbook.xml.rels", content: workbookRels },
    { name: "xl/worksheets/sheet1.xml", content: sheet },
  ]);

  triggerDownload(blob, ensureExtension(filename, "xlsx"));
}

// --- Minimal ZIP yazici (STORE / sikistirmasiz) ---

interface ZipEntry {
  name: string;
  content: string;
}

const CRC_TABLE: number[] = (() => {
  const table = new Array<number>(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] ?? 0;
    const idx = (crc ^ byte) & 0xff;
    crc = (CRC_TABLE[idx] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Sikistirmasiz (STORE) tek bir ZIP arsivi olusturur. */
function createZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const fileParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = encoder.encode(entry.content);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 byte sabit + isim).
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // imza
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // bit flag: UTF-8 isim
    local.setUint16(8, 0, true); // STORE (sikistirma yok)
    local.setUint16(10, 0, true); // mod zamani
    local.setUint16(12, 0, true); // mod tarihi
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true); // compressed size
    local.setUint32(22, size, true); // uncompressed size
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true); // extra alan uzunlugu

    fileParts.push(new Uint8Array(local.buffer), nameBytes, dataBytes);

    // Central directory header.
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true); // version made by
    central.setUint16(6, 20, true); // version needed
    central.setUint16(8, 0x0800, true); // UTF-8 bayragi
    central.setUint16(10, 0, true); // STORE
    central.setUint16(12, 0, true);
    central.setUint16(14, 0, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, size, true);
    central.setUint32(24, size, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint16(30, 0, true); // extra
    central.setUint16(32, 0, true); // comment
    central.setUint16(34, 0, true); // disk no
    central.setUint16(36, 0, true); // ic oznitelik
    central.setUint32(38, 0, true); // dis oznitelik
    central.setUint32(42, offset, true); // local header offset
    centralParts.push(new Uint8Array(central.buffer), nameBytes);

    offset += 30 + nameBytes.length + size;
  }

  const centralSize = centralParts.reduce((sum, p) => sum + p.length, 0);
  const centralOffset = offset;

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(4, 0, true); // disk no
  end.setUint16(6, 0, true); // central dir disk
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, centralOffset, true);
  end.setUint16(20, 0, true); // comment uzunlugu

  const parts: BlobPart[] = [
    ...fileParts,
    ...centralParts,
    new Uint8Array(end.buffer),
  ];
  return new Blob(parts, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// --- Dosya adi yardimcilari ---

/** Dosya adina uzanti yoksa ekler. */
function ensureExtension(filename: string, ext: string): string {
  const lower = filename.toLowerCase();
  return lower.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
}

/**
 * Tutarli, dosya-sistemi guvenli bir export dosya adi uretir.
 * Orn: buildExportFilename("orders", "2024-10-01", "2025-03-31")
 *   → "orders_2024-10-01_2025-03-31"
 * Uzanti CSV/XLSX fonksiyonu tarafindan eklenir.
 */
export function buildExportFilename(
  base: string,
  dateFrom?: string,
  dateTo?: string,
): string {
  const safeBase = base.replace(/[^a-z0-9_-]+/gi, "-").replace(/-+/g, "-");
  const parts = [safeBase];
  if (dateFrom && dateTo) parts.push(dateFrom, dateTo);
  return parts.join("_");
}
