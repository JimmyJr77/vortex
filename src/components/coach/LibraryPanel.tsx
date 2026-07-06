import { useState } from 'react'
import ExerciseLibrary from './ExerciseLibrary'
import SkillLibraryPanel from './SkillLibraryPanel'
import ProgrammingLibraryPanel from './ProgrammingLibraryPanel'
import GamesLibraryPanel from './GamesLibraryPanel'

type LibraryTab = 'exercises' | 'skills' | 'programming' | 'games'

export default function LibraryPanel() {
  const [tab, setTab] = useState<LibraryTab>('exercises')

  const tabClass = (value: LibraryTab) =>
    `px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === value ? 'bg-vortex-red text-white' : 'text-gray-600 hover:bg-gray-100'}`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        <button type="button" onClick={() => setTab('exercises')} className={tabClass('exercises')}>
          Exercise Library
        </button>
        <button type="button" onClick={() => setTab('skills')} className={tabClass('skills')}>
          Skill Library
        </button>
        <button type="button" onClick={() => setTab('programming')} className={tabClass('programming')}>
          Programming Library
        </button>
        <button type="button" onClick={() => setTab('games')} className={tabClass('games')}>
          Games & Competitions
        </button>
      </div>
      {tab === 'exercises' && <ExerciseLibrary />}
      {tab === 'skills' && <SkillLibraryPanel />}
      {tab === 'programming' && <ProgrammingLibraryPanel />}
      {tab === 'games' && <GamesLibraryPanel />}
    </div>
  )
}
