import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Mail, Phone } from "lucide-react";
import { BROKERAGE, TECHNOLOGY_DISCLOSURE, PROPERTY_INFORMATION_DISCLOSURE } from "@/lib/siteConfig";

const links = [
  ["Search Homes", "/homes"],
  ["Buy a Home", "/#buyers"],
  ["Sell a Home", "/#sellers"],
  ["Market Reports", "/market-reports"],
  ["Investment Properties", "/#investing"],
  ["Contact Us", "/#contact"],
];

export default function Footer() {
  return (
    <footer className="bg-[#0A192F] text-white border-t border-[#C5A059]/30">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr] py-12 lg:py-14">
          <div>
            <p className="text-[#C5A059] text-xs font-semibold uppercase tracking-[0.2em] mb-3">Your North Houston Home</p>
            <div className="flex items-center gap-4"><img src="/images/brand/homes-around-north-houston-logo.png" alt="" width="1254" height="1254" className="h-28 w-28 shrink-0 object-contain" /><h2 className="font-display text-2xl leading-tight max-w-sm">Homes Around<br />North Houston</h2></div>
            <p className="mt-4 max-w-sm text-sm text-white/75 leading-relaxed">Buy, sell, and explore investment properties with Golden Cross Realty.</p>
            <a href="https://www.goldenmarketingservices.com/" className="inline-flex items-center gap-3 mt-6 group">
              <span className="text-xs text-white/65">Powered by</span>
              <span className="text-[#C5A059] text-lg font-semibold tracking-tight">GMS <span className="text-white">Pro</span></span>
              <ArrowUpRight size={15} className="text-[#C5A059] group-hover:text-white" />
            </a>
          </div>
          <nav aria-label="Footer navigation">
            <h2 className="text-xs text-[#C5A059] font-semibold uppercase tracking-[0.18em] mb-5">Explore</h2>
            <ul className="grid grid-cols-2 md:grid-cols-1 gap-x-6 gap-y-3">
              {links.map(([label, to]) => <li key={to}><Link to={to} className="text-sm text-white/80 hover:text-[#C5A059] transition-colors">{label}</Link></li>)}
            </ul>
          </nav>
          <div>
            <p className="text-xs text-[#C5A059] font-semibold uppercase tracking-[0.18em] mb-5">Your Real Estate Brokerage</p>
            <h2 className="font-display text-2xl font-semibold">{BROKERAGE.name}</h2>
            <div className="mt-5 space-y-4 text-sm">
              <a href={BROKERAGE.phoneHref} className="flex items-center gap-3 text-white/85 hover:text-[#C5A059]"><Phone size={16} className="text-[#C5A059] shrink-0" />{BROKERAGE.phone}</a>
              <a href={`mailto:${BROKERAGE.email}`} className="flex items-start gap-3 text-white/85 hover:text-[#C5A059]"><Mail size={16} className="text-[#C5A059] shrink-0 mt-0.5" /><span className="break-all">{BROKERAGE.email}</span></a>
            </div>
          </div>
        </div>

        <div className="border-y border-white/15 py-6 grid gap-4 lg:grid-cols-2">
          <a href={BROKERAGE.iabs} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-base text-white/90 hover:text-[#C5A059] underline decoration-[#C5A059]/60 underline-offset-4 leading-relaxed">
            <span>Texas Real Estate Commission Information About Brokerage Services</span><ArrowUpRight size={18} className="shrink-0 mt-1" />
          </a>
          <a href={BROKERAGE.consumerNotice} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-base text-white/90 hover:text-[#C5A059] underline decoration-[#C5A059]/60 underline-offset-4 leading-relaxed">
            <span>Texas Real Estate Commission Consumer Protection Notice</span><ArrowUpRight size={18} className="shrink-0 mt-1" />
          </a>
        </div>

        <div className="grid gap-7 lg:grid-cols-2 py-7">
          <section aria-labelledby="footer-technology">
            <h2 id="footer-technology" className="text-xs font-semibold uppercase tracking-[0.14em] text-white/90 mb-3">Technology &amp; Service Disclosure</h2>
            <p className="text-sm text-white/70 leading-relaxed">{TECHNOLOGY_DISCLOSURE}</p>
          </section>
          <section aria-labelledby="footer-data">
            <h2 id="footer-data" className="text-xs font-semibold uppercase tracking-[0.14em] text-white/90 mb-3">Property Information</h2>
            <p className="text-sm text-white/70 leading-relaxed">{PROPERTY_INFORMATION_DISCLOSURE}</p>
          </section>
        </div>

        <div className="border-t border-white/15 py-6 flex flex-col gap-4 text-xs text-white/65 lg:flex-row lg:items-center lg:justify-between">
          <p>© {new Date().getFullYear()} Homes Around North Houston. All rights reserved.</p>
          <p className="flex items-center gap-2"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="m3 10 9-7 9 7M5 9v12h14V9M9 12h6M9 16h6" /></svg>Equal Housing Opportunity</p>
          <div className="flex flex-wrap gap-5"><button type="button" onClick={()=>window.dispatchEvent(new Event('gms-cookie-settings'))} className="underline underline-offset-4 hover:opacity-80">Cookie settings</button><Link to="/privacy" className="hover:text-white underline underline-offset-4">Privacy Policy</Link><Link to="/terms" className="hover:text-white underline underline-offset-4">Terms &amp; Disclosures</Link></div>
        </div>
      </div>
    </footer>
  );
}
