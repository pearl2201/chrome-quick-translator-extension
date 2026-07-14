import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import DictionaryManager from './popup/DictionaryManager'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DictionaryManager />
  </StrictMode>,
)
