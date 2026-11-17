const formatDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })

export default function GuideByline({ datePublished, dateModified }: {
  datePublished: string
  dateModified: string
}) {
  return (
    <p className="athletic-guide-byline">
      By Vortex Athletics · Published <time dateTime={datePublished}>{formatDate.format(new Date(datePublished))}</time>
      {dateModified !== datePublished && (
        <> · Updated <time dateTime={dateModified}>{formatDate.format(new Date(dateModified))}</time></>
      )}
    </p>
  )
}
