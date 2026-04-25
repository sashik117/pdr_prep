import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx' 
import '@/index.css'        
import { registerServiceWorker } from '@/lib/serviceWorker'

registerServiceWorker()

ReactDOM.createRoot(
  /** @type {HTMLElement} */ (document.getElementById('root'))
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
