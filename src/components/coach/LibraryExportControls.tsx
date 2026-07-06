import { useState } from 'react'
import { Download } from 'lucide-react'
import { LIBRARY_EXPORT_OPTIONS, type LibraryExportFormat } from '../../coach/libraryExport'

export default function LibraryExportControls({
  disabled,
  filenameStem,
  onExport,
  options = LIBRARY_EXPORT_OPTIONS,
  defaultFormat,
}: {
  disabled?: boolean
  filenameStem: string
  onExport: (format: LibraryExportFormat | string) => void
  options?: Array<{ value: string; label: string }>
  defaultFormat?: string
}) {
  const [format, setFormat] = useState(defaultFormat ?? options[0]?.value ?? 'full-xlsx')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`${filenameStem}-export-format`}>Export format</label>
      <select
        id={`${filenameStem}-export-format`}
        value={format}
        onChange={(event) => setFormat(event.target.value)}
        disabled={disabled}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white min-w-[15rem]"
      >
        {LIBRARY_EXPORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onExport(format)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        <Download className="w-4 h-4" /> Download
      </button>
    </div>
  )
}
