import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SettingsPage from './popup/SettingsPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsPage />
  </StrictMode>,
)
