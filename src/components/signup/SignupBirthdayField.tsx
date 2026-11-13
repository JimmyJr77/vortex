import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { getTodayDateString } from '../../utils/dateUtils'

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

interface SignupBirthdayFieldProps {
  id: string
  value: string
  onChange: (value: string) => void
}

interface CalendarMonth {
  year: number
  month: number
}

function displayBirthday(value: string) {
  const [year, month, day] = value.split('-')
  return day ? `${month}/${day}/${year}` : ''
}

function isoBirthday(text: string, today: string) {
  const trimmed = text.trim()
  const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) ?? trimmed.match(/^(\d{2})(\d{2})(\d{4})$/)
  const iso = us ? `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}` : trimmed
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso.startsWith('0000-') || iso > today) return ''
  const parsed = new Date(`${iso}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : ''
}

export default function SignupBirthdayField({ id, value, onChange }: SignupBirthdayFieldProps) {
  const [draft, setDraft] = useState<{ value: string; text: string }>()
  const [blurred, setBlurred] = useState(false)
  const [calendar, setCalendar] = useState<CalendarMonth | null>(null)
  const fieldRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const text = draft?.value === value ? draft.text : displayBirthday(value)
  const invalid = blurred && Boolean(text.trim()) && !value
  const open = calendar !== null
  const today = getTodayDateString()

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: Event) => {
      if (event.target instanceof Node && !fieldRef.current?.contains(event.target)) setCalendar(null)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('focusin', closeOutside)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('focusin', closeOutside)
    }
  }, [open])

  const openCalendar = () => {
    const [year, month] = (isoBirthday(value, today) || today).split('-').map(Number)
    setCalendar({ year, month })
  }

  const chooseDate = (date: string) => {
    setDraft(undefined)
    setBlurred(false)
    onChange(date)
    setCalendar(null)
    inputRef.current?.focus()
  }

  return (
    <div
      ref={fieldRef}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return
        setBlurred(true)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          event.stopPropagation()
          setCalendar(null)
          inputRef.current?.focus()
        }
        if (event.altKey && event.key === 'ArrowDown' && !open) {
          event.preventDefault()
          openCalendar()
        }
      }}
    >
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-gray-600">
        Date of Birth <span aria-hidden="true">*</span>
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          required
          placeholder="MM/DD/YYYY"
          className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-3 pr-11 text-base md:text-sm"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          aria-controls={open ? `${id}-calendar` : undefined}
          value={text}
          onClick={() => { if (!open) openCalendar() }}
          onChange={(event) => {
            const nextText = event.currentTarget.value
            const nextDate = isoBirthday(nextText, today)
            setDraft({ value: nextDate, text: nextText })
            setBlurred(false)
            if (nextDate !== value) onChange(nextDate)
            if (nextDate) setCalendar(null)
          }}
          onBlur={() => { if (value) setDraft(undefined) }}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-gray-600 hover:bg-gray-100"
          aria-label={open ? 'Close calendar' : 'Open calendar'}
          aria-expanded={open}
          aria-controls={open ? `${id}-calendar` : undefined}
          onClick={() => { if (open) setCalendar(null); else openCalendar() }}
        >
          <CalendarDays size={18} aria-hidden="true" />
        </button>
        {calendar && (
          <BirthdayCalendar
            id={`${id}-calendar`}
            calendar={calendar}
            today={today}
            value={value}
            onNavigate={setCalendar}
            onSelect={chooseDate}
          />
        )}
      </div>
      {invalid && <p id={`${id}-error`} className="mt-1 text-xs text-red-700">Enter a valid date of birth in MM/DD/YYYY format.</p>}
    </div>
  )
}

interface BirthdayCalendarProps {
  id: string
  calendar: CalendarMonth
  today: string
  value: string
  onNavigate: (calendar: CalendarMonth) => void
  onSelect: (date: string) => void
}

function BirthdayCalendar({ id, calendar: { year, month }, today, value, onNavigate, onSelect }: BirthdayCalendarProps) {
  const [currentYear, currentMonth] = today.split('-').map(Number)
  const firstYear = Math.min(currentYear - 120, Number(value.slice(0, 4)) || currentYear)
  const isCurrentMonth = year === currentYear && month === currentMonth
  const firstOfMonth = new Date(2000, 0, 1)
  firstOfMonth.setFullYear(year, month - 1, 1)
  const endOfMonth = new Date(firstOfMonth)
  endOfMonth.setMonth(month, 0)

  const changeMonth = (step: number) => {
    const next = new Date(firstOfMonth)
    next.setMonth(next.getMonth() + step)
    onNavigate({ year: next.getFullYear(), month: next.getMonth() + 1 })
  }

  return (
    <section id={id} aria-label="Birthday calendar" className="absolute inset-x-0 top-full z-20 mt-1 max-w-xs rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
      <div className="flex items-center justify-between gap-1">
        <button type="button" aria-label="Previous month" disabled={year === firstYear && month === 1} onClick={() => changeMonth(-1)} className="flex h-9 w-7 shrink-0 items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30">
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <select aria-label="Month" value={month} className="h-9 min-w-0 rounded border border-gray-300 bg-white text-sm" onChange={(event) => onNavigate({ year, month: Number(event.target.value) })}>
          {months.map((name, index) => <option key={name} value={index + 1} disabled={year === currentYear && index + 1 > currentMonth}>{name}</option>)}
        </select>
        <select aria-label="Year" value={year} className="h-9 rounded border border-gray-300 bg-white text-sm" onChange={(event) => {
          const selectedYear = Number(event.target.value)
          onNavigate({ year: selectedYear, month: selectedYear === currentYear ? Math.min(month, currentMonth) : month })
        }}>
          {Array.from({ length: currentYear - firstYear + 1 }, (_, index) => currentYear - index).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <button type="button" aria-label="Next month" disabled={isCurrentMonth} onClick={() => changeMonth(1)} className="flex h-9 w-7 shrink-0 items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30">
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-sm">
        {weekdays.map((weekday) => <span key={weekday} aria-hidden="true" className="py-1 text-xs font-medium text-gray-500">{weekday}</span>)}
        {Array.from({ length: firstOfMonth.getDay() }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
        {Array.from({ length: endOfMonth.getDate() }, (_, index) => {
          const day = index + 1
          const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          return (
            <button
              key={day}
              type="button"
              aria-label={`${months[month - 1]} ${day}, ${year}`}
              aria-pressed={date === value}
              disabled={date > today}
              onClick={() => onSelect(date)}
              className="h-9 rounded hover:bg-gray-100 aria-pressed:bg-vortex-red aria-pressed:text-white disabled:opacity-30"
            >
              {day}
            </button>
          )
        })}
      </div>
    </section>
  )
}
