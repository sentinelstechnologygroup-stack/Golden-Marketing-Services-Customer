import Account from './pages/Account';
import CampaignConsent from './components/CampaignConsent';
import { Toaster } from "@/components/ui/toaster"
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import PageNotFound from './lib/PageNotFound'
import ScrollToTop from './components/ScrollToTop'
import Home from './pages/Home'
import Homes from './pages/Homes'
import MarketReports from './pages/MarketReports'
import Legal from './pages/Legal'
import IntentPage from './pages/IntentPage'
import Seo from './components/Seo'
import LeadFunnel from './components/LeadFunnel'
import VerifyContact from './pages/VerifyContact'

export function SiteRoutes() {
  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:p-3">Skip to content</a>
      <Seo />
      <ScrollToTop /><CampaignConsent />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/account" element={<Account />} />
        <Route path="/buy" element={<IntentPage interest="buying" />} />
        <Route path="/sell" element={<IntentPage interest="selling" />} />
        <Route path="/investment-properties" element={<IntentPage interest="investing" />} />
        <Route path="/verify" element={<VerifyContact />} />
        <Route path="/homes" element={<Homes />} />
        <Route path="/property/:boardId/:mlsNumber" element={<Homes />} />
        <Route path="/market-reports" element={<MarketReports />} />
        <Route path="/privacy" element={<Legal type="privacy" />} />
        <Route path="/terms" element={<Legal type="terms" />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      <LeadFunnel />
      <Toaster />
    </>
  )
}

export default function App() { return <Router><SiteRoutes /></Router> }
