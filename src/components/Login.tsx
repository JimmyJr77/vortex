import brandLogo from '../assets/vortex-athletics-gymnastics-logo.webp'
import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, X, Lock, Mail } from 'lucide-react'
import { getApiUrl } from '../utils/api'
import type { PortalAccount } from '../utils/portalSession'
import './Login.css'

interface LoginProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (token: string, account: PortalAccount) => void
}

export default function Login({ isOpen, onClose, onSuccess }: LoginProps) {
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetAccountType, setResetAccountType] = useState<'member' | 'staff'>('member')
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const accountInputRef = useRef<HTMLInputElement>(null)
  const id = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!isOpen || !dialog) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    if (!dialog.open) dialog.showModal()
    document.body.style.overflow = 'hidden'
    accountInputRef.current?.focus({ preventScroll: true })
    return () => {
      dialog.close()
      setPasswordVisible(false)
      document.body.style.overflow = previousOverflow
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/members/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername, password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        onSuccess(data.token, data.member)
        onClose()
        setEmailOrUsername('')
        setPassword('')
      } else {
        setError(data.message || 'Invalid login or password')
      }
    } catch (error) {
      console.error('Account login error:', error)
      setError('Unable to connect to server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResetSent(false)
    setIsSubmitting(true)
    try {
      const apiUrl = getApiUrl()
      const resetPath = resetAccountType === 'staff'
        ? '/api/admin/request-password-reset'
        : '/api/members/request-password-reset'
      const response = await fetch(`${apiUrl}${resetPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) {
        setError(data.message || 'Unable to process password reset request.')
      } else {
        setResetSent(true)
      }
    } catch (err) {
      console.error('Account password reset error:', err)
      setError('Unable to connect to server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <dialog
      ref={dialogRef}
      className="np-account-login"
      aria-labelledby={id + '-title'}
      aria-describedby={id + '-description'}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
      }}
    >
      <div className="np-account-login-header">
        <div className="np-account-login-brand-row">
          <img className="np-account-login-logo" src={brandLogo} width="1086" height="171" alt="Vortex Athletics & Gymnastics" />
          <button type="button" className="np-account-login-close" onClick={onClose} aria-label="Close account login"><X size={20} aria-hidden="true" /></button>
        </div>
        <h2 id={id + '-title'}>{forgotMode ? 'Reset Account Password' : 'Account Login'}</h2>
        <p id={id + '-description'} className="np-account-login-description">
          {forgotMode
            ? 'Choose your account type, then enter the email you use to sign in.'
            : 'Welcome back. Sign in to access your Vortex account.'}
        </p>
      </div>

      <div className="np-account-login-body">
        {error && <div className="np-account-login-notice np-account-login-error" role="alert">{error}</div>}
        {resetSent && <div className="np-account-login-notice np-account-login-success" role="status">If an account exists for this email, a temporary password has been sent.</div>}

        <form onSubmit={forgotMode ? handleReset : handleSubmit} className="np-account-login-form" aria-busy={isSubmitting}>
          {forgotMode && <fieldset className="np-account-login-account-types">
            <legend>Account type</legend>
            <div className="np-account-login-type-options">
              {([
                ['member', 'Member / family'],
                ['staff', 'Staff / coach'],
              ] as const).map(([value, label]) => <label key={value} className={'np-account-login-type-option' + (resetAccountType === value ? ' is-selected' : '')}>
                <input
                  type="radio"
                  name={id + '-resetAccountType'}
                  value={value}
                  checked={resetAccountType === value}
                  onChange={() => { setResetAccountType(value); setResetSent(false); setError('') }}
                />
                <span>{label}</span>
              </label>)}
            </div>
          </fieldset>}

          <div className="np-account-login-field">
            <label htmlFor={id + '-account'}>{forgotMode ? 'Account Email' : 'Email, username, or phone number'}</label>
            <div className="np-account-login-input-wrap">
              <Mail size={18} aria-hidden="true" />
              <input
                ref={accountInputRef}
                type={forgotMode ? 'email' : 'text'}
                id={id + '-account'}
                name="emailOrUsername"
                value={forgotMode ? resetEmail : emailOrUsername}
                onChange={(e) => (forgotMode ? setResetEmail(e.target.value) : setEmailOrUsername(e.target.value))}
                placeholder={forgotMode ? 'Enter your account email' : 'Email, username, or phone number'}
                autoComplete={forgotMode ? 'email' : 'username'}
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </div>
          </div>

          {!forgotMode && <div className="np-account-login-field">
            <label htmlFor={id + '-password'}>Password</label>
            <div className="np-account-login-input-wrap np-account-login-password-wrap">
              <Lock size={18} aria-hidden="true" />
              <input
                type={passwordVisible ? 'text' : 'password'}
                id={id + '-password'}
                name="password"
                value={password}
                autoComplete="current-password"
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="np-account-login-password-toggle"
                aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                aria-controls={id + '-password'}
                aria-pressed={passwordVisible}
                title={passwordVisible ? 'Hide password' : 'Show password'}
                onClick={() => setPasswordVisible((visible) => !visible)}
              >
                {passwordVisible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
            </div>
          </div>}

          <button type="submit" disabled={isSubmitting} className="np-account-login-submit">
            <span>{isSubmitting ? (forgotMode ? 'Submitting...' : 'Logging in...') : (forgotMode ? 'Send Temporary Password' : 'Login')}</span>
            {!isSubmitting && <ArrowRight size={18} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="np-account-login-switch"
            onClick={() => { setError(''); setResetSent(false); setPasswordVisible(false); setForgotMode((value) => !value) }}
          >
            {forgotMode && <ArrowLeft size={16} aria-hidden="true" />}
            {forgotMode ? 'Back to login' : 'Forgot password?'}
          </button>
        </form>
      </div>
    </dialog>
  )
}
