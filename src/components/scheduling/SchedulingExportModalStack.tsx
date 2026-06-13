import { useEffect, useState } from 'react'
import ClassEventModal from '../programs/ClassEventModal'
import type { ClassEventExportPrefill } from '../../utils/schedulingExport'

interface Props {
  open: boolean
  prefills: ClassEventExportPrefill[]
  onClose: () => void
  onComplete: () => void
}

const SchedulingExportModalStack = ({ open, prefills, onClose, onComplete }: Props) => {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (open) setIndex(0)
  }, [open, prefills])

  if (!open || prefills.length === 0) return null

  const current = prefills[index]

  const advance = () => {
    if (index + 1 >= prefills.length) {
      onComplete()
      onClose()
    } else {
      setIndex((i) => i + 1)
    }
  }

  return (
    <>
      {prefills.length > 1 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-black/80 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          Review class/event {index + 1} of {prefills.length}
        </div>
      )}
      <ClassEventModal
        key={index}
        open
        programsId={current.programsId}
        programsDisplayName={current.programsDisplayName}
        lockProgram={current.lockProgram}
        editing={current.editing}
        initialFormData={current.initialFormData}
        initialSchedulingCategoryId={current.schedulingCategoryId}
        submitLabel={current.editing ? 'Update class/event' : 'Add class/event'}
        parentProgramActive
        onClose={advance}
        onSaved={advance}
      />
    </>
  )
}

export default SchedulingExportModalStack
