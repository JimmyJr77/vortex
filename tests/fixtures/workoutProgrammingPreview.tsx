import { createRoot } from 'react-dom/client'
import { CanonicalWorkoutGeneratorPanel } from '../../src/components/coach/CanonicalWorkoutGeneratorPanel'
import '../../src/index.css'

createRoot(document.getElementById('root')!).render(<main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8">
  <p className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">Local verification · synthetic athletes, library and model responses</p>
  <CanonicalWorkoutGeneratorPanel />
</main>)
