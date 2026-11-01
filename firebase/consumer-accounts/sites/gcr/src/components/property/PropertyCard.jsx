import FavoriteButton from './FavoriteButton';
import React from "react";
import { Link } from "react-router-dom";
import { Bed, Bath, Maximize, Trees } from "lucide-react";
import { Image } from "@/components/ui/image";

// Reusable brokerage listing card. Availability must be verified with the team
// until the approved MLS/IDX adapter becomes the source of truth.
export default function PropertyCard({ image, price, address, title, beds, baths, sqft, acreage = "", status = "For Sale", href = "/properties", sample = true, mls, details }) {
  return (
    <article className="relative"><Link to={href} className="group block bg-card card-shadow overflow-hidden transition-transform duration-300 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
      <div className="crosshair-frame relative aspect-[3/2] overflow-hidden">
        <Image
          src={image}
          alt={address}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          fittingType="fill"
        />
        <span className="absolute left-3 top-3 z-20 bg-primary text-background px-3 py-1 text-[0.65rem] font-heading uppercase tracking-[0.2em]">
          {status}
        </span>
        {sample && (
          <span className="absolute right-3 top-3 z-20 bg-background/90 text-foreground px-2.5 py-1 text-[0.6rem] font-heading uppercase tracking-[0.15em] text-warning border border-warning/40">
            Sample
          </span>
        )}
      </div>
      <div className="p-6">
        <p className="font-display text-2xl text-foreground">{price}</p>
        <p className="mt-1 text-sm text-muted-foreground">{address}</p>
        {title && <p className="mt-3 text-sm text-foreground/80">{title}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-foreground/70 border-t border-border pt-4">
          {beds && <span className="flex items-center gap-1.5">
            <Bed size={15} className="text-accent" /> {beds} bd
          </span>}
          {baths && <span className="flex items-center gap-1.5">
            <Bath size={15} className="text-accent" /> {baths} ba
          </span>}
          {sqft && <span className="flex items-center gap-1.5">
            <Maximize size={15} className="text-accent" /> {sqft} sqft
          </span>}
          {acreage && <span className="flex items-center gap-1.5">
            <Trees size={15} className="text-accent" /> {acreage}
          </span>}
        </div>
        <span className="mt-5 inline-flex font-heading text-sm tracking-wide text-foreground group-hover:text-accent transition-colors">
          View details →
        </span>
      </div>
    </Link>{!sample&&/^[A-Za-z0-9-]{1,50}$/.test(String(mls||details?.MLS||''))&&<FavoriteButton listingId={'147:'+(mls||details.MLS)} address={address}/>}</article>
  );
}
