import type { ThreadParticipant } from './types'
import type { MessageViewer } from './messageBubbleStyle'
import YoutubeLinkifiedText from '../YoutubeLinkifiedText'
import { splitMessageBodyForDisplay } from './messageMentions'

interface MessageMentionBodyProps {
  body: string
  participants?: ThreadParticipant[]
  viewer: MessageViewer
}

export default function MessageMentionBody({
  body,
  participants = [],
  viewer,
}: MessageMentionBodyProps) {
  const segments = splitMessageBodyForDisplay(body, participants, viewer)

  return (
    <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">
      {segments.map((segment, index) => {
        if (segment.kind === 'quote') {
          return (
            <blockquote key={index} className="my-1.5 rounded-r-md border-l-2 border-slate-300 bg-slate-100/70 py-1.5 pl-2.5 pr-2 text-sm text-slate-600">
              <YoutubeLinkifiedText text={segment.text.replace(/^> /gm, '').replace(/\n$/, '')} />
            </blockquote>
          )
        }
        if (segment.kind === 'mention') {
          return (
            <span
              key={index}
              className={
                segment.isSelfMention
                  ? 'rounded bg-red-100 px-0.5 font-semibold text-red-800'
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
