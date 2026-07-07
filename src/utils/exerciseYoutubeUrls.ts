import type { Exercise, ExerciseMedia, ExerciseMediaLibrary } from '../coach/types'
import { splitTextForYoutubeLinks } from './youtubeLinks'

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return []
  return val.map((v) => String(v).trim()).filter(Boolean)
}

export function isYoutubeUrl(text: string): boolean {
  return /youtube\.com|youtu\.be/i.test(text.trim())
}

export function extractYoutubeUrlsFromItem(item: string): string[] {
  const trimmed = item.trim()
  if (!trimmed) return []

  const fromSegments = splitTextForYoutubeLinks(trimmed)
    .filter((segment) => segment.kind === 'link')
    .map((segment) => segment.href)

  if (fromSegments.length > 0) return fromSegments
  if (isYoutubeUrl(trimmed)) return [trimmed]
  return []
}

export function partitionListItems(items: string[]): { youtubeUrls: string[]; remaining: string[] } {
  const youtubeUrls: string[] = []
  const remaining: string[] = []
  const seenYoutube = new Set<string>()

  for (const item of items) {
    const urls = extractYoutubeUrlsFromItem(item)
    if (urls.length > 0) {
      for (const url of urls) {
        if (!seenYoutube.has(url)) {
          seenYoutube.add(url)
          youtubeUrls.push(url)
        }
      }
      const leftover = urls.reduce((text, url) => text.replace(url, '').trim(), item.trim())
      if (leftover && !isYoutubeUrl(leftover)) {
        remaining.push(leftover)
      }
    } else {
      remaining.push(item)
    }
  }

  return { youtubeUrls, remaining }
}

function dedupeUrls(urls: string[]): string[] {
  return [...new Set(urls)]
}

export function collectExerciseYoutubeUrls(exercise: Pick<Exercise, 'media_library' | 'media'>): string[] {
  const mediaLib = exercise.media_library ?? {}
  const lists = [
    ...asStringArray(mediaLib.demo_video_sources),
    ...asStringArray(mediaLib.coaching_articles),
    ...asStringArray(mediaLib.clinical_or_sport_science_references),
    ...asStringArray(mediaLib.internal_notes),
  ]

  const urls: string[] = []
  for (const item of lists) {
    urls.push(...extractYoutubeUrlsFromItem(item))
  }

  for (const item of exercise.media ?? []) {
    const url = item.url?.trim()
    if (url && isYoutubeUrl(url)) urls.push(url)
  }

  return dedupeUrls(urls)
}

export interface PartitionedExerciseMedia {
  youtubeUrls: string[]
  demoVideos: string[]
  coachingArticles: string[]
  references: string[]
  internalNotes: string[]
  nonYoutubeMedia: ExerciseMedia[]
}

export function partitionExerciseMediaLibrary(
  mediaLib: ExerciseMediaLibrary | null | undefined,
  media: ExerciseMedia[] | null | undefined,
): PartitionedExerciseMedia {
  const demo = partitionListItems(asStringArray(mediaLib?.demo_video_sources))
  const articles = partitionListItems(asStringArray(mediaLib?.coaching_articles))
  const refs = partitionListItems(asStringArray(mediaLib?.clinical_or_sport_science_references))
  const notes = partitionListItems(asStringArray(mediaLib?.internal_notes))

  const youtubeUrls = dedupeUrls([
    ...demo.youtubeUrls,
    ...articles.youtubeUrls,
    ...refs.youtubeUrls,
    ...notes.youtubeUrls,
  ])

  const nonYoutubeMedia: ExerciseMedia[] = []
  for (const item of media ?? []) {
    const url = item.url?.trim()
    if (!url) continue
    if (isYoutubeUrl(url)) {
      if (!youtubeUrls.includes(url)) youtubeUrls.push(url)
    } else {
      nonYoutubeMedia.push(item)
    }
  }

  return {
    youtubeUrls,
    demoVideos: demo.remaining,
    coachingArticles: articles.remaining,
    references: refs.remaining,
    internalNotes: notes.remaining,
    nonYoutubeMedia,
  }
}
