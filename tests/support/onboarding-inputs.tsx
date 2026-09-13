import {createRoot} from 'react-dom/client'
import {useState} from 'react'
import TextInput from '../../src/components/common/TextInput'
import PayrollAccountLink from '../../src/components/payroll/PayrollAccountLink'
import '../../src/index.css'
function Preview(){const [phone,setPhone]=useState('');return <main className="mx-auto max-w-xl space-y-6 p-8"><label>Phone<TextInput aria-label="Phone" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="block border p-2"/></label><output data-testid="saved-phone">{phone}</output><PayrollAccountLink mode="link" facilityId={1}/></main>}
createRoot(document.getElementById('root')!).render(<Preview/>);
