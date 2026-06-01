import { GripVertical } from 'lucide-react'

interface HighlightElementDragHandleProps {
  label: string
}

const HighlightElementDragHandle = ({ label }: HighlightElementDragHandleProps) => (
  <div
    className="highlight-drag-handle absolute top-0 left-0 right-0 z-20 flex items-center gap-1 px-1 py-0.5 bg-gray-200/90 cursor-move text-xs text-gray-600 capitalize"
    title="Drag to move"
  >
    <GripVertical className="w-3 h-3 shrink-0" />
    <span className="truncate">{label}</span>
  </div>
)

export default HighlightElementDragHandle
