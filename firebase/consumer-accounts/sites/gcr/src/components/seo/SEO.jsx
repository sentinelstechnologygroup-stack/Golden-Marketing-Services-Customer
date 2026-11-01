import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { COMMUNITIES, CONTACT } from "@/data/siteContent";
import summaries from "@/data/listingSummaries.json";
import { captureAttribution, trackEvent } from "@/lib/analytics";
import blogSummaries from "@/data/blogSummaries.json";
const getBlogMeta = slug => blogSummaries.find(post => post.slug === slug);

export const SITE_URL = "https://goldencrossrealty.com";
const DEFAULT_IMAGE = `${SITE_URL}/images/brand/north-houston-home-gcr-sign.png`;
const BROKER_URL = `${SITE_URL}/team`;
const ORGANIZATION_ID = `${SITE_URL}/#business`;
const WEBSITE_ID = `${SITE_URL}/#website`;

export const ROUTE_SEO = {
  "/account": {title:"Your account | Golden Cross Realty",description:"Securely manage your profile, saved searches and communication preferences.",noindex:true},
  "/": { title: "Conroe TX Real Estate | Golden Cross Realty", description: "Buy or sell homes, land, commercial property, and investment real estate in Conroe, Lake Conroe, Willis, Montgomery County, and Greater Houston with a local broker-led team." },
  "/buy": { title: "Buy a Home or Property in Conroe TX | Golden Cross Realty", description: "Explore homes, land, commercial property, and investments across Conroe, Lake Conroe, Willis, Montgomery County, and Greater Houston with experienced local guidance." },
  "/mls-search": { title: "Homes for Sale in Conroe and Greater Houston | Golden Cross Realty", description: "Explore homes for sale across Conroe, Lake Conroe, Montgomery County and Greater Houston. Search the map and connect with the Golden Cross Realty office team." },
  "/sell": { title: "Sell Your Home in Conroe TX | Golden Cross Realty", description: "Request a local home valuation and a tailored marketing strategy for selling property in Conroe, Lake Conroe, Willis, Montgomery County, and surrounding Texas communities." },
  "/properties": { title: "Homes & Land for Sale Near Conroe TX | Golden Cross Realty", description: "Browse Golden Cross Realty listings across Conroe, Willis, Lake Conroe, Montgomery County, and surrounding Texas markets." },
  "/featured-properties": { title: "Golden Cross Realty Featured Properties | Live HAR MLS Listings", description: "View Golden Cross Realty's current featured homes, land, and property listings, with live prices, photos, and statuses supplied through HAR MLS." },
  "/communities": { title: "Conroe & Lake Conroe Area Communities | Golden Cross Realty", description: "Explore real estate and community guides for Conroe, Willis, Montgomery, The Woodlands, Lake Conroe, and Greater Houston." },
  "/about": { title: "About Golden Cross Realty | Conroe TX Brokerage", description: "Meet the faith-driven, broker-led real estate company serving buyers, sellers, landowners, and investors across Montgomery and Harris counties." },
  "/team": { title: "Golden Cross Realty Agents | Conroe TX", description: "Meet Jonathan Currey and the Golden Cross Realty team serving Conroe, Lake Conroe, Montgomery County, Greater Houston, and surrounding Texas communities." },
  "/contact": { title: "Contact Golden Cross Realty | Conroe TX", description: `Call ${CONTACT.phoneDisplay} or contact Golden Cross Realty at ${CONTACT.address} for help buying, selling, or investing in Texas real estate.` },
  "/resources": { title: "Texas Real Estate Buyer & Seller Resources | Golden Cross Realty", description: "Practical guides for buying, selling, financing, and preparing for a real estate move in Conroe and Montgomery County, Texas." },
  "/blog": { title: "Conroe TX Real Estate Blog | Golden Cross Realty", description: "Practical homebuying, selling, mortgage, investing, and local market guidance from Golden Cross Realty in Conroe, Texas." },
  "/testimonials": { title: "Golden Cross Realty Client Reviews | Conroe TX", description: "Read verified client experiences with Jonathan Currey and Golden Cross Realty across Conroe, Lake Conroe, and Montgomery County." },
  "/sold-properties": { title: "Sold Properties & Real Estate Results | Golden Cross Realty", description: "See a selection of homes, condos, land, and leases successfully represented by Golden Cross Realty across Conroe, Willis, Montgomery County, and Greater Houston." },
  "/ai": { title: "Golden Cross Realty Firm Fact Sheet | Conroe TX", description: "Verified business identity, broker license, services, service areas, team, and contact information for Golden Cross Realty in Conroe, Texas." },
  "/faq": { title: "Conroe TX Real Estate FAQ | Golden Cross Realty", description: "Answers to common questions about buying, selling, property tours, and working with Golden Cross Realty in Montgomery County." },
  "/support": { title: "Customer Support | Golden Cross Realty", description: "Get help from Golden Cross Realty by phone, email, or the website contact form." },
  "/privacy": { title: "Privacy Policy | Golden Cross Realty", description: "Review how Golden Cross Realty handles information submitted through its website, forms, analytics, and customer support tools.", noindex: true },
  "/terms": { title: "Terms & Real Estate Disclosures | Golden Cross Realty", description: "Golden Cross Realty website terms, property information disclosures, and Equal Housing Opportunity notice.", noindex: true },
};

function setMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
}

export function resolveSeo(pathname) {
  if (/^\/property\/147\/[A-Za-z0-9-]{1,50}$/.test(pathname)) return { title: "Property Details | Golden Cross Realty", description: "Explore this home and request assistance from the Golden Cross Realty office team.", noindex: true };
  const blogPost = pathname.startsWith("/blog/") ? getBlogMeta(pathname.split("/").filter(Boolean).at(-1)) : null;
  if (blogPost) return {
    title: blogPost.seoTitle || `${blogPost.title} | Golden Cross Realty`,
    description: blogPost.metaDescription || blogPost.excerpt,
    image: new URL(blogPost.image, SITE_URL).href,
    blogPost,
  };
  const isPropertyPath = pathname.startsWith("/properties/") || pathname.startsWith("/featured-properties/");
  const property = isPropertyPath ? summaries.all.find((item) => pathname.endsWith(`/${item.slug}`)) : null;
  if (property) return {
    title: `${property.address} | ${property.price} | Golden Cross Realty`,
    description: `${property.title}. ${property.beds ? `${property.beds} beds, ` : ""}${property.baths ? `${property.baths} baths, ` : ""}${property.sqft ? `${property.sqft} sq ft. ` : ""}Request a private showing with Golden Cross Realty.`,
    image: `${SITE_URL}${property.image}`,
    property,
  };
  const community = pathname.startsWith("/communities/") ? COMMUNITIES.find((item) => `/communities/${item.slug}` === pathname) : null;
  if (community) return {
    title: `${community.name} TX Real Estate & Community Guide | Golden Cross Realty`,
    description: community.metaDescription,
    image: `${SITE_URL}${community.image}`,
    community,
  };
  return ROUTE_SEO[pathname] || { title: "Page Not Found | Golden Cross Realty", description: "The requested Golden Cross Realty page could not be found.", noindex: true };
}

export const canonicalFor = (pathname) => `${SITE_URL}${pathname === "/" ? "" : pathname.replace(/\/$/, "")}`;

export function buildSchemas(pathname, seo = resolveSeo(pathname)) {
  const canonical = canonicalFor(pathname);
  const schemas = [{
    "@context": "https://schema.org",
    "@type": ["RealEstateAgent", "LocalBusiness"],
    "@id": ORGANIZATION_ID,
    name: "Golden Cross Realty",
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/images/golden-cross-realty-logo.png` },
    image: `${SITE_URL}/images/golden-cross-realty-logo.png`,
    telephone: "+1-936-537-0568",
    email: CONTACT.email,
    priceRange: "$$",
    foundingDate: "2008",
    legalName: "Goldencross, LLC",
    address: { "@type": "PostalAddress", streetAddress: "3501 N Frazier St", addressLocality: "Conroe", addressRegion: "TX", postalCode: "77303", addressCountry: "US" },
    areaServed: ["Conroe", "Lake Conroe", "Willis", "Montgomery", "The Woodlands", "Montgomery County", "Harris County"],
  }, {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: "Golden Cross Realty",
    url: SITE_URL,
    publisher: { "@id": ORGANIZATION_ID },
    inLanguage: "en-US",
  }];

  if (seo.property) schemas.push({
    "@context": "https://schema.org", "@type": "RealEstateListing", name: seo.property.title, url: canonical,
    description: seo.description, image: `${SITE_URL}${seo.property.image}`,
    offers: { "@type": "Offer", price: seo.property.price.replace(/[^0-9]/g, ""), priceCurrency: "USD", availability: "https://schema.org/InStock" },
    address: { "@type": "PostalAddress", streetAddress: seo.property.address },
  });
  if (seo.community) schemas.push({
    "@context": "https://schema.org", "@type": "Place", name: `${seo.community.name}, Texas`, description: seo.community.intro, url: canonical,
  });
  if (seo.blogPost) schemas.push({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${canonical}#article`,
    url: canonical,
    headline: seo.blogPost.title,
    description: seo.description,
    image: {
      "@type": "ImageObject",
      url: new URL(seo.blogPost.image, SITE_URL).href,
      caption: seo.blogPost.imageAlt || seo.blogPost.title,
    },
    thumbnailUrl: new URL(seo.blogPost.image, SITE_URL).href,
    datePublished: seo.blogPost.publishedAt,
    dateModified: seo.blogPost.modifiedAt || seo.blogPost.publishedAt,
    articleSection: seo.blogPost.category,
    wordCount: seo.blogPost.wordCount,
    inLanguage: "en-US",
    author: { "@type": "Organization", "@id": ORGANIZATION_ID, name: seo.blogPost.author || "Golden Cross Realty", url: SITE_URL },
    reviewedBy: { "@type": "Person", "@id": `${BROKER_URL}#jonathan-currey`, name: "Jonathan Currey", url: BROKER_URL },
    publisher: { "@id": ORGANIZATION_ID },
    isPartOf: { "@id": WEBSITE_ID },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
  });
  if (pathname === "/faq") schemas.push({
    "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [
      { "@type": "Question", name: "How do I start buying a home in the Conroe area?", acceptedAnswer: { "@type": "Answer", text: "Start with your goals, preferred communities, budget, and financing plan. Golden Cross Realty can then help coordinate the search, tours, offers, inspections, and closing milestones." } },
      { "@type": "Question", name: "How does Golden Cross Realty help sellers?", acceptedAnswer: { "@type": "Answer", text: "The team prepares a local property evaluation and a tailored plan for pricing, preparation, marketing, showing coordination, offer review, negotiation, and closing." } },
      { "@type": "Question", name: "What areas does Golden Cross Realty serve?", acceptedAnswer: { "@type": "Answer", text: "Golden Cross Realty serves Conroe, Lake Conroe, Willis, Montgomery, The Woodlands, Montgomery County, Harris County, and surrounding Texas communities." } }
    ]
  });
  const pathParts = pathname.split("/").filter(Boolean);
  if (pathParts.length) {
    const crumbNames = pathParts.map((part, index) => {
      if (part === "blog") return "Blog";
      if (seo.blogPost && index === pathParts.length - 1) return seo.blogPost.title;
      return part.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    });
    schemas.push({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE_URL }, ...pathParts.map((part, index) => ({ "@type": "ListItem", position: index + 2, name: crumbNames[index], item: `${SITE_URL}/${pathParts.slice(0, index + 1).join("/")}` }))] });
  }
  return schemas;
}

export default function SEO() {
  const { pathname } = useLocation();

  useEffect(() => {
    captureAttribution();
    const seo = resolveSeo(pathname);
    const canonical = canonicalFor(pathname);
    document.title = seo.title;
    setMeta('meta[name="description"]', { name: "description", content: seo.description });
    setMeta('meta[name="robots"]', { name: "robots", content: seo.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" });
    setMeta('meta[property="og:title"]', { property: "og:title", content: seo.title });
    setMeta('meta[property="og:description"]', { property: "og:description", content: seo.description });
    setMeta('meta[property="og:type"]', { property: "og:type", content: seo.property ? "product" : seo.blogPost ? "article" : "website" });
    setMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
    setMeta('meta[property="og:image"]', { property: "og:image", content: seo.image || DEFAULT_IMAGE });
    setMeta('meta[property="og:image:alt"]', { property: "og:image:alt", content: seo.blogPost?.imageAlt || seo.title });
    setMeta('meta[property="og:locale"]', { property: "og:locale", content: "en_US" });
    setMeta('meta[property="og:site_name"]', { property: "og:site_name", content: "Golden Cross Realty" });
    setMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    setMeta('meta[name="twitter:title"]', { name: "twitter:title", content: seo.title });
    setMeta('meta[name="twitter:description"]', { name: "twitter:description", content: seo.description });
    setMeta('meta[name="twitter:image"]', { name: "twitter:image", content: seo.image || DEFAULT_IMAGE });
    setMeta('meta[name="twitter:image:alt"]', { name: "twitter:image:alt", content: seo.blogPost?.imageAlt || seo.title });
    const articleMeta = [
      ["article:published_time", seo.blogPost?.publishedAt],
      ["article:modified_time", seo.blogPost?.modifiedAt || seo.blogPost?.publishedAt],
      ["article:section", seo.blogPost?.category],
      ["article:author", seo.blogPost ? (seo.blogPost.author || "Golden Cross Realty") : null],
    ];
    articleMeta.forEach(([property, content]) => {
      const existing = document.head.querySelector(`meta[property="${property}"]`);
      if (content) setMeta(`meta[property="${property}"]`, { property, content });
      else existing?.remove();
    });

    let canonicalLink = document.head.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.rel = "canonical";
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonical;

    const schemas = buildSchemas(pathname, seo);

    let jsonLd = document.getElementById("gcr-structured-data");
    if (!jsonLd) {
      jsonLd = document.createElement("script");
      jsonLd.id = "gcr-structured-data";
      jsonLd.type = "application/ld+json";
      document.head.appendChild(jsonLd);
    }
    jsonLd.textContent = JSON.stringify(schemas);
    trackEvent("page_view", { page_path: pathname, page_title: seo.title });
  }, [pathname]);

  return null;
}


