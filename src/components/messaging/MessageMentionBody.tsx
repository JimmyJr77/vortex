import type { ThreadParticipant } from './types'
import type { MessageViewer } from './messageBubbleStyle'
import YoutubeLinkifiedText from '../YoutubeLinkifiedText'
import { splitMessageBodyForDisplay } from './messageMentions'

interface MessageMentionBodyProps {
  body: string
  participants?: ThreadParticipant[]
  viewer: MessageViewer
  inverted?: boolean
}

export default function MessageMentionBody({
  body,
  participants = [],
  viewer,
  inverted = false,
}: MessageMentionBodyProps) {
  const segments = splitMessageBodyForDisplay(body, participants, viewer)

  return (
    <div className="whitespace-pre-wrap">
      {segments.map((segment, index) => {
        if (segment.kind === 'quote') {
          return (
            <YoutubeLinkifiedText
              key={index}
              text={segment.text}
              className={inverted ? 'text-white/80' : 'text-gray-500'}
              linkClassName={inverted ? 'text-white underline underline-offset-2 break-all hover:text-white/80' : 'text-blue-600 underline underline-offset-2 break-all hover:text-blue-800'}
            />
          )
        }
        if (segment.kind === 'mention') {
          return (
            <span
              key={index}
              className={
                inverted
                  ? 'font-semibold text-white bg-white/20 rounded px-0.5'
                  : segment.isSelfMention
                  ? 'font-semibold text-vortex-red bg-red-50 rounded px-0.5'
                  : 'font-semibold text-blue-700'
              }
            >
              {segment.text}
            </span>
          )
        }
        return <YoutubeLinkifiedText key={index} text={segment.text} />
      })}
    </div>
  )
}
