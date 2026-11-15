import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function SignupPasswordInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)
  const label = props['aria-label'] || props.placeholder || 'password'
  return (
    <span className="relative block min-w-0">
      <input {...props} type={visible ? 'text' : 'password'} className={`${className} w-full pr-12`} />
      <button type="button" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase().replace(' *', '')}`} aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-gray-600 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-vortex-red"
        onClick={() => setVisible(current => !current)}>
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </span>
  )
}
