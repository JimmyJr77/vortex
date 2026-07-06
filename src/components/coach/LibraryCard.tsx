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
      className="relative flex h-full w-full cursor-pointer flex-col items-start rounded-xl border border-gray-200 bg-white p-4 text-left transition-shadow hover:border-gray-300 hover:shadow-md sm:p-5"
    >
      <div className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4">{menu}</div>
      <div className="flex w-full min-w-0 flex-1 flex-col items-start justify-start">{children}</div>
    </button>
  )
}
