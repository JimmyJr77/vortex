import { confirmArchive } from '../../utils/confirmArchive'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Archive, ArchiveRestore, CircleHelp, ListChecks, Lock, MoreHorizontal, Paperclip, Pencil, Star, UserPlus, Vote, type LucideIcon } from 'lucide-react'
import { PortalOverlayTarget } from '../portal/portalOverlayTarget'
import RecipientPicker from './RecipientPicker'
import type { EnrollmentGroup, RecipientOption } from './types'
import { mergeRecipientOptions } from './types'
import MessageThreadPinControls from './MessageThreadPinControls'
import type { PinFilterMode } from './types'
import { MESSAGE_ATTACHMENT_ACCEPT } from './messageAttachmentUpload'
import ThreadCollaborationIcons from './ThreadCollaborationIcons'

interface ThreadHeaderMenuProps {
  subject: string | null
  subjectLocked?: boolean
  canLock?: boolean
  canEdit?: boolean
  onUpdateSubject: (update: { subject: string | null; subject_locked?: boolean }) => Promise<void>
  recipientOptions?: RecipientOption[]
  existingParticipantKeys?: string[]
  recipientsLoading?: boolean
  onAddRecipients?: (recipients: RecipientOption[]) => Promise<void>
  enrollmentGroups?: EnrollmentGroup[]
  resolveEnrollmentGroup?: (group: EnrollmentGroup) => Promise<RecipientOption[]>
  groupsLoading?: boolean
  canHideFromInbox?: boolean
  onHideFromInbox?: () => Promise<void>
  isGloballyArchived?: boolean
  onRestoreThread?: () => Promise<void>
  isFavorite?: boolean
  onToggleFavorite?: (favorite: boolean) => Promise<void>
  favoriteLoading?: boolean
  onAttachmentPick?: (file: File) => void
  canAttach?: boolean
  onOpenFaq?: () => void
  pinFilter?: PinFilterMode
  onPinFilterChange?: (mode: 'mine' | 'super') => void
  importantFilterActive?: boolean
  onImportantFilterChange?: () => void
  pinControlsDisabled?: boolean
  hasActionablePoll?: boolean
  hasActionableSignup?: boolean
  onPollIconClick?: () => void
  onSignupIconClick?: () => void
  onCreatePoll?: () => void
  onRespondPoll?: () => void
  onCreateSignup?: () => void
  onSignupNow?: () => void
}

const iconButtonClass = 'grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vortex-red disabled:opacity-50'
const secondaryButtonClass = 'rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50'
const primaryButtonClass = 'rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50'

type MenuAction = {
  label: string
  icon: LucideIcon
  run: () => void
}

export default function ThreadHeaderMenu({
  subject,
  subjectLocked = false,
  canLock = false,
  canEdit = true,
  onUpdateSubject,
  recipientOptions = [],
  existingParticipantKeys = [],
  recipientsLoading = false,
  onAddRecipients,
  enrollmentGroups = [],
  resolveEnrollmentGroup,
  groupsLoading = false,
  canHideFromInbox = false,
  onHideFromInbox,
  isGloballyArchived = false,
  onRestoreThread,
  isFavorite = false,
  onToggleFavorite,
  favoriteLoading = false,
  onAttachmentPick,
  canAttach = false,
  onOpenFaq,
  pinFilter = 'off',
  onPinFilterChange,
  importantFilterActive = false,
  onImportantFilterChange,
  pinControlsDisabled = false,
  hasActionablePoll = false,
  hasActionableSignup = false,
  onPollIconClick,
  onSignupIconClick,
  onCreatePoll,
  onRespondPoll,
  onCreateSignup,
  onSignupNow,
}: ThreadHeaderMenuProps) {
  const menuId = useId()
  const dialogTitleId = useId()
  const inputId = useId()
  const [dialogMode, setDialogMode] = useState<'subject' | 'recipients' | null>(null)
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null)
  const [draft, setDraft] = useState('')
  const [pickedRecipients, setPickedRecipients] = useState<RecipientOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

  const canPickAttachment = Boolean(onAttachmentPick) && canAttach && !isGloballyArchived
  const existingKeys = useMemo(() => new Set(existingParticipantKeys), [existingParticipantKeys])
  const availableOptions = useMemo(
    () => recipientOptions.filter((option) => !existingKeys.has(option.key)),
    [recipientOptions, existingKeys],
  )

  useEffect(() => {
    if (dialogMode && dialog && !dialog.open) {
      dialog.showModal()
      dialog.querySelector<HTMLInputElement>('input:not([type="hidden"])')?.focus()
    }
  }, [dialog, dialogMode])

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest' })
  }, [error])

  function closeMenu() {
    const menu = menuRef.current
    if (menu?.matches(':popover-open')) menu.hidePopover()
    triggerRef.current?.focus({ preventScroll: true })
  }

  function openDialog(mode: 'subject' | 'recipients') {
    closeMenu()
    setError(null)
    setDraft(subject ?? '')
    setPickedRecipients([])
    setDialogMode(mode)
  }

  function closeDialog() {
    dialog?.close()
    setDialogMode(null)
    setError(null)
    triggerRef.current?.focus({ preventScroll: true })
  }

  async function saveAction(action: () => Promise<void>, fallback: string, onSuccess: () => void) {
    setSaving(true)
    setError(null)
    try {
      await action()
      onSuccess()
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : fallback)
      const menu = menuRef.current
      if (!dialogMode && menu?.isConnected && !menu.matches(':popover-open')) {
        menu.showPopover()
      }
    } finally {
      setSaving(false)
    }
  }

  function runPanelAction(action: () => void) {
    closeMenu()
    setError(null)
    action()
  }

  async function archiveFromInbox(archive: () => Promise<void>) {
    closeMenu()
    setError(null)
    const confirmed = await confirmArchive(
      subject || 'This conversation',
      'Archiving removes this conversation from your inbox. Other participants will keep access.',
    )
    if (!confirmed || !triggerRef.current) return
    await saveAction(archive, 'Could not archive this conversation.', closeMenu)
  }

  const collaborationActions: MenuAction[] = []
  if (onOpenFaq) collaborationActions.push({ label: 'View FAQ', icon: CircleHelp, run: () => runPanelAction(onOpenFaq) })
  if (onCreatePoll) collaborationActions.push({ label: 'Create a poll', icon: Vote, run: () => runPanelAction(onCreatePoll) })
  if (onRespondPoll) collaborationActions.push({ label: 'Respond to a poll', icon: Vote, run: () => runPanelAction(onRespondPoll) })
  if (onCreateSignup) collaborationActions.push({ label: 'Create a sign-up list', icon: ListChecks, run: () => runPanelAction(onCreateSignup) })
  if (onSignupNow) collaborationActions.push({ label: 'Respond to a sign-up', icon: ListChecks, run: () => runPanelAction(onSignupNow) })

  const conversationActions: MenuAction[] = []
  if (canEdit && !subjectLocked) conversationActions.push({ label: 'Rename conversation', icon: Pencil, run: () => openDialog('subject') })
  if (onAddRecipients) conversationActions.push({ label: 'Add people', icon: UserPlus, run: () => openDialog('recipients') })
  if (canPickAttachment) conversationActions.push({
    label: 'Attach a file',
    icon: Paperclip,
    run: () => runPanelAction(() => attachmentInputRef.current?.click()),
  })
  if (canLock) conversationActions.push({
    label: subjectLocked ? 'Unlock conversation name' : 'Lock conversation name',
    icon: Lock,
    run: () => void saveAction(
      () => onUpdateSubject({ subject, subject_locked: !subjectLocked }),
      'Could not change the conversation name lock.',
      closeMenu,
    ),
  })

  const archiveActions: MenuAction[] = []
  if (canHideFromInbox && onHideFromInbox && !isGloballyArchived) archiveActions.push({
    label: 'Archive from my inbox',
    icon: Archive,
    run: () => void archiveFromInbox(onHideFromInbox),
  })
  if (isGloballyArchived && onRestoreThread) archiveActions.push({
    label: 'Restore conversation',
    icon: ArchiveRestore,
    run: () => void saveAction(onRestoreThread, 'Could not restore this conversation.', closeMenu),
  })

  const actionGroups = [collaborationActions, conversationActions, archiveActions].filter((group) => group.length > 0)
  const showLockedHint = canEdit && subjectLocked && !canLock
  const hasMenu = actionGroups.length > 0 || showLockedHint

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {canPickAttachment && (
        <input
          ref={attachmentInputRef}
          type="file"
          className="hidden"
          accept={MESSAGE_ATTACHMENT_ACCEPT}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onAttachmentPick?.(file)
            event.target.value = ''
          }}
        />
      )}
      <ThreadCollaborationIcons
        hasActionablePoll={hasActionablePoll}
        hasActionableSignup={hasActionableSignup}
        onPollIconClick={onPollIconClick}
        onSignupIconClick={onSignupIconClick}
      />
      {(onPinFilterChange || onImportantFilterChange) && (
        <MessageThreadPinControls
          pinFilter={pinFilter}
          onPinFilterChange={onPinFilterChange ?? (() => {})}
          importantFilterActive={importantFilterActive}
          onImportantFilterChange={onImportantFilterChange}
          disabled={pinControlsDisabled}
        />
      )}
      {onToggleFavorite && (
        <button
          type="button"
          aria-label="Favorite conversation"
          aria-pressed={isFavorite}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          disabled={favoriteLoading}
          onClick={() => void onToggleFavorite(!isFavorite)}
          className={`${iconButtonClass} ${isFavorite ? 'text-amber-600' : ''}`}
        >
          <Star size={18} className={isFavorite ? 'fill-amber-400' : ''} aria-hidden="true" />
        </button>
      )}
      {hasMenu && (
        <>
          <button
            ref={triggerRef}
            type="button"
            aria-label="Thread options"
            title="Thread options"
            popoverTarget={menuId}
            className={iconButtonClass}
          >
            <MoreHorizontal size={20} aria-hidden="true" />
          </button>
          <div
            ref={menuRef}
            id={menuId}
            popover="auto"
            role="group"
            aria-label="Thread options"
            onBeforeToggle={(event) => {
              if (event.newState !== 'open' || !triggerRef.current) return
              const bounds = triggerRef.current.getBoundingClientRect()
              const gap = 8
              const popover = event.currentTarget
              popover.style.right = `${Math.max(gap, window.innerWidth - bounds.right)}px`
              const below = window.innerHeight - bounds.bottom - gap * 2
              const above = bounds.top - gap * 2
              const openAbove = below < 180 && above > below
              popover.style.top = openAbove ? 'auto' : `${bounds.bottom + gap}px`
              popover.style.bottom = openAbove ? `${window.innerHeight - bounds.top + gap}px` : 'auto'
              popover.style.maxHeight = `${Math.max(0, openAbove ? above : below)}px`
            }}
            className="fixed inset-auto m-0 w-60 max-w-[calc(100vw-1rem)] overflow-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1 text-slate-900 shadow-lg shadow-slate-900/10"
          >
            {showLockedHint && <p className="px-2.5 py-2 text-xs text-slate-600">The conversation name is locked.</p>}
            {!dialogMode && error && (
              <p ref={errorRef} role="alert" className="mb-1 rounded-lg bg-red-50 px-2.5 py-2 text-sm text-red-800">{error}</p>
            )}
            {actionGroups.map((group, index) => (
              <div key={group[0].label} className={index > 0 ? 'mt-1 border-t border-slate-100 pt-1' : undefined}>
                {group.map(({ label, icon: Icon, run }) => (
                  <button
                    key={label}
                    type="button"
                    disabled={saving}
                    onClick={run}
                    className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-vortex-red disabled:opacity-50"
                  >
                    <Icon size={16} className="shrink-0" aria-hidden="true" /> {label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      <dialog
        ref={setDialog}
        aria-labelledby={dialogTitleId}
        onCancel={(event) => {
          event.preventDefault()
          if (!saving) closeDialog()
        }}
        className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/40"
      >
        {dialogMode && (
          <form onSubmit={(event) => {
            event.preventDefault()
            if (saving) return
            if (dialogMode === 'subject') {
              void saveAction(
                () => onUpdateSubject({ subject: draft.trim() || null }),
                'Could not rename this conversation.',
                closeDialog,
              )
            } else if (onAddRecipients && pickedRecipients.length > 0) {
              void saveAction(() => onAddRecipients(pickedRecipients), 'Could not add people to this conversation.', closeDialog)
            }
          }}>
            <h2 id={dialogTitleId} className="border-b border-slate-200 px-5 py-4 text-lg font-semibold">
              {dialogMode === 'subject' ? 'Rename conversation' : 'Add people'}
            </h2>
            <div className="space-y-3 px-5 py-4">
              {dialogMode === 'subject' ? (
                <div className="space-y-1.5">
                  <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">Conversation name</label>
                  <input
                    id={inputId}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              ) : (
                <PortalOverlayTarget.Provider value={dialog}>
                  <RecipientPicker
                    options={availableOptions}
                    selected={pickedRecipients}
                    onChange={setPickedRecipients}
                    loading={recipientsLoading}
                    placeholder="Search people to add…"
                    enrollmentGroups={enrollmentGroups}
                    onAddEnrollmentGroup={resolveEnrollmentGroup ? async (group) => {
                      const added = await resolveEnrollmentGroup(group)
                      const newPeople = added.filter((person) => !existingKeys.has(person.key))
                      setPickedRecipients((previous) => mergeRecipientOptions(previous, newPeople))
                    } : undefined}
                    groupsLoading={groupsLoading}
                  />
                </PortalOverlayTarget.Provider>
              )}
              {error && <p ref={errorRef} role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button type="button" onClick={closeDialog} disabled={saving} className={secondaryButtonClass}>Cancel</button>
              <button type="submit" disabled={saving || (dialogMode === 'recipients' && pickedRecipients.length === 0)} className={primaryButtonClass}>
                {saving ? 'Saving…' : dialogMode === 'subject' ? 'Save name' : 'Add people'}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  )
}
