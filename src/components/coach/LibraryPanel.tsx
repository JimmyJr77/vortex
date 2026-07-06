import { useState } from 'react'
import ExerciseLibrary from './ExerciseLibrary'
import SkillLibraryPanel from './SkillLibraryPanel'
import ProgrammingLibraryPanel from './ProgrammingLibraryPanel'

type LibraryTab = 'exercises' | 'skills' | 'programming'

export default function LibraryPanel() {
  const [tab, setTab] = useState<LibraryTab>('exercises')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        <button
          type="button"
          onClick={() => setTab('exercises')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'exercises' ? 'bg-vortex-red text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Exercise Library
        </button>
        <button
          type="button"
          onClick={() => setTab('skills')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'skills' ? 'bg-vortex-red text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Skill Library
        </button>
        <button
          type="button"
          onClick={() => setTab('programming')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'programming' ? 'bg-vortex-red text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Programming Library
        </button>
      </div>
      {tab === 'exercises' ? <ExerciseLibrary /> : tab === 'skills' ? <SkillLibraryPanel /> : <ProgrammingLibraryPanel />}
    </div>
  )
}
