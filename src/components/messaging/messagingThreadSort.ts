export type ThreadListSortField = 'title' | 'recent' | 'created'
export type ThreadListSortDir = 'asc' | 'desc'

export function defaultSortDir(field: ThreadListSortField): ThreadListSortDir {
  return field === 'title' ? 'asc' : 'desc'
}

export function toApiThreadSort(field: ThreadListSortField): 'title' | 'created' | 'updated' {
  if (field === 'recent') return 'updated'
  return field
}
