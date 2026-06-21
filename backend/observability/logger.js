export function logInfo(message, context = {}) {
  console.log(JSON.stringify({ level: 'info', message, ...context, ts: new Date().toISOString() }))
}

export function logWarn(message, context = {}) {
  console.warn(JSON.stringify({ level: 'warn', message, ...context, ts: new Date().toISOString() }))
}

export function logError(message, context = {}) {
  console.error(JSON.stringify({ level: 'error', message, ...context, ts: new Date().toISOString() }))
}

export async function reportError(message, context = {}) {
  logError(message, context)
  const webhookUrl = process.env.ERROR_ALERT_WEBHOOK_URL
  if (!webhookUrl) return
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[Vortex Backend] ${message}`,
        context,
      }),
    })
  } catch (error) {
    console.error('Error alert webhook failed:', error.message)
  }
}
