import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import AddCreditModal from '../../../src/components/customerBilling/AddCreditModal'
import '../../../src/index.css'
function Fixture() {
  const [message,setMessage]=useState('')
  return message ? <p role="status">{message}</p> : <AddCreditModal familyId={94} onClose={()=>setMessage('Closed')} onSaved={setMessage}/>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
