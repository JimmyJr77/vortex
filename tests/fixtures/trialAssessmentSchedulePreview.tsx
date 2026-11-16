// Development-only, in-memory UI fixture. Never calls the real scheduling API.
import { createRoot } from 'react-dom/client'
import TrialAssessmentSchedulePanel from '../../src/components/coach/TrialAssessmentSchedulePanel'
import '../../src/index.css'

let nextId = 2
const schedules = [{ slotGroupId: 1, timeSlotId: 1, scheduleMode: 'day', dayOfWeek: 6,
  specificDate: null as string | null, startTime: '12:00', endTime: '13:00', maxParticipants: 8,
  activeStart: '2026-11-16', activeEnd: null as string | null, datesTbd: false }]
window.fetch = async (_input, init) => {
  if (init?.method === 'POST' || init?.method === 'PATCH') {
    const body = JSON.parse(String(init.body))
    if (init.method === 'POST') schedules.push({ ...body, slotGroupId: nextId, timeSlotId: nextId++, datesTbd: false })
    else {
      const id = Number(String(_input).split('/').pop())
      Object.assign(schedules.find(item => item.slotGroupId === id) ?? {}, body)
    }
    return Response.json({ success: true, data: {} })
  }
  return Response.json({ success: true, data: [{ id: 1, name: 'Trial Assessment', timeZone: 'America/New_York', today: '2026-11-16', schedules }] })
}
createRoot(document.getElementById('root')!).render(<main style={{ maxWidth: 1000, margin: '0 auto', padding: 20 }}><TrialAssessmentSchedulePanel /></main>)
