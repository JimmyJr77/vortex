import { useState } from 'react'
import ArchivedCRM from '../../src/components/newAdmin/ArchivedCRM'
import { createRoot } from 'react-dom/client'
import AdminAdmins from '../../src/components/AdminAdmins'
import AdminCoaches from '../../src/components/AdminCoaches'
import GymnasticsEvaluationPanel from '../../src/components/coach/GymnasticsEvaluationPanel'
import ThreadHeaderMenu from '../../src/components/messaging/ThreadHeaderMenu'
import FamilyDirectory from '../../src/components/newAdmin/FamilyDirectory'
import '../../src/index.css'

function FamilyArchivesPreview() {
  const [archived, setArchived] = useState(false)
  return archived ? <ArchivedCRM revision={0} onBack={() => setArchived(false)} /> : <>
    <button onClick={() => setArchived(true)}>View Archives</button>
    <FamilyDirectory access={{ isMasterAdmin: true, permissions: [] }} revision={0} onSelect={() => undefined} />
  </>
}

const scenario = new URLSearchParams(location.search).get('scenario')
createRoot(document.getElementById('root')!).render(<main className="p-6">
  {scenario === 'families' && <FamilyArchivesPreview />}
  {scenario === 'admins' && <AdminAdmins adminInfo={{ id: 1, name: 'Test Owner', email: 'owner@example.test', isMaster: true }} setAdminInfo={() => undefined} />}
  {scenario === 'coaches' && <AdminCoaches isMasterAdmin />}
  {scenario === 'evaluation' && <GymnasticsEvaluationPanel />}
  {scenario === 'messages' && <ThreadHeaderMenu subject="Practice planning" onUpdateSubject={async () => undefined} canHideFromInbox onHideFromInbox={async () => { await fetch('/api/fixture/archive-inbox', { method: 'POST' }) }} />}
</main>)
