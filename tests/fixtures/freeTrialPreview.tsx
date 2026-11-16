import { createRoot } from 'react-dom/client'
import NewPageTrialRegistration from '../../src/components/newpage/NewPageTrialRegistration'
import '../../src/index.css'

const mommyMe = new URLSearchParams(location.search).get('track') === 'mommy-me'

createRoot(document.getElementById('root')!).render(<main style={{ maxWidth: 680, margin: '0 auto', padding: 20 }}>
  <NewPageTrialRegistration selection={{
    program: mommyMe ? 'gymnastics' : 'fit-flip', age: mommyMe ? 3 : 10, slotGroupId: 200, classDate: '2027-01-12',
    className: mommyMe ? 'Mommy & Me' : 'F&F Cyclones 8–11', startTime: '17:00:00', endTime: '18:00:00',
    ...(mommyMe ? { gymnasticsTrack: 'mommy-me' as const, pottyTrained: true } : {}),
  }} onBack={() => {}} />
</main>)
