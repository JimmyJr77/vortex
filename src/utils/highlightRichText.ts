/** Escape plain text for safe HTML display when no markup present. */
export function plainTextToHtml(text: string): string {
  if (!text) return ''
  if (/<[a-z][\s\S]*>/i.test(text)) return text
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />')
}

/** Minimal sanitization for admin-authored highlight HTML. */
export function sanitizeHighlightHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}

export type RichTextCommand = 'bold' | 'italic' | 'underline'

export function applyRichTextCommand(
  editor: HTMLElement,
  command: RichTextCommand,
): void {
  editor.focus()
  document.execCommand(command, false)
}

export function getSelectionHtml(editor: HTMLElement): string {
  return sanitizeHighlightHtml(editor.innerHTML)
}
