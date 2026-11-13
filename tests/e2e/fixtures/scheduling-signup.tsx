import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import SchedulingPage from '../../../src/components/SchedulingPage'
import '../../../src/index.css'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter><SchedulingPage /></BrowserRouter>,
)
