import { ExternalLink, Search } from 'lucide-react'
import {
  classifyYoutubeUrl,
  extractYoutubeVideoId,
  youtubeEmbedUrl,
} from '../utils/youtubeLinks'
import YoutubeLinkifiedText from './YoutubeLinkifiedText'

interface YoutubeEmbedPlayerProps {
  url: string
  title?: string
}

export default function YoutubeEmbedPlayer({ url, title = 'Demo video' }: YoutubeEmbedPlayerProps) {
  const kind = classifyYoutubeUrl(url)
  const videoId = extractYoutubeVideoId(url)

  if (kind === 'embeddable' && videoId) {
    return (
      <div className="space-y-2">
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-gray-200 bg-black">
          <iframe
            src={youtubeEmbedUrl(videoId)}
            title={title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open on YouTube
        </a>
      </div>
    )
  }

  if (kind === 'search') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 hover:bg-gray-100"
      >
        <Search className="h-5 w-5 shrink-0 text-gray-500" />
        <span>
          <span className="font-medium">Search on YouTube</span>
          <span className="block text-xs text-gray-500 mt-0.5 break-all">{url}</span>
        </span>
      </a>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-vortex-red hover:underline break-all"
    >
      <ExternalLink className="h-4 w-4 shrink-0" />
      <YoutubeLinkifiedText text={url} linkClassName="text-vortex-red hover:underline break-all" />
    </a>
  )
}

interface YoutubeVideoListProps {
  urls: string[]
  title?: string
}

export function YoutubeVideoList({ urls, title = 'Demo video' }: YoutubeVideoListProps) {
  if (urls.length === 0) {
    return <p className="text-sm text-gray-500">No demo video yet.</p>
  }

  const primaryEmbeddable = urls.find((url) => classifyYoutubeUrl(url) === 'embeddable')
  const primary = primaryEmbeddable ?? urls[0]
  const extras = urls.filter((url) => url !== primary)

  return (
    <div className="space-y-4">
      <YoutubeEmbedPlayer url={primary} title={title} />
      {extras.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">More videos</div>
          <ul className="space-y-2">
            {extras.map((url) => (
              <li key={url}>
                <YoutubeEmbedPlayer url={url} title={title} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
