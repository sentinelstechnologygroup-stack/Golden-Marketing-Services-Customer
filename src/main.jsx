import { initializeDesktopApp } from '@/lib/desktopApp';
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

initializeDesktopApp();

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
