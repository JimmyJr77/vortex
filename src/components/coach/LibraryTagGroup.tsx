import type { ReactNode } from 'react'

const TAG_VARIANTS = {
  default: 'bg-gray-100 text-gray-700',
  tenet: 'bg-red-50 text-vortex-red',
  phase: 'bg-blue-50 text-blue-800',
  subrole: 'bg-violet-50 text-violet-800',
  methodology: 'bg-gray-100 text-gray-700',
  physiology: 'bg-indigo-50 text-indigo-800',
  requirement: 'bg-slate-50 text-slate-700',
  flag: 'bg-amber-50 text-amber-800',
  positive: 'bg-green-50 text-green-800',
  warning: 'bg-orange-50 text-orange-800',
  impact: 'bg-purple-50 text-purple-800',
  group: 'bg-sky-50 text-sky-800',
} as const

export type LibraryTagVariant = keyof typeof TAG_VARIANTS

export function LibraryTag({
  children,
  variant = 'default',
}: {
  children: ReactNode
  variant?: LibraryTagVariant
}) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs leading-tight ${TAG_VARIANTS[variant]}`}>
      {children}
    </span>
  )
}

export function LibraryTagGroup({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  if (!children) return null
  return (
    <div className={className}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}
