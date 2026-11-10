import { invoke } from "@tauri-apps/api/core";
import { ensureDiagramEngine } from "../../renderers/diagram/engine";
import { blobToBase64 } from "./base64";
import { buildHtmlDocument } from "./html";
import { inlineImages } from "./inlineImages";
import {
  PNG_MAX_HEIGHT,
  PNG_SCALE,
  PNG_WIDTH,
  PNG_TOO_TALL_MESSAGE,
  defaultCss,
  measureHtmlHeight,
  rasterizeSvgToJpeg,
  svgFromHtml,
  waitForFonts,
  type ExportPngResult,
  type ExportPngSeams,
  type ExportPngInput,
} from "./png";

/** 单页 PDF 的尺寸上限沿用 PNG 长图守卫。 */
export const PDF_MAX_HEIGHT = PNG_MAX_HEIGHT;

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 24;

export function pdfFileName(title: string): string {
  const base =
    title
      .replace(/[\\/]/g, "-")
      .replace(/\.(md|markdown|mdown|mdwn|txt)$/i, "")
      .trim() || "未命名";
  return `${base}.pdf`;
}

/**
 * 单页 PDF：把一张 JPEG 作为 DCTDecode 图像 XObject 嵌入 A4 页面。
 * 零依赖（不引 jsPDF/pdf-lib）；只适合单页，超长文档由高度守卫拦截。
 */
export function buildPdfFromJpeg(
  jpeg: Uint8Array,
  pxWidth: number,
  pxHeight: number,
): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;

  const push = (data: Uint8Array | string): void => {
    const bytes = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(bytes);
    offset += bytes.length;
  };
  const beginObj = (n: number): void => {
    offsets[n] = offset;
    push(`${n} 0 obj\n`);
  };
  const endObj = (): void => push("endobj\n");

  const scale = Math.min(
    (A4_WIDTH - PAGE_MARGIN * 2) / pxWidth,
    (A4_HEIGHT - PAGE_MARGIN * 2) / pxHeight,
  );
  const drawW = pxWidth * scale;
  const drawH = pxHeight * scale;
  const x = (A4_WIDTH - drawW) / 2;
  const y = (A4_HEIGHT - drawH) / 2;

  push("%PDF-1.4\n");

  beginObj(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\n");
  endObj();

  beginObj(2);
  push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n");
  endObj();

  beginObj(3);
  push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\n`,
  );
  endObj();

  beginObj(4);
  push(
    `<< /Type /XObject /Subtype /Image /Width ${pxWidth} /Height ${pxHeight} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\n` +
      "stream\n",
  );
  push(jpeg);
  push("\nendstream\n");
  endObj();

  const content =
    `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ` +
    `${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q\n`;
  beginObj(5);
  push(`<< /Length ${content.length} >>\nstream\n${content}endstream\n`);
  endObj();

  const xrefOffset = offset;
  push("xref\n0 6\n");
  push("0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++) {
    push(`${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

export async function exportPdfFromMarkdown(
  input: ExportPngInput,
  seams: ExportPngSeams = {},
): Promise<ExportPngResult> {
  try {
    if (!input.markdown.trim()) {
      return { status: "error", message: "文档为空，无法导出 PDF" };
    }

    const measure = seams.measure ?? measureHtmlHeight;
    const readBase64 =
      seams.readBase64 ??
      (async (path: string) => {
        try {
          return await invoke<string>("read_file_base64", { path });
        } catch {
          return null;
        }
      });
    const save =
      seams.save ??
      ((base64: string, defaultName: string) =>
        invoke<string | null>("save_binary_as_file", { base64, defaultName }));

    const engine = await ensureDiagramEngine();
    const doc = buildHtmlDocument(input.markdown, {
      title: input.title,
      css: input.css ?? defaultCss(),
      diagramSvg: engine
        ? (source) => engine.renderToSvgOrNull(source)
        : undefined,
    });
    const { html } = await inlineImages(doc, input.baseDir, readBase64);

    await waitForFonts();
    const height = await measure(html, PNG_WIDTH);
    if (height > PDF_MAX_HEIGHT) {
      return { status: "error", message: PNG_TOO_TALL_MESSAGE };
    }

    const svg = svgFromHtml(html, { width: PNG_WIDTH, height });
    const jpegBlob = await rasterizeSvgToJpeg(svg, {
      width: PNG_WIDTH,
      height,
      scale: PNG_SCALE,
      toBlob: seams.toBlob,
    });
    const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
    const pdf = buildPdfFromJpeg(
      jpeg,
      Math.round(PNG_WIDTH * PNG_SCALE),
      Math.round(height * PNG_SCALE),
    );
    const base64 = await blobToBase64(
      new Blob([pdf], { type: "application/pdf" }),
    );

    const path = await save(base64, pdfFileName(input.title));
    if (path === null) return { status: "cancelled" };
    return { status: "saved", path };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    if (reason === "Cancelled" || reason === "Operation cancelled") {
      return { status: "cancelled" };
    }
    return { status: "error", message: reason };
  }
}

export function exportPdfMessage(result: ExportPngResult): string | null {
  if (result.status === "saved") {
    const name = result.path.split("/").pop() ?? "PDF";
    return `已导出 ${name}`;
  }
  if (result.status === "error") return `导出失败：${result.message}`;
  return null;
}
