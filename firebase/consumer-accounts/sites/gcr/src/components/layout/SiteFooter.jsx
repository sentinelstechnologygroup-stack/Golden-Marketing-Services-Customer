import React from "react";
import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";
import Logo from "@/components/brand/Logo";
import EqualHousingOpportunity from "@/components/brand/EqualHousingOpportunity";
import { CONTACT } from "@/data/siteContent";
const COLS = [
  {
    title: "Explore",
    links: [
      { label: "Search All MLS Homes", to: "/mls-search" },
      { label: "Buy a Home", to: "/buy" },
      { label: "Sell a Home", to: "/sell" },
      { label: "Our Listings", to: "/featured-properties" },
      { label: "Communities", to: "/communities" },
      { label: "Sold Properties", to: "/sold-properties" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", to: "/about" },
      { label: "Our Team", to: "/team" },
      { label: "Resources", to: "/resources" },
      { label: "Blog", to: "/blog" },
      { label: "Testimonials", to: "/testimonials" },
      { label: "FAQ", to: "/faq" },
      { label: "Firm Fact Sheet", to: "/ai" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Contact", to: "/contact" },
      { label: "Customer Support", to: "/support" },
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms & Disclosures", to: "/terms" },
    ],
  },
];
export default function SiteFooter() {
  return (
    <footer className="bg-primary text-background">
      <div className="container-meridian py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo variant="light" />
            <p className="mt-5 font-display text-2xl">Golden Cross Realty</p>
            <p className="mt-2 text-sm text-background/80">Jonathan Currey, Broker/Owner<br />Texas Broker License #605032</p>
            <p className="mt-6 max-w-xs text-sm leading-relaxed text-background/70">
              A refined real estate experience guiding you through every step of
              buying, selling, and discovering exceptional homes.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-background/80">
              <li className="flex items-center gap-3">
                <Phone size={15} className="text-accent" />
                <a href={CONTACT.phoneHref} className="hover:text-accent">
                  {CONTACT.phoneDisplay}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={15} className="text-accent" />
                <a href={`mailto:${CONTACT.email}`} className="hover:text-accent">
                  {CONTACT.email}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={15} className="text-accent mt-1 shrink-0" />
                <span>{CONTACT.address}</span>
              </li>
            </ul>
          </div>
          {COLS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="font-heading text-xs uppercase tracking-[0.25em] text-accent">
                {col.title}
              </h3>
              <ul className="mt-5 space-y-3">
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link
                      to={l.to}
                      className="text-sm text-background/70 hover:text-accent transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 grid gap-7 border-t border-background/15 pt-7 md:grid-cols-2 lg:grid-cols-[1.35fr_1.15fr_1fr] lg:gap-12">
          <div>
            <Link to="/terms" className="inline-flex text-background/90 underline-offset-4 hover:text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
              <EqualHousingOpportunity />
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-background/80">
              We provide real estate services without discrimination based on race,
              color, religion, national origin, sex, disability, familial status, or
              any other characteristic protected by applicable law.
            </p>
          </div>
          <nav aria-label="Texas real estate disclosures" className="flex flex-col items-start gap-3 text-base">
            <a href="/documents/golden-cross-realty-iabs.pdf" target="_blank" rel="noreferrer" className="text-background/75 underline decoration-accent/70 underline-offset-4 hover:text-accent">TREC Information About Brokerage Services</a>
            <a href="/documents/trec-consumer-protection-notice.pdf" target="_blank" rel="noreferrer" className="text-background/75 underline decoration-accent/70 underline-offset-4 hover:text-accent">Texas Real Estate Commission Consumer Protection Notice</a>
          </nav>
          <div className="space-y-4 text-xs leading-relaxed text-background/75 md:col-span-2 lg:col-span-1">
            <p>
              All information is deemed reliable but not guaranteed and should be
              independently verified.
            </p>
            <p>
              &copy; {new Date().getFullYear()} Golden Cross Realty. All rights reserved.
            </p>
          </div>
        </div>
      </div>
      <div className="container-meridian pb-6 text-sm text-background/75"><button type="button" onClick={()=>window.dispatchEvent(new Event('gms-cookie-settings'))} className="underline underline-offset-4 hover:opacity-80">Cookie settings</button></div>
    </footer>
  );
}
