import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import BatchTranslate from './popup/BatchTranslate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BatchTranslate />
  </StrictMode>,
)
