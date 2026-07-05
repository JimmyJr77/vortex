import { archiveEligibleMessageThreads } from './messageThreads.js'

const AUTO_ARCHIVE_INTERVAL_MS = 24 * 60 * 60 * 1000

export function startMessageThreadAutoArchiveScheduler(pool) {
  const run = () => {
    void archiveEligibleMessageThreads(pool)
      .then((result) => {
        if (result.archived > 0) {
          console.log(`[messageAutoArchive] archived ${result.archived} thread(s)`)
        }
      })
      .catch((err) => {
        console.warn('[messageAutoArchive] job failed:', err?.message || err)
      })
  }

  setTimeout(run, 2 * 60 * 1000)
  const timer = setInterval(run, AUTO_ARCHIVE_INTERVAL_MS)
  if (typeof timer.unref === 'function') timer.unref()
}
