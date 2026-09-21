import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import MemberClassesOfferedEnroll from '../../../src/components/member/MemberClassesOfferedEnroll'
import FamilySignupWizard from '../../../src/components/signup/FamilySignupWizard'
import { clearPortalSession } from '../../../src/utils/portalSession'
import '../../../src/index.css'

const params = new URLSearchParams(window.location.search)
const members = [{ id: 101, label: 'Athlete One' }, { id: 102, label: 'Athlete Two' }]
const programs = [{
  id: 1, displayName: 'Test Gymnastics', primarySportName: 'Gymnastics', description: null,
  classes: [{ id: 2, displayName: 'Test Class', formId: 3, description: null, skillLevel: null,
    ageMin: null, ageMax: null, skillRequirements: null, signupUrl: null }],
}]
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <main className="mx-auto max-w-3xl p-6">
      {params.has('family') ? <FamilySignupWizard mode="public" /> : <>
        <button onClick={() => clearPortalSession()}>Test logout</button>
        <MemberClassesOfferedEnroll
          apiUrl="http://localhost:3001" memberToken="fixture-token"
          stripeEnabled={params.has('stripe')} programs={programs} members={members}
          defaultMemberId={101} enrollments={params.has('existing') ? [{
            id: 77, member_id: 102, source: 'scheduling', status: 'confirmed',
            form_id: 3, slot_group_id: 4, time_slot_id: 5,
            member_first_name: 'Athlete', member_last_name: 'Two', class_name: 'Test Class', slot_label: 'Monday',
          }] : []} onEnrolled={() => {}}
        />
      </>}
    </main>
  </BrowserRouter>,
)
