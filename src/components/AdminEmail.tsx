import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Mail, RefreshCw, XCircle } from 'lucide-react'
import { adminApiRequest } from '../utils/api'

/** Current transactional email template — update when composeEmailHtml changes. */
export const EXPECTED_EMAIL_LAYOUT_VERSION = 'v2-black-header-white-body'

interface EmailStatus {
  configured: boolean
  smtpHost: string
  smtpPort: number
  smtpUser: string | null
  smtpUserLooksValid: boolean
  smtpPassLength: number
  smtpPassLooksLikeAppPassword: boolean
  smtpFrom: string | null
  smtpFromLooksValid: boolean
  smtpFromHasDisplayName: boolean
  smtpVerified: boolean
  smtpError: string | null
  buildId?: string | null
  emailLayoutVersion?: string | null
}

export default function AdminEmail() {
  const [status, setStatus] = useState<EmailStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [testTo, setTestTo] = useState('')
  const [sending, setSending] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApiRequest('/api/admin/email/status')
      if (!res.ok) throw new Error(`Backend returned ${res.status}`)
      const json = await res.json()
      setStatus(json.data as EmailStatus)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load email status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sendTest = async () => {
    setSending(true)
    setTestResult(null)
    try {
      const res = await adminApiRequest('/api/admin/email/test', {
        method: 'POST',
        body: JSON.stringify({ to: testTo.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.status === 404 && json?.message === 'Route not found') {
        setTestResult({
          ok: false,
          message:
            'Email test API is not on the backend yet. Redeploy the Render service (backend folder, latest main) and confirm GET /api/health returns apiFeatures.adminEmailTest: true.',
        })
        return
      }
      setTestResult({
        ok: res.ok && json.success === true,
        message: [
          json.message || (res.ok ? 'Test email sent' : `Request failed (${res.status})`),
          json.emailLayoutVersion ? `Backend template: ${json.emailLayoutVersion}` : null,
          json.buildId ? `Backend build: ${json.buildId}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      })
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Failed to send test email' })
    } finally {
      setSending(false)
    }
  }

  const StatusRow = ({ label, value, good }: { label: string; value: string; good?: boolean }) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-medium ${good === undefined ? 'text-gray-900' : good ? 'text-green-600' : 'text-red-600'}`}>
        {value}
      </span>
    </div>
  )

  const layoutIsCurrent =
    status?.emailLayoutVersion === EXPECTED_EMAIL_LAYOUT_VERSION

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-gray-700" />
          <h2 className="text-xl font-semibold text-gray-900">Email</h2>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Transactional email (enrollment confirmations, waiver requests, parent invites, email
        verification) is sent over SMTP. Configure <code>SMTP_USER</code>, <code>SMTP_PASS</code>,
        and <code>SMTP_FROM</code> in the backend environment.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading status…
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      ) : status ? (
        <>
          {!layoutIsCurrent && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Backend email template is out of date</p>
              <p className="mt-1">
                The API serving test emails is still on build{' '}
                <code className="text-xs">{status.buildId || 'unknown'}</code>
                {status.emailLayoutVersion
                  ? ` (template ${status.emailLayoutVersion})`
                  : ' (no template version — pre-layout backend)'}
                . Expected template{' '}
                <code className="text-xs">{EXPECTED_EMAIL_LAYOUT_VERSION}</code>.
              </p>
              <p className="mt-2">
                Redeploy the <strong>Render</strong> backend service (<code>backend/</code> root on{' '}
                <code>main</code>). Vercel frontend deploys do not update email HTML. After deploy,
                refresh this page — build should be <code>email-layout-v2-2026-06-27</code> or newer.
              </p>
            </div>
          )}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            {status.configured && status.smtpVerified ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-700">Email is configured and verified</span>
              </>
            ) : status.configured ? (
              <>
                <XCircle className="w-5 h-5 text-amber-600" />
                <span className="font-medium text-amber-700">Configured, but SMTP verification failed</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="font-medium text-red-700">Email is not configured</span>
              </>
            )}
          </div>

          <StatusRow label="SMTP host" value={`${status.smtpHost}:${status.smtpPort}`} />
          <StatusRow label="SMTP user" value={status.smtpUser || '(unset)'} good={status.smtpUserLooksValid} />
          <StatusRow
            label="SMTP password"
            value={status.smtpPassLength ? `${status.smtpPassLength} chars` : '(unset)'}
            good={status.smtpPassLength > 0}
          />
          <StatusRow label="From address" value={status.smtpFrom || '(unset)'} good={status.smtpFromLooksValid} />
          <StatusRow label="SMTP verified" value={status.smtpVerified ? 'Yes' : 'No'} good={status.smtpVerified} />

          {status.smtpError && (
            <div className="mt-3 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{status.smtpError}</div>
          )}

          <StatusRow label="Backend build" value={status.buildId || '(unknown)'} good={layoutIsCurrent} />
          <StatusRow
            label="Email template"
            value={status.emailLayoutVersion || '(legacy — redeploy backend)'}
            good={layoutIsCurrent}
          />
        </div>
        </>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="font-medium text-gray-900 mb-3">Send a test email</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            onClick={() => void sendTest()}
            disabled={sending || !testTo.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Send test
          </button>
        </div>
        {testResult && (
          <div
            className={`mt-3 rounded-lg px-4 py-3 text-sm ${
              testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  )
}
