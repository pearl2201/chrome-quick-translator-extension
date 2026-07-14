import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import CropPage from './popup/CropPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CropPage />
  </StrictMode>,
)
