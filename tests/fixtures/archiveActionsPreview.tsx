import { createRoot } from 'react-dom/client'
import AdminAdmins from '../../src/components/AdminAdmins'
import AdminCoaches from '../../src/components/AdminCoaches'
import GymnasticsEvaluationPanel from '../../src/components/coach/GymnasticsEvaluationPanel'
import ThreadHeaderMenu from '../../src/components/messaging/ThreadHeaderMenu'
import '../../src/index.css'

const scenario = new URLSearchParams(location.search).get('scenario')
createRoot(document.getElementById('root')!).render(<main className="p-6">
  {scenario === 'admins' && <AdminAdmins adminInfo={{ id: 1, name: 'Test Owner', email: 'owner@example.test', isMaster: true }} setAdminInfo={() => undefined} />}
  {scenario === 'coaches' && <AdminCoaches isMasterAdmin />}
  {scenario === 'evaluation' && <GymnasticsEvaluationPanel />}
  {scenario === 'messages' && <ThreadHeaderMenu subject="Practice planning" onUpdateSubject={async () => undefined} canHideFromInbox onHideFromInbox={async () => { await fetch('/api/fixture/archive-inbox', { method: 'POST' }) }} />}
</main>)
