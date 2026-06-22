import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { getApiUrl } from '../utils/api'

type Status = 'verifying' | 'success' | 'error'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const apiUrl = getApiUrl()

  const [status, setStatus] = useState<Status>('verifying')
  const [message, setMessage] = useState('')

  const verify = useCallback(async () => {
    if (!token) {
      setStatus('error')
      setMessage('Missing verification token.')
      return
    }
    try {
      const res = await fetch(`${apiUrl}/api/verify-email/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success !== true) {
        throw new Error(data.message || 'This verification link is invalid or has expired.')
      }
      setStatus('success')
      setMessage(data.data?.email ? `${data.data.email} is now verified.` : 'Your email is now verified.')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Failed to verify email.')
    }
  }, [apiUrl, token])

  useEffect(() => {
    void verify()
  }, [verify])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full rounded-2xl bg-white border border-gray-200 p-8 text-center space-y-4">
        {status === 'verifying' && (
          <>
            <Loader2 className="w-10 h-10 text-red-600 animate-spin mx-auto" />
            <h1 className="text-2xl font-bold text-gray-900">Verifying your email…</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            <h1 className="text-2xl font-bold text-green-800">Email verified</h1>
            <p className="text-sm text-gray-600">{message}</p>
            <a
              href="/?login=1"
              className="inline-block mt-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
            >
              Go to the Member Portal
            </a>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-600 mx-auto" />
            <h1 className="text-2xl font-bold text-red-800">Verification failed</h1>
            <p className="text-sm text-gray-600">{message}</p>
            <p className="text-xs text-gray-500">
              If your link expired, please contact Vortex Athletics to send a new one.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
