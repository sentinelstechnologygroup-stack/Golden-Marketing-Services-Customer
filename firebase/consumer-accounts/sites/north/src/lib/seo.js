export const SITE_ORIGIN = 'https://www.homesaroundnorthhouston.com';
export const pages = {
  '/account': {title:'Your account | Homes Around North Houston',description:'Securely manage your profile, saved searches and communication preferences.',noindex:true},
  '/': { title: 'North Houston Homes for Sale | Golden Cross Realty', description: 'Search North Houston homes, plan your home sale, and explore investment properties with Golden Cross Realty. Serving Conroe, The Woodlands, Spring and nearby communities.' },
  '/buy': { title: 'Buy a Home in North Houston | Golden Cross Realty', description: 'Explore homes for sale in North Houston and discuss your preferred area, purchase budget and timeline with Golden Cross Realty.' },
  '/sell': { title: 'Sell Your North Houston Home | Home Value Analysis', description: 'Request a comparative market analysis and discuss pricing, preparation and your selling timeline with Golden Cross Realty.' },
  '/investment-properties': { title: 'North Houston Investment Properties | Golden Cross Realty', description: 'Explore North Houston investment properties and discuss purchase priorities, property condition and due diligence with Golden Cross Realty.' },
  '/homes': { title: 'Search North Houston Homes for Sale | Golden Cross Realty', description: 'Search available North Houston homes by city, neighborhood, budget, beds, baths and lot size. Explore the map, save homes and request a showing.' },
  '/market-reports': { title: 'North Houston Real Estate Market Reports', description: 'Explore published Houston housing reports and request a neighborhood or property analysis from Golden Cross Realty.' },
  '/verify': { title: 'Confirm Your Inquiry | Homes Around North Houston', description: 'Confirm your contact details for the real estate inquiry you requested.', noindex: true },
  '/privacy': { title: 'Privacy Policy | Homes Around North Houston', description: 'How Homes Around North Houston handles inquiries and third-party property search services.' },
  '/terms': { title: 'Terms & Disclosures | Homes Around North Houston', description: 'Brokerage, technology, property information and fair housing disclosures for Homes Around North Houston.' },
};
export function pageMetadata(path) {
  if (/^\/property\/147\/[A-Za-z0-9-]{1,50}$/.test(path)) return { title: 'Property Details | Homes Around North Houston', description: 'Explore this home and request assistance from the Golden Cross Realty office team.', noindex: true };
  return pages[path] || { title: 'Page Not Found | Homes Around North Houston', description: 'This page could not be found. Explore North Houston homes and real estate guidance.', noindex: true };
}
export const structuredData = JSON.stringify({ '@context': 'https://schema.org', '@graph': [
  { '@type': 'WebSite', '@id': `${SITE_ORIGIN}/#website`, name: 'Homes Around North Houston', url: `${SITE_ORIGIN}/`, publisher: { '@id': `${SITE_ORIGIN}/#brokerage` } },
  { '@type': 'RealEstateAgent', '@id': `${SITE_ORIGIN}/#brokerage`, name: 'Golden Cross Realty', url: 'https://goldencrossrealty.net/', telephone: '+19365370568', areaServed: 'North Houston, Texas' },
] });

