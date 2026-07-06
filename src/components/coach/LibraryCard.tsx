import type { ReactNode } from 'react'

/** Shared exercise/skill library tile — content top-aligned, actions menu pinned top-right. */
export default function LibraryCard({
  children,
  menu,
  onClick,
}: {
  children: ReactNode
  menu: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full h-full cursor-pointer rounded-xl border border-gray-200 bg-white p-4 text-left transition-shadow hover:border-gray-300 hover:shadow-md"
    >
      <div className="absolute right-3 top-3 z-10">{menu}</div>
      <div className="flex min-w-0 flex-col items-start">{children}</div>
    </button>
  )
}
