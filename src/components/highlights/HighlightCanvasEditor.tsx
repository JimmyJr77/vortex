import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Rnd } from 'react-rnd'
import {
  Trash2,
  Type,
  ImagePlus,
  Square,
  Circle,
  Minus,
  ArrowUp,
  ArrowDown,
  BringToFront,
  SendToBack,
} from 'lucide-react'
import type {
  HighlightCanvas,
  HighlightElement,
  HighlightImageElement,
  HighlightShapeElement,
  HighlightTextElement,
} from '../../types/highlights'
import { DEFAULT_HIGHLIGHT_CANVAS } from '../../types/highlights'
import { plainTextToHtml, sanitizeHighlightHtml } from '../../utils/highlightRichText'
import {
  applyHighlightLayerAction,
  getHighlightLayerInfo,
  type HighlightLayerAction,
} from '../../utils/highlightLayerOrder'
import { getLineOrientation, toggleLineOrientation } from '../../utils/highlightLineShape'
import { ensureCanvasPortalWidth } from '../../utils/highlightCanvas'
import { HIGHLIGHT_LETTER_WIDTH_PX } from '../../utils/highlightLayout'
import HighlightCanvasRenderer from './HighlightCanvasRenderer'
import HighlightCanvasViewport from './HighlightCanvasViewport'
import HighlightElementDragHandle from './HighlightElementDragHandle'
import HighlightShapeContent from './HighlightShapeContent'
import HighlightTextProperties from './HighlightTextProperties'

const newId = () => `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

interface HighlightCanvasEditorProps {
  value: HighlightCanvas
  onChange: (canvas: HighlightCanvas) => void
}

const HighlightCanvasEditor = ({ value, onChange }: HighlightCanvasEditorProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const synced = ensureCanvasPortalWidth(value)
    if (synced.width === value.width) return
    onChange(synced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.width])

  const selected = value.elements.find((e) => e.id === selectedId)
  const layerInfo = selectedId
    ? getHighlightLayerInfo(value.elements, selectedId)
    : null

  const reorderLayer = useCallback(
    (action: HighlightLayerAction) => {
      if (!selectedId) return
      onChange({
        ...value,
        elements: applyHighlightLayerAction(value.elements, selectedId, action),
      })
    },
    [value, onChange, selectedId],
  )

  const updateCanvas = useCallback(
    (patch: Partial<HighlightCanvas>) => {
      onChange({ ...value, ...patch })
    },
    [value, onChange],
  )

  const updateElement = useCallback(
    (id: string, patch: Partial<HighlightElement>) => {
      onChange({
        ...value,
        elements: value.elements.map((el) =>
          el.id === id ? ({ ...el, ...patch } as HighlightElement) : el,
        ),
      })
    },
    [value, onChange],
  )

  const removeElement = (id: string) => {
    onChange({ ...value, elements: value.elements.filter((e) => e.id !== id) })
    if (selectedId === id) setSelectedId(null)
  }

  const addText = () => {
    const el: HighlightTextElement = {
      id: newId(),
      type: 'text',
      x: 40,
      y: 40,
      w: 220,
      h: 100,
      zIndex: value.elements.length + 1,
      text: 'New text block',
      fontSize: 18,
      color: '#111827',
      backgroundColor: '#f9fafb',
      borderColor: '#dc2626',
      borderWidth: 2,
    }
    onChange({ ...value, elements: [...value.elements, el] })
    setSelectedId(el.id)
  }

  const addShape = (shape: 'rect' | 'circle' | 'line') => {
    const el: HighlightShapeElement = {
      id: newId(),
      type: 'shape',
      shape,
      x: 120,
      y: 120,
      w: shape === 'line' ? 160 : 100,
      h: shape === 'line' ? 4 : 100,
      zIndex: value.elements.length + 1,
      fill: shape === 'line' ? 'transparent' : '#fecaca',
      stroke: '#dc2626',
      strokeWidth: shape === 'line' ? 4 : 2,
      ...(shape === 'line' ? { lineOrientation: 'horizontal' as const } : {}),
    }
    onChange({ ...value, elements: [...value.elements, el] })
    setSelectedId(el.id)
  }

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return
    if (file.size > MAX_IMAGE_BYTES) {
      alert('Image must be under 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result as string
      const el: HighlightImageElement = {
        id: newId(),
        type: 'image',
        x: 60,
        y: 60,
        w: 200,
        h: 150,
        zIndex: value.elements.length + 1,
        src,
      }
      onChange({ ...value, elements: [...value.elements, el] })
      setSelectedId(el.id)
    }
    reader.readAsDataURL(file)
  }

  const renderRndChild = (el: HighlightElement) => {
    if (el.type === 'text') {
      const html = sanitizeHighlightHtml(plainTextToHtml(el.text))
      return (
        <div className="w-full h-full relative overflow-hidden">
          <HighlightElementDragHandle label="Text block" />
          <div
            className="absolute inset-0 p-2 overflow-auto text-sm pointer-events-none highlight-text-preview box-border"
            style={{
              color: el.color,
              backgroundColor: el.backgroundColor,
              border: `${el.borderWidth}px solid ${el.borderColor}`,
              fontSize: el.fontSize,
              wordBreak: 'break-word',
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )
    }
    if (el.type === 'image') {
      return (
        <div className="w-full h-full relative overflow-hidden">
          <HighlightElementDragHandle label="Image" />
          <img
            src={el.src}
            alt=""
            className="absolute inset-0 w-full h-full object-contain pointer-events-none box-border"
          />
        </div>
      )
    }
    return (
      <div className="w-full h-full relative overflow-hidden">
        <HighlightElementDragHandle label={el.shape} />
        <div className="absolute inset-0">
          <HighlightShapeContent element={el} />
        </div>
      </div>
    )
  }

  const propertiesPanel = selected ? (
    <div className="space-y-3 border border-gray-200 rounded-xl p-4 bg-white/95 backdrop-blur-md shadow-[0_-8px_30px_rgba(0,0,0,0.15)] max-h-[min(42vh,400px)] overflow-y-auto">
      <h4 className="font-semibold text-sm text-gray-800">Properties</h4>
      {layerInfo && (
        <div>
          <span className="block text-xs font-medium text-gray-600 mb-1">
            Layer order ({layerInfo.index} of {layerInfo.total})
          </span>
          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              title="Send to back"
              disabled={layerInfo.index <= 1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => reorderLayer('back')}
              className="p-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SendToBack className="w-4 h-4 mx-auto" />
            </button>
            <button
              type="button"
              title="Send backward one layer"
              disabled={layerInfo.index <= 1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => reorderLayer('backward')}
              className="p-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowDown className="w-4 h-4 mx-auto" />
            </button>
            <button
              type="button"
              title="Bring forward one layer"
              disabled={layerInfo.index >= layerInfo.total}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => reorderLayer('forward')}
              className="p-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowUp className="w-4 h-4 mx-auto" />
            </button>
            <button
              type="button"
              title="Bring to front"
              disabled={layerInfo.index >= layerInfo.total}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => reorderLayer('front')}
              className="p-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <BringToFront className="w-4 h-4 mx-auto" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            To back · one step · one step · to front
          </p>
        </div>
      )}
      {selected.type === 'text' && (
        <HighlightTextProperties
          element={selected}
          onChange={(patch) => updateElement(selected.id, patch)}
        />
      )}
      {selected.type === 'shape' && selected.shape === 'line' && (
        <div className="space-y-3">
          <div>
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Line direction
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  getLineOrientation(selected) !== 'horizontal' &&
                  updateElement(selected.id, toggleLineOrientation(selected))
                }
                className={`px-3 py-2 text-sm rounded-lg border ${
                  getLineOrientation(selected) === 'horizontal'
                    ? 'bg-vortex-red text-white border-vortex-red'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                Horizontal
              </button>
              <button
                type="button"
                onClick={() =>
                  getLineOrientation(selected) !== 'vertical' &&
                  updateElement(selected.id, toggleLineOrientation(selected))
                }
                className={`px-3 py-2 text-sm rounded-lg border ${
                  getLineOrientation(selected) === 'vertical'
                    ? 'bg-vortex-red text-white border-vortex-red'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                Vertical
              </button>
            </div>
          </div>
          <label className="text-xs block">
            Color
            <input
              type="color"
              value={selected.stroke}
              onChange={(e) => updateElement(selected.id, { stroke: e.target.value })}
              className="block w-full h-8 mt-1"
            />
          </label>
          <label className="text-xs block">
            Thickness
            <input
              type="number"
              min={1}
              max={20}
              className="mt-1 w-full border rounded p-1"
              value={selected.strokeWidth}
              onChange={(e) =>
                updateElement(selected.id, { strokeWidth: Number(e.target.value) })
              }
            />
          </label>
        </div>
      )}
      {selected.type === 'shape' && selected.shape !== 'line' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            Fill
            <input
              type="color"
              value={selected.fill === 'transparent' ? '#ffffff' : selected.fill}
              onChange={(e) => updateElement(selected.id, { fill: e.target.value })}
              className="block w-full h-8 mt-1"
            />
          </label>
          <label className="text-xs">
            Stroke
            <input
              type="color"
              value={selected.stroke}
              onChange={(e) => updateElement(selected.id, { stroke: e.target.value })}
              className="block w-full h-8 mt-1"
            />
          </label>
          <label className="text-xs col-span-2">
            Stroke width
            <input
              type="number"
              min={1}
              max={20}
              className="mt-1 w-full border rounded p-1"
              value={selected.strokeWidth}
              onChange={(e) =>
                updateElement(selected.id, { strokeWidth: Number(e.target.value) })
              }
            />
          </label>
        </div>
      )}
      {selected.type === 'image' && (
        <p className="text-sm text-gray-500">Drag corners to resize. Re-upload via toolbar.</p>
      )}
    </div>
  ) : null

  return (
    <>
    <div className="space-y-4 pb-48">
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={addText}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          <Type className="w-4 h-4" /> Text
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          <ImagePlus className="w-4 h-4" /> Image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleImageUpload(f)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => addShape('rect')}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          <Square className="w-4 h-4" /> Rect
        </button>
        <button
          type="button"
          onClick={() => addShape('circle')}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          <Circle className="w-4 h-4" /> Circle
        </button>
        <button
          type="button"
          onClick={() => addShape('line')}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          <Minus className="w-4 h-4" /> Line
        </button>
        {selectedId && (
          <button
            type="button"
            onClick={() => removeElement(selectedId)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-700 bg-red-50 rounded-lg hover:bg-red-100 ml-auto"
          >
            <Trash2 className="w-4 h-4" /> Delete selected
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <label className="text-sm text-gray-600">
          Canvas background
          <input
            type="color"
            value={value.backgroundColor}
            onChange={(e) => updateCanvas({ backgroundColor: e.target.value })}
            className="ml-2 h-8 w-12 cursor-pointer rounded border"
          />
        </label>
        <button
          type="button"
          onClick={() =>
            onChange(ensureCanvasPortalWidth({ ...DEFAULT_HIGHLIGHT_CANVAS }))
          }
          className="text-sm text-gray-500 underline"
        >
          Reset canvas
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Canvas is {HIGHLIGHT_LETTER_WIDTH_PX}px wide × {value.height}px tall (shown scaled inside
        the standard highlight modal).
      </p>

      <div className="border border-gray-300 rounded-lg bg-gray-100 p-4 min-w-0">
        <HighlightCanvasViewport
          canvasWidth={value.width}
          canvasHeight={value.height}
          backgroundColor={value.backgroundColor}
        >
          <div
            className="relative shadow-sm"
            style={{
              width: value.width,
              height: value.height,
              boxShadow: 'inset 0 0 0 1px #e5e7eb',
            }}
            onClick={() => setSelectedId(null)}
          >
            {[...value.elements]
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((el) => (
                <Rnd
                  key={el.id}
                  size={{ width: el.w, height: el.h }}
                  position={{ x: el.x, y: el.y }}
                  bounds="parent"
                  dragHandleClassName="highlight-drag-handle"
                  cancel=".highlight-text-edit"
                  enableUserSelectHack={false}
                  onDragStop={(_e, d) => updateElement(el.id, { x: d.x, y: d.y })}
                  onResizeStop={(_e, _dir, ref, _delta, pos) => {
                    updateElement(el.id, {
                      w: parseInt(ref.style.width, 10),
                      h: parseInt(ref.style.height, 10),
                      x: pos.x,
                      y: pos.y,
                    })
                  }}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    setSelectedId(el.id)
                  }}
                  style={{
                    zIndex: el.zIndex,
                    outline:
                      selectedId === el.id ? '2px solid #dc2626' : undefined,
                  }}
                >
                  {renderRndChild(el)}
                </Rnd>
              ))}
          </div>
        </HighlightCanvasViewport>
      </div>

      <div className="pt-2">
        <p className="text-xs text-gray-500 mb-2">Modal preview</p>
        <HighlightCanvasRenderer canvas={value} />
      </div>
    </div>

    {propertiesPanel &&
      createPortal(
        <div className="fixed bottom-20 left-0 right-0 z-[210] flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-4xl">{propertiesPanel}</div>
        </div>,
        document.body,
      )}
    </>
  )
}

export default HighlightCanvasEditor
