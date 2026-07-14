import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import TranslatePage from './popup/TranslatePage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TranslatePage />
  </StrictMode>,
)
