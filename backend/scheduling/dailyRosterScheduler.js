import { isEmailConfigured } from '../email/sendEmail.js'
import { dateInTimeZone, emailDailyRoster } from './dailyRoster.js'

// Match the existing Render cron: 11:00 UTC (7 AM EDT / 6 AM EST).
// The shared daily delivery key prevents duplicates across workers and cron.
export function dailyRosterIsDue(now = new Date()) {
  return now.getUTCHours() >= 11
}

export function startDailyRosterScheduler(pool, {
  enabled = process.env.DAILY_ROSTER_SCHEDULER_ENABLED === 'true'
    || (process.env.DAILY_ROSTER_SCHEDULER_ENABLED !== 'false'
      && process.env.NODE_ENV === 'production' && process.env.RENDER_SERVICE_NAME === 'vortex-backend'),
  now = () => new Date(),
  configured = isEmailConfigured,
  send = emailDailyRoster,
  logger = console,
  intervalMs = 5 * 60 * 1000,
} = {}) {
  if (!enabled) return null
  let running = false
  let completedDate = null
  const run = async () => {
    const current = now()
    const date = dateInTimeZone(current)
    if (running || completedDate === date || !dailyRosterIsDue(current)) return
    running = true
    try {
      if (!configured()) throw new Error('SMTP is not configured')
      const result = await send(pool, { date })
      if (!result.delivery?.sent && result.delivery?.reason !== 'duplicate') {
        throw new Error(`Daily roster was not sent: ${result.delivery?.reason || 'unknown'}`)
      }
      completedDate = date
      logger.log('[daily-roster] completed:', date, result.delivery.reason || 'sent')
    } catch (error) {
      logger.error('[daily-roster] failed; will retry:', error?.message || error)
    } finally {
      running = false
    }
  }
  const timer = setInterval(() => { void run() }, intervalMs)
  timer.unref?.()
  void run()
  return { run, stop: () => clearInterval(timer) }
}
