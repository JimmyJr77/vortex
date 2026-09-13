import { useState } from 'react'
import type { CanonicalActivitySchedule } from '../../../backend/platform/workoutResourceScheduler.js'
import { CANONICAL_EQUIPMENT_OPTIONS } from '../../coach/canonicalEquipmentOptions'
import { durationLabel } from '../../coach/workoutProgramming'
import { actionClass } from './ProgrammingControls'

const equipmentLabel = (key: string) => CANONICAL_EQUIPMENT_OPTIONS.find(([id]) => id === key)?.[1] ?? key.replaceAll('_', ' ')

export function ProgrammingActivitySchedule({ schedule, athleteNames }: { schedule: CanonicalActivitySchedule; athleteNames: ReadonlyMap<string, string> }) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)
  const visibleEvents = open ? schedule.events.slice(page * 100, (page + 1) * 100) : []
  return <details className="mt-3 rounded-lg bg-gray-50 p-3" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-semibold text-gray-800">Station plan and start times</summary>
    {open && <div className="mt-3 space-y-3 text-sm text-gray-700">
      <p>{schedule.stationCount} stations · up to {schedule.athletesPerStation} athletes per station · {schedule.waveCount} waves
        {schedule.requiresLanes ? ` · ${schedule.stationCount} lanes` : ''}</p>
      {schedule.requiredEquipment.length > 0 && <p>Per station: {schedule.requiredEquipment.map((key) => `${schedule.quantitiesPerStation[key]} × ${equipmentLabel(key)}`).join(', ')}.</p>}
      <p>{schedule.clockKind === 'minute_clock' ? 'Minute clock' : schedule.clockKind === 'fixed_interval' ? 'Fixed intervals' : 'Recovery between sets'}
        {schedule.clockIntervalSeconds != null ? ` · ${schedule.clockIntervalSeconds}s interval · ${schedule.batchCount} batches` : ''}.
        {' '}Scheduled recovery between sets: {durationLabel(schedule.restSecondsPerAthleteBetweenSets)} per athlete.</p>
      <p>Setup {durationLabel(schedule.timing.setupSeconds)} · Demonstration {durationLabel(schedule.timing.demonstrationSeconds)} · Transition {durationLabel(schedule.timing.transitionSeconds)}
        {' '}· Station reset {durationLabel(schedule.timing.resetSeconds)} · Cleanup {durationLabel(schedule.timing.cleanupSeconds)}.</p>
      {schedule.needsCoachTimingConfirmation && <p className="text-amber-800">Some setup or teaching times still need coach confirmation. Review the session findings before using this timetable.</p>}
      <div role="region" aria-label="Station start times" tabIndex={0} className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[480px] text-left text-xs"><caption className="p-2 text-left text-gray-500">Times are measured from the beginning of the session.</caption>
          <thead className="bg-gray-100 text-gray-800"><tr><th scope="col" className="p-2">Work window</th><th scope="col" className="p-2">Set / wave</th><th scope="col" className="p-2">Station assignments</th></tr></thead>
          <tbody>{visibleEvents.map((event) => <tr key={`${event.set}:${event.wave}:${event.batch}`} className="border-t border-gray-200 align-top">
            <td className="whitespace-nowrap p-2 tabular-nums">{durationLabel(event.startSeconds)}–{durationLabel(event.endSeconds)}</td>
            <td className="p-2">Set {event.set} · Wave {event.wave}{schedule.batchCount > 1 ? ` · Batch ${event.batch}` : ''}</td>
            <td className="space-y-1 p-2">{event.stationAssignments.map((station) => <p key={station.station}>Station {station.station}{station.lane != null ? ` / Lane ${station.lane}` : ''}: {station.athleteKeys.map((key) => athleteNames.get(key) ?? 'Athlete missing from group').join(', ')}</p>)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {schedule.events.length > 100 && <div className="flex flex-wrap items-center gap-2"><span>Starts {page * 100 + 1}–{Math.min((page + 1) * 100, schedule.events.length)} of {schedule.events.length}</span>
        <button type="button" className={actionClass} disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous starts</button>
        <button type="button" className={actionClass} disabled={(page + 1) * 100 >= schedule.events.length} onClick={() => setPage((value) => value + 1)}>Next starts</button></div>}
      <p>Final recovery complete at {durationLabel(schedule.recoveryCompleteSeconds)}. Cleanup ends at {durationLabel(schedule.endSeconds)}.</p>
    </div>}
  </details>
}
