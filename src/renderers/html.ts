import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * Rewrite relative paths in HTML content to asset://localhost URLs
 * so local resources (images, CSS) load correctly inside srcdoc iframes.
 *
 * Phase 0 scope:
 *   - <img src>, <link href>, <script src>, <video poster>, <source src>
 *   - Inline <style> blocks: url(...) references
 *
 * NOT handled (Phase 1+):
 *   - External CSS files loaded via <link> (CSS url() refs inside them)
 *   - @import in CSS
 *   - Complex srcset / picture elements
 */
export function rewriteHtmlPaths(
  content: string,
  filePath: string | null,
): string {
  if (!content) return "";
  if (!filePath) return content;

  const dir = getDirPath(filePath);
  if (!dir) return content;

  // Replace src="" and href="" attribute values
  let result = content.replace(
    /(src|href|poster)="([^"]*)"/gi,
    (_match, attr, url) => {
      const resolved = resolvePath(url, dir);
      return resolved !== url
        ? `${attr}="${resolved}"`
        : `${attr}="${url}"`;
    },
  );

  // Replace url() references in inline <style> blocks
  result = result.replace(
    /(<style[^>]*>)(.*?)(<\/style>)/gis,
    (_, open, css, close) => {
      const rewritten = css.replace(
        /url\(['"]?([^'")\s]+)['"]?\)/gi,
        (_cssMatch: string, url: string) => {
          const resolved = resolvePath(url, dir);
          return resolved !== url ? `url('${resolved}')` : `url('${url}')`;
        },
      );
      return `${open}${rewritten}${close}`;
    },
  );

  return result;
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
  const lastSep = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
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
