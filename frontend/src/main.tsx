import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope)

        // Check for updates periodically
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000) // Check every hour
      })
      .catch((error) => {
        console.log('SW registration failed:', error)
      })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
