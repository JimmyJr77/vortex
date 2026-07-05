export function parseMessageAttachmentPayload(body) {
  const url = body?.attachment_url ? String(body.attachment_url).trim() : null
  if (!url) return null
  return {
    url,
    name: body?.attachment_name ? String(body.attachment_name).trim() || 'Attachment' : 'Attachment',
    mime: body?.attachment_mime ? String(body.attachment_mime).trim() : null,
  }
}

export function messageHasContent(body, attachment) {
  return Boolean(String(body || '').trim() || attachment?.url)
}

/** DB column `body` is NOT NULL — use '' when the message is attachment-only. */
export function normalizeMessageBodyForInsert(body) {
  return String(body || '').trim()
}
