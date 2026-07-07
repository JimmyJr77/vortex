import { splitTextForYoutubeLinks } from '../utils/youtubeLinks'

interface YoutubeLinkifiedTextProps {
  text: string
  className?: string
  linkClassName?: string
}

export default function YoutubeLinkifiedText({
  text,
  className,
  linkClassName = 'text-blue-600 underline underline-offset-2 break-all hover:text-blue-800',
}: YoutubeLinkifiedTextProps) {
  const segments = splitTextForYoutubeLinks(text)

  return (
    <span className={className}>
      {segments.map((segment, index) =>
        segment.kind === 'link' ? (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
          >
            {segment.text}
          </a>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </span>
  )
}
