export type YoutubeLinkSegment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string }

export type YoutubeUrlKind = 'embeddable' | 'search' | 'other'

export function extractYoutubeVideoId(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    const host = parsed.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0]
      return id || null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v')
      }
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/?]+)/)
      if (shortsMatch) return shortsMatch[1]
      const embedMatch = parsed.pathname.match(/^\/embed\/([^/?]+)/)
      if (embedMatch) return embedMatch[1]
    }
  } catch {
    return null
  }

  return null
}

export function classifyYoutubeUrl(url: string): YoutubeUrlKind {
  const trimmed = url.trim()
  if (!trimmed) return 'other'
  if (/youtube\.com\/results\?/i.test(trimmed) || /youtube\.com\/results$/i.test(trimmed)) {
    return 'search'
  }
  if (extractYoutubeVideoId(trimmed)) return 'embeddable'
  if (/youtube\.com|youtu\.be/i.test(trimmed)) return 'other'
  return 'other'
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`
}

const YOUTUBE_URL_PATTERN =
  /https?:\/\/(?:www\.)?(?:youtube\.com\/[^\s<>"')\]]+|youtu\.be\/[^\s<>"')\]]+)/gi

const TRAILING_URL_PUNCTUATION = /[),.!?;:]+$/

function trimTrailingUrlPunctuation(url: string): { href: string; trailing: string } {
  const trailing = url.match(TRAILING_URL_PUNCTUATION)?.[0] ?? ''
  return {
    href: trailing ? url.slice(0, -trailing.length) : url,
    trailing,
  }
}

export function splitTextForYoutubeLinks(text: string): YoutubeLinkSegment[] {
  if (!text) return [{ kind: 'text', text: '' }]

  const segments: YoutubeLinkSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = YOUTUBE_URL_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', text: text.slice(lastIndex, match.index) })
    }

    const raw = match[0]
    const { href, trailing } = trimTrailingUrlPunctuation(raw)
    segments.push({ kind: 'link', text: href, href })
    if (trailing) {
      segments.push({ kind: 'text', text: trailing })
    }
    lastIndex = match.index + raw.length
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ kind: 'text', text }]
}
