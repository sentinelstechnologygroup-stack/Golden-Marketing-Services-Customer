import Account from './pages/Account';
import CampaignConsent from './components/CampaignConsent';
import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import Layout from '@/components/layout/Layout';
import Home from '@/pages/Home';
const Buy = lazy(() => import('@/pages/Buy'));
const Sell = lazy(() => import('@/pages/Sell'));
const Properties = lazy(() => import('@/pages/Properties'));
const PropertyDetail = lazy(() => import('@/pages/PropertyDetail'));
const Communities = lazy(() => import('@/pages/Communities'));
const CommunityDetail = lazy(() => import('@/pages/CommunityDetail'));
const About = lazy(() => import('@/pages/About'));
const Team = lazy(() => import('@/pages/Team'));
const Contact = lazy(() => import('@/pages/Contact'));
const SimplePage = lazy(() => import('@/pages/SimplePage'));
const Resources = lazy(() => import('@/pages/Resources'));
const Testimonials = lazy(() => import('@/pages/Testimonials'));
const SoldProperties = lazy(() => import('@/pages/SoldProperties'));
const MlsSearch = lazy(() => import('@/pages/MlsSearch'));
const LiveProperty = lazy(() => import('@/components/conversion/PropertySearch'));
const PageNotFound = lazy(() => import('@/pages/PageNotFound'));
const FirmFactSheet = lazy(() => import('@/pages/FirmFactSheet'));
const FeaturedProperties = lazy(() => import('@/pages/FeaturedProperties'));
const FeaturedPropertyDetail = lazy(() => import('@/pages/FeaturedPropertyDetail'));
const Blog = lazy(() => import('@/pages/Blog'));
const BlogPost = lazy(() => import('@/pages/BlogPost'));

const SiteRoutes = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/account" element={<Account />} />
        <Route path="/buy" element={<Buy />} />
        <Route path="/mls-search" element={<MlsSearch />} />
        <Route path="/property/:boardId/:mlsNumber" element={<LiveProperty />} />
        <Route path="/sell" element={<Sell />} />
        <Route path="/properties" element={<Properties />} />
        <Route path="/featured-properties" element={<FeaturedProperties />} />
        <Route path="/featured-properties/:slug" element={<FeaturedPropertyDetail />} />
        <Route path="/off-market-properties" element={<Navigate to="/featured-properties?status=off-market" replace />} />
        <Route path="/off-market-properties/:slug" element={<FeaturedPropertyDetail />} />
        <Route path="/properties/:slug" element={<PropertyDetail />} />
        <Route path="/communities" element={<Communities />} />
        <Route path="/communities/:slug" element={<CommunityDetail />} />
        <Route path="/about" element={<About />} />
        <Route path="/team" element={<Team />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/blog" element={<Suspense fallback={<div className="min-h-[50vh] bg-background" />}><Blog /></Suspense>} />
        <Route path="/blog/:slug" element={<Suspense fallback={<div className="min-h-[50vh] bg-background" />}><BlogPost /></Suspense>} />
        <Route path="/testimonials" element={<Testimonials />} />
        <Route path="/sold-properties" element={<SoldProperties />} />
        <Route path="/ai" element={<FirmFactSheet />} />
        <Route
          path="/faq"
          element={
            <SimplePage
              eyebrow="FAQ"
              title="Frequently asked questions."
              subtitle="Clear answers to the questions we hear most often."
              sections={[
                { heading: "Buying", list: ["Start with your goals, preferred communities, budget, and financing plan.", "Golden Cross Realty can help coordinate property tours, offers, inspections, and closing milestones."] },
                { heading: "Selling", list: ["A property evaluation helps establish a competitive launch position.", "Marketing, showing coordination, offer review, and negotiation are tailored to your property and goals."] },
                { heading: "Working with us", list: ["The team serves Montgomery, Harris, and surrounding counties.", "Call (936) 537-0568 or use the contact form to begin."] },
              ]}
              cta={{ text: "Still have questions?", label: "Contact Us", href: "/contact" }}
            />
          }
        />
        <Route
          path="/support"
          element={
            <SimplePage
              eyebrow="Customer Support"
              title="We're here to help."
              subtitle="Reach the Golden Cross Realty team by phone, email, or our contact form."
              sections={[
                { heading: "Send an inquiry", body: "Use our contact form to tell us about your property goals. A team member will follow up with you." },
                { heading: "Other ways to reach us", list: ["Phone: (936) 537-0568", "Email: Broker@GoldenCrossRealty.com", "Office: 3501 N Frazier St, Conroe, TX 77303"] },
              ]}
              cta={{ text: "Prefer to reach out directly?", label: "Contact Us", href: "/contact" }}
            />
          }
        />
        <Route
          path="/privacy"
          element={
            <SimplePage
              eyebrow="Legal"
              title="Privacy Policy"
              subtitle="How Golden Cross Realty handles your information."
              sections={[
                { heading: "Who we are", body: "Golden Cross Realty is the trading name of Goldencross, LLC, an independent Texas real estate brokerage. This policy applies to information collected through GoldenCrossRealty.com and direct communications with the brokerage." },
                { heading: "Information we collect", list: ["Contact information such as name, email address, and telephone number.", "Property interests, preferred appointment details, budget or price range, and messages you choose to submit.", "Referral, campaign, and advertising-attribution information, including UTM parameters and advertising click identifiers.", "Basic technical and usage information such as device, browser, pages visited, referral source, and approximate location when analytics tools are enabled."] },
                { heading: "How information is used", list: ["Respond to inquiries, arrange consultations or property tours, and provide requested real estate services.", "Maintain lead and client records, communicate service updates, and follow up when permission has been provided.", "Operate, secure, measure, and improve the website and advertising campaigns.", "Comply with legal, regulatory, recordkeeping, and professional obligations."] },
                { heading: "Service providers and third-party tools", body: "We do not sell personal information. Information may be processed by providers that support website hosting, form delivery, email, analytics, advertising measurement, customer support, MLS/IDX search, and security. Live MLS tools and other external websites operate under their own privacy policies. Information may also be disclosed when required by law or with your direction or consent." },
                { heading: "Cookies and advertising measurement", body: "The website may use browser storage, cookies, analytics tags, and advertising conversion tools to remember attribution and measure performance. You may restrict cookies through your browser or applicable consent controls. Some functionality or measurement may then be limited." },
                { heading: "Retention and security", body: "We retain information for as long as reasonably necessary for the purpose collected, legitimate business and professional needs, dispute resolution, and legal or regulatory obligations. We use reasonable administrative and technical safeguards, but no internet transmission or storage system can be guaranteed completely secure." },
                { heading: "Your choices", body: "You may request access, correction, or deletion of information you submitted, subject to applicable legal and professional retention requirements. You may also withdraw marketing consent or opt out of marketing communications. Contact Broker@GoldenCrossRealty.com or call (936) 537-0568." },
                { heading: "Children and external links", body: "The website is intended for adults seeking real estate services and is not directed to children under 13. Golden Cross Realty is not responsible for the privacy or content practices of external websites linked from this site." },
                { heading: "Policy updates and contact", body: "We may revise this policy as services and legal requirements change. Material updates will be posted on this page. Last updated September 20, 2026. Privacy questions may be directed to Golden Cross Realty, 3501 N Frazier St, Conroe, TX 77303, Broker@GoldenCrossRealty.com, or (936) 537-0568." }
              ]}
            />
          }
        />
        <Route
          path="/terms"
          element={
            <SimplePage
              eyebrow="Legal"
              title="Terms & Real Estate Disclosures"
              subtitle="Terms of use and required real estate disclosures."
              sections={[
                { heading: "Website use", body: "This website provides general information about Golden Cross Realty, real estate services, communities, and properties. You may use it for lawful personal purposes. You may not interfere with its operation, attempt unauthorized access, submit false or harmful information, or reproduce protected content except as permitted by law." },
                { heading: "No brokerage relationship created online", body: "Visiting this website, using a calculator, searching listings, or sending an inquiry does not by itself create a broker-client relationship, representation agreement, fiduciary duty, or guarantee of service. Representation begins only through an appropriate written agreement." },
                { heading: "Property and MLS information", body: "Property information, availability, status, measurements, schools, taxes, maps, estimates, and other details are deemed reliable but are not guaranteed. Information may originate from MLS/IDX providers, brokers, public records, sellers, or third parties and may change without notice. Consumers should independently verify information material to a decision." },
                { heading: "Calculators and educational content", body: "Mortgage calculations, market commentary, community information, and other educational material are estimates or general guidance—not lending, legal, tax, appraisal, insurance, engineering, inspection, or investment advice. Consult appropriately licensed professionals for advice specific to your situation." },
                { heading: "Third-party services", body: "The website links to HAR, mapping services, lenders, government resources, and other external services. Golden Cross Realty does not control those services and is not responsible for their availability, content, security, or privacy practices." },
                { heading: "Fair housing", body: "Golden Cross Realty supports the principles of the Fair Housing Act and provides services consistent with Equal Housing Opportunity requirements. Services are offered without unlawful discrimination." },
                { heading: "Intellectual property and availability", body: "Golden Cross Realty branding, original copy, design, and other original site materials are protected by applicable law. MLS and third-party marks and content remain the property of their respective owners. The website may be changed, suspended, or unavailable without notice." },
                { heading: "Limitation and governing law", body: "To the extent permitted by law, the website is provided without warranties regarding uninterrupted operation or completeness. These terms are governed by Texas law. Nothing in these terms limits rights or obligations that cannot legally be limited." },
                { heading: "Contact and updates", body: "Questions may be directed to Golden Cross Realty at Broker@GoldenCrossRealty.com, (936) 537-0568, or 3501 N Frazier St, Conroe, TX 77303. Last updated September 20, 2026." },
              ]}
            />
          }
        />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};


function App({ RouterComponent = Router, routerProps = {} }) {

  return (
    <>
      <RouterComponent {...routerProps}>
        <ScrollToTop /><CampaignConsent />
        <Suspense fallback={<div className="min-h-screen bg-background p-12" role="status">Loading page…</div>}><SiteRoutes /></Suspense>
      </RouterComponent>
    </>
  )
}

export default App
export { StaticRouter } from 'react-router-dom';
