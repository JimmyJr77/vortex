import HighlightLetterFrame from './HighlightLetterFrame'
interface HighlightDocumentSlideProps {
  documentMime: string
  documentData: string
}

const HighlightDocumentSlide = ({
  documentMime,
  documentData,
}: HighlightDocumentSlideProps) => {
  const src = documentData.startsWith('data:')
    ? documentData
    : `data:${documentMime};base64,${documentData}`

  if (documentMime === 'application/pdf') {
    return (
      <HighlightLetterFrame>
        <iframe
          title="Highlight document"
          src={src}
          className="w-full h-full border-0 block bg-white"
        />
      </HighlightLetterFrame>
    )
  }

  return (
    <HighlightLetterFrame>
      <img
        src={src}
        alt="Highlight"
        className="w-full h-auto block rounded-sm"
      />
    </HighlightLetterFrame>
  )
}

export default HighlightDocumentSlide
