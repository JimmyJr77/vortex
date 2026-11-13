import { createRoot } from 'react-dom/client'
import ArchiveConfirmationDialog from '../components/ArchiveConfirmationDialog'

let confirmationOpen = false

/** Every user-initiated archive must await this before changing data. */
export function confirmArchive(itemName: string, warning?: string): Promise<boolean> {
  return confirmRecordAction(itemName, 'archive', warning)
}

export function confirmPermanentDelete(itemName: string): Promise<boolean> {
  return confirmRecordAction(itemName, 'delete', 'This permanently deletes the record and cannot be undone.')
}

function confirmRecordAction(itemName: string, action: 'archive' | 'delete', warning?: string): Promise<boolean> {
  // A second click must not create another confirmation or share the first approval.
  if (confirmationOpen || typeof document === 'undefined') return Promise.resolve(false)
  confirmationOpen = true
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  return new Promise((resolve) => {
    let settled = false
    const complete = (confirmed: boolean) => {
      if (settled) return
      settled = true
      root.unmount()
      container.remove()
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
      confirmationOpen = false
      resolve(confirmed)
    }
    root.render(<ArchiveConfirmationDialog itemName={itemName} warning={warning} action={action} onComplete={complete} />)
  })
}
