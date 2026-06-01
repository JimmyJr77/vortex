import { useEffect, useRef } from 'react'
import { Bold, Italic, Underline } from 'lucide-react'
import type { HighlightTextElement } from '../../types/highlights'
import {
  applyRichTextCommand,
  getSelectionHtml,
  plainTextToHtml,
  sanitizeHighlightHtml,
} from '../../utils/highlightRichText'

interface HighlightTextPropertiesProps {
  element: HighlightTextElement
  onChange: (patch: Partial<HighlightTextElement>) => void
}

const HighlightTextProperties = ({ element, onChange }: HighlightTextPropertiesProps) => {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const html = sanitizeHighlightHtml(plainTextToHtml(element.text))
    if (el.innerHTML !== html) {
      el.innerHTML = html
    }
  }, [element.id, element.text])

  const syncHtml = () => {
    const el = editorRef.current
    if (!el) return
    onChange({ text: getSelectionHtml(el) })
  }

  const runFormat = (command: 'bold' | 'italic' | 'underline') => {
    const el = editorRef.current
    if (!el) return
    applyRichTextCommand(el, command)
    syncHtml()
  }

  return (
    <div className="space-y-3">
      <div>
        <span className="block text-xs font-medium text-gray-600 mb-1">
          Text (select words, then format)
        </span>
        <div className="flex gap-1 mb-2">
          <button
            type="button"
            title="Bold"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runFormat('bold')}
            className="p-2 border border-gray-300 rounded hover:bg-gray-100"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Italic"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runFormat('italic')}
            className="p-2 border border-gray-300 rounded hover:bg-gray-100"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Underline"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runFormat('underline')}
            className="p-2 border border-gray-300 rounded hover:bg-gray-100"
          >
            <Underline className="w-4 h-4" />
          </button>
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="highlight-text-edit min-h-[100px] w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-vortex-red/40"
          style={{
            fontSize: element.fontSize,
            color: element.color,
          }}
          onInput={syncHtml}
          onBlur={syncHtml}
        />
      </div>

      <label className="block text-xs text-gray-600">
        Font size
        <input
          type="number"
          min={10}
          max={72}
          className="mt-1 w-full border rounded p-1"
          value={element.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">
          Text color
          <input
            type="color"
            value={element.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="block w-full h-8 mt-1"
          />
        </label>
        <label className="text-xs">
          Background
          <input
            type="color"
            value={element.backgroundColor}
            onChange={(e) => onChange({ backgroundColor: e.target.value })}
            className="block w-full h-8 mt-1"
          />
        </label>
        <label className="text-xs">
          Border
          <input
            type="color"
            value={element.borderColor}
            onChange={(e) => onChange({ borderColor: e.target.value })}
            className="block w-full h-8 mt-1"
          />
        </label>
        <label className="text-xs">
          Border width
          <input
            type="number"
            min={0}
            max={12}
            className="mt-1 w-full border rounded p-1"
            value={element.borderWidth}
            onChange={(e) => onChange({ borderWidth: Number(e.target.value) })}
          />
        </label>
      </div>
    </div>
  )
}

export default HighlightTextProperties
