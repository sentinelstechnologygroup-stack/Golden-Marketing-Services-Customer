import React, { useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X, Phone } from "lucide-react";
import Logo from "@/components/brand/Logo";

const NAV = [
  { label: "Search Homes", to: "/mls-search" },
  { label: "Sell", to: "/sell" },
  { label: "Our Listings", to: "/featured-properties" },
  { label: "Communities", to: "/communities" },
  { label: "Our Team", to: "/team" },
  { label: "Resources", to: "/resources" },
  { label: "Blog", to: "/blog" },
  { label: "About", to: "/about" },
  { label: "My account", to: "/account" },
];

export default function SiteHeader() {
  const menuButton = useRef(null);
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-primary/95 text-background backdrop-blur-md border-b border-accent/25 shadow-lg shadow-black/10">
      <div className="container-meridian flex h-20 items-center justify-between">
        <Link to="/" aria-label="Golden Cross Realty home" className="shrink-0">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden xl:flex items-center gap-5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `whitespace-nowrap font-heading text-sm tracking-wide transition-colors duration-200 hover:text-accent ${
                  isActive ? "text-accent" : "text-background/85"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-5">
          <a
            href="tel:+19365370568"
            className="flex whitespace-nowrap items-center gap-2 font-heading text-sm text-background/80 hover:text-accent transition-colors"
            aria-label="Call Golden Cross Realty at 936-537-0568"
          >
            <Phone size={15} className="text-accent" />
            <span>(936) 537-0568</span>
          </a>
          <Link to="/contact" className="btn-gold">
            Contact
          </Link>
        </div>

        <button
          type="button"
          className="xl:hidden p-2 -mr-2 text-background"
          onClick={() => setOpen((v) => !v)}
          ref={menuButton}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div id="mobile-nav" onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); menuButton.current?.focus(); } }} className="xl:hidden max-h-[calc(100dvh-9rem)] overflow-y-auto border-t border-accent/20 bg-primary text-background">
          <nav aria-label="Mobile" className="container-meridian py-6 flex flex-col gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `py-3 font-heading text-base border-b border-background/15 ${
                    isActive ? "text-accent" : "text-background/85"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link
              to="/contact"
              onClick={() => setOpen(false)}
              className="btn-gold mt-4 w-full"
            >
              Contact
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
