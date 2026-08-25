import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/chrome.css'
import './styles/universe.css'
import './styles/screens.css'
import './styles/viewer.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
