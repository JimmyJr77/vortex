import { useState } from 'react'
import ExerciseLibrary from './ExerciseLibrary'
import SkillLibraryPanel from './SkillLibraryPanel'
import ProgrammingLibraryPanel from './ProgrammingLibraryPanel'
import GamesLibraryPanel from './GamesLibraryPanel'

type LibraryTab = 'exercises' | 'skills' | 'programming' | 'games'

export default function LibraryPanel() {
  const [tab, setTab] = useState<LibraryTab>('exercises')

  const tabClass = (value: LibraryTab) =>
    `-mb-px border-b-2 px-1 py-2 text-sm font-semibold transition-colors ${
      tab === value
        ? 'border-vortex-red text-vortex-red'
        : 'border-transparent text-gray-500 hover:text-gray-800'
    }`

  return (
    <div className="space-y-5">
      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap gap-6">
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
        </nav>
      </div>
      {tab === 'exercises' && <ExerciseLibrary />}
      {tab === 'skills' && <SkillLibraryPanel />}
      {tab === 'programming' && <ProgrammingLibraryPanel />}
      {tab === 'games' && <GamesLibraryPanel />}
    </div>
  )
}
