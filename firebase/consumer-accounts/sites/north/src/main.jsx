import './lib/accountLink';
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { captureLeadAttribution } from '@/lib/leadAttribution'

captureLeadAttribution()

// Build-time HTML serves crawlers; the interactive app renders from current URL state.
createRoot(document.getElementById('root')).render(<App />)
