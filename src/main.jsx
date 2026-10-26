import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { getSettings } from './lib/store'
import { applyTheme } from './lib/theme'
import './fonts.css'
import './styles.css'

applyTheme(getSettings())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
