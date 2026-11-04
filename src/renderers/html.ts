import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * Build an asset-protocol URL that PRESERVES directory structure, unlike
 * `convertFileSrc` which percent-encodes the whole path into a single
 * segment (`asset://localhost/%2FUsers%2F...`). With a collapsed base URL,
 * relative references inside the loaded document (e.g. `<script src="a.js">`)
 * resolve against the asset root and 404 — breaking script/css/image loading
 * for any HTML page that uses relative resources.
 *
 * Format: `{convertFileSrc prefix}/%2F<seg1>/<seg2>/...` — the leading `%2F`
 * keeps absolute-path semantics (survives the handler's leading-`/` strip and
 * decodes back to `/`), while inner segments stay percent-encoded per segment
 * with literal `/` separators, so the document's base URL keeps its directory
 * shape and relative references resolve to their sibling files.
 */
export function buildAssetUrl(filePath: string): string {
  if (!filePath) return "";
  // Reuse convertFileSrc for the platform scheme prefix (asset://localhost on
  // macOS/Linux, http://asset.localhost on Windows), discard its collapsed path.
  const prefixed = convertFileSrc(filePath);
  const prefix = prefixed.slice(0, prefixed.lastIndexOf("/") + 1);
  if (!prefix) return prefixed;

  const normalized = filePath.replace(/\\/g, "/");
  const segments = normalized
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg));
  if (segments.length === 0) return prefixed;

  return `${prefix}%2F${segments.join("/")}`;
}

/**
 * Rewrite relative paths in HTML content to asset://localhost URLs
 * so local resources (images, CSS) load correctly inside srcdoc iframes.
 *
 * Scope:
 *   - <img src>, <link href>, <script src>, <video poster>, <source src>
 *   - srcset attributes (img/source responsive candidates)
 *   - Inline <style> blocks: url(...) and @import "..." references
 *
 * NOT rewritten (handled by the Tauri asset protocol at load time):
 *   - External CSS files loaded via <link> (their relative url()/@import
 *     resolve against the asset URL naturally)
 */
export function rewriteHtmlPaths(
  content: string,
  filePath: string | null,
): string {
  if (!content) return "";
  if (!filePath) return content;

  const dir = getDirPath(filePath);
  if (!dir) return content;

  // Replace src/href/poster values — **双引号与单引号都要管**。
  // 用户手写的 HTML 里单引号很常见；只认双引号时这些引用不会被重写，
  // 在 srcdoc 里就变成相对应用 origin 的 404（E-15 走查发现）。
  let result = content.replace(
    /(src|href|poster)=("([^"]*)"|'([^']*)')/gi,
    (_match, attr, _quoted, doubleValue, singleValue) => {
      const url: string = doubleValue ?? singleValue ?? "";
      const resolved = resolvePath(url, dir);
      const value = resolved !== url ? resolved : url;
      // 保留原引号风格，减少无谓 diff（导出的 HTML 也应该看起来没被动过）
      return doubleValue !== undefined
        ? `${attr}="${value}"`
        : `${attr}='${value}'`;
    },
  );

  // Replace srcset="" candidate lists (img/source responsive images)
  result = result.replace(/(\ssrcset)="([^"]*)"/gi, (_match, attr, value) => {
    const rewritten = rewriteSrcsetAttr(value, (url) => resolvePath(url, dir));
    return `${attr}="${rewritten}"`;
  });

  // Replace url() references in inline <style> blocks
  result = result.replace(
    /(<style[^>]*>)(.*?)(<\/style>)/gis,
    (_, open, css, close) => {
      const rewritten = css
        .replace(
          /url\(['"]?([^'")\s]+)['"]?\)/gi,
          (_cssMatch: string, url: string) => {
            const resolved = resolvePath(url, dir);
            return resolved !== url ? `url('${resolved}')` : `url('${url}')`;
          },
        )
        .replace(
          /@import\s+["']([^"']+)["']/gi,
          (_cssMatch: string, url: string) => {
            const resolved = resolvePath(url, dir);
            return resolved !== url ? `@import "${resolved}"` : _cssMatch;
          },
        );
      return `${open}${rewritten}${close}`;
    },
  );

  return result;
}

/**
 * Rewrite a srcset attribute value: split candidates on ",", separate the
 * URL from its descriptor (1x/2x/100w), resolve each URL, reassemble.
 * Exported for unit testing with an injected resolver.
 */
export function rewriteSrcsetAttr(
  value: string,
  resolve: (url: string) => string,
): string {
  const trimmed = value.trim();
  // data: srcset 含内嵌逗号，整值跳过以免疫拆分
  if (!trimmed || /^data:/i.test(trimmed)) return value;

  const candidates = trimmed
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (candidates.length === 0) return value;

  const rewritten = candidates.map((c) => {
    const [url, ...descriptors] = c.split(/\s+/);
    if (!url) return c;
    const resolved = resolve(url);
    if (resolved === url) return c;
    return [resolved, ...descriptors].join(" ");
  });
  return rewritten.join(", ");
}

/**
 * Resolve a potentially-relative URL against a base directory.
 * Returns the original URL if it's absolute/external or can't be resolved.
 */
function resolvePath(url: string, baseDir: string): string {
  const trimmed = url.trim();

  // Skip absolute URLs, data URIs, anchor-only, and already-converted asset URLs
  if (
    !trimmed ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("file://") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("asset://") ||
    trimmed.startsWith("tauri://")
  ) {
    return url;
  }

  // Resolve relative path against base directory
  const resolved = resolveRelativePath(trimmed, baseDir);
  if (!resolved) return url;

  // Convert to Tauri asset URL
  try {
    return convertFileSrc(resolved);
  } catch {
    return url;
  }
}

/**
 * Get the parent directory path from a file path.
 */
function getDirPath(filePath: string): string | null {
  const lastSep = Math.max(
    filePath.lastIndexOf("/"),
    filePath.lastIndexOf("\\"),
  );
  if (lastSep === -1) return null;
  return filePath.substring(0, lastSep);
}

/**
 * Resolve a relative path against a base directory.
 */
function resolveRelativePath(relative: string, baseDir: string): string | null {
  // Normalize separators
  const norm = relative.replace(/\\/g, "/");
  const sep = "/";

  // Already absolute (starts with /) — treat as relative to filesystem root
  // (this is rare for local HTML, but handle gracefully)
  if (norm.startsWith("/")) {
    return norm;
  }

  // Combine base directory with relative path
  const parts = [...baseDir.split(sep).filter(Boolean)];

  for (const part of norm.split(sep)) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }

  if (parts.length === 0) return null;
  return `/${parts.join(sep)}`;
}
