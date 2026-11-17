export function previewLineCount(content: string): number {
  return content.split("\n").length;
}

export function renderPreviewLineNumbers(content: string): string {
  const count = previewLineCount(content);
  let items = "";
  for (let i = 1; i <= count; i += 1) {
    items += `<span data-preview-line-number="${i}">${i}</span>`;
  }
  return `<div class="code-line-numbers" aria-hidden="true">${items}</div>`;
}
