import { createPdfiumDirectEngine } from "@embedpdf/engines/pdfium";
import type { PdfEngine } from "@embedpdf/engines";
import { loadPdfBytes } from "../utils/pdfSource";

/**
 * PDF 首页缩略图（#317 / OQ-1 方案①）。
 *
 * 卡片里不能嵌 PDF 查看器（#286：WKWebView 的 PDFKit 控制条挡不住），所以改成
 * 用同一套 pdfium 把首页渲成位图，卡片只显示一张 <img>。wasm 走 public/ 下的
 * 本地文件，不依赖网络。
 */
const WASM_URL = "/pdfium.wasm";
const SCALE = 0.5;
const IMAGE_TYPE = "image/png";

export type PdfThumbRenderer = (path: string) => Promise<string | null>;

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

let enginePromise: Promise<PdfEngine<Blob>> | null = null;

function getEngine(): Promise<PdfEngine<Blob>> {
  if (!enginePromise) {
    const created = createPdfiumDirectEngine(WASM_URL, {
      fontFallback: null,
    });
    enginePromise = created;
    created.catch(() => {
      enginePromise = null;
    });
  }
  return enginePromise;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(reader.error ?? new Error("blob read failed"));
    reader.readAsDataURL(blob);
  });
}

async function renderWithPdfium(path: string): Promise<string | null> {
  const loaded = await loadPdfBytes(path);
  if (!loaded.ok) return null;

  const engine = await getEngine();
  const doc = await engine
    .openDocumentBuffer({ id: path, content: toArrayBuffer(loaded.bytes) })
    .toPromise();
  const page = doc.pages?.[0];
  if (!page) return null;

  const blob = await engine
    .renderPage(doc, page, { scaleFactor: SCALE, imageType: IMAGE_TYPE })
    .toPromise();
  return blobToDataUrl(blob);
}

let renderer: PdfThumbRenderer = renderWithPdfium;

/** 已生成的缩略图；`undefined` = 还没试过，`null` = 试过但失败（走占位）。 */
export function pdfThumbCacheGet(path: string): string | null | undefined {
  return cache.get(path);
}

/** 生成首页缩略图。失败只返回 null，绝不抛——卡片其余信息不受影响。 */
export function pdfThumbOf(path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit !== undefined) return Promise.resolve(hit);

  const running = inflight.get(path);
  if (running) return running;

  const job = (async (): Promise<string | null> => {
    let result: string | null = null;
    try {
      result = await renderer(path);
    } catch {
      result = null;
    }
    // 只缓存成功结果：wasm 加载失败这类瞬时错误不该把该文件永久钉在占位上
    if (result) cache.set(path, result);
    inflight.delete(path);
    return result;
  })();

  inflight.set(path, job);
  return job;
}

/** 单测注入用；传 null 恢复真实 pdfium 渲染。 */
export function setPdfThumbRenderer(next: PdfThumbRenderer | null): void {
  renderer = next ?? renderWithPdfium;
  cache.clear();
  inflight.clear();
}

/** 单测清缓存用。 */
export function clearPdfThumbCache(): void {
  cache.clear();
  inflight.clear();
}
