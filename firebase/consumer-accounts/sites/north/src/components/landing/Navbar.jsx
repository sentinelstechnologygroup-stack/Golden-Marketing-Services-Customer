import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
const links = [['Home','/'],['Search Homes','/homes'],['Buy','/buy'],['Sell','/sell'],['Invest','/investment-properties'],['Market Reports','/market-reports'],['My account','/account']];
export default function Navbar() {
  const [open,setOpen] = useState(false);
  return <nav aria-label="Main navigation" className="fixed top-0 inset-x-0 z-50 bg-[#0A192F]/95 backdrop-blur-xl shadow-lg">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-24 lg:h-32">
      <Link to="/" onClick={()=>setOpen(false)} aria-label="Homes Around North Houston home" className="flex min-w-0 items-center gap-3"><img src="/images/brand/homes-around-north-houston-logo.png" alt="" width="1254" height="1254" className="h-[72px] w-[72px] shrink-0 object-contain sm:h-20 sm:w-20 lg:h-28 lg:w-28" /><span className="text-[#C5A059] font-display text-base font-semibold leading-tight sm:text-xl">Homes Around<br />North Houston</span></Link>
      <div className="hidden lg:flex items-center gap-1">{links.map(([label,to])=><Link key={label} to={to} className="px-3 py-2 text-sm text-white/90 hover:text-[#C5A059]">{label}</Link>)}<Link to="/#contact" className="ml-3 px-5 py-2 rounded bg-[#C5A059] text-[#0A192F] font-semibold text-sm">Contact Us</Link></div>
      <button onClick={()=>setOpen(!open)} aria-label="Toggle menu" aria-expanded={open} aria-controls="mobile-navigation" className="lg:hidden text-white p-2">{open?<X/>:<Menu/>}</button>
    </div>
    {open&&<div id="mobile-navigation" className="lg:hidden bg-[#0A192F] border-t border-white/10 p-4">{[...links,['Contact Us','/#contact']].map(([label,to])=><Link key={label} to={to} onClick={()=>setOpen(false)} className="block px-4 py-3 text-white hover:text-[#C5A059]">{label}</Link>)}</div>}
  </nav>;
}
