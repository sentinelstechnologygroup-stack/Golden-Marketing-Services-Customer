import {syncInquiry} from './visitorAccount';
export function campaignDefaults(params) {
  const presets = {
    'hanh-new-homes-400k': { minPrice:'400000', newConstruction:'true', location:'Montgomery County' },
    'hanh-new-construction': { newConstruction:'true', location:'Montgomery County' },
    'conroe-under-400k': { city: 'Conroe', maxPrice: '400000' },
    'woodlands-relocation': { city: 'The Woodlands' },
  };
  const preset = presets[params.get('campaign')] || {};
  const search = { city: params.get('city') || (!/^\d{5}$/.test(params.get('location') || '') ? params.get('location') : '') || preset.city || '', zip: params.get('zip') || (/^\d{5}$/.test(params.get('location') || '') ? params.get('location') : ''),
    neighborhood: params.get('neighborhood') || '', minPrice: params.get('minPrice') || preset.minPrice || '', maxPrice: params.get('maxPrice') || preset.maxPrice || '' };
  return { ...Object.fromEntries(['location','beds','baths','propertyType','bounds','polygon','availability','minSqft','waterfront','newConstruction','priceReduced','newListings','boardId','mlsNumber','propertyAddress','inquiryContext'].map(key=>[key,params.get(key)||preset[key]||''])), ...search, area: search.city, budgetRange: search.maxPrice ? `Up to $${Number(search.maxPrice).toLocaleString('en-US')}` : '' };
}
export function resultsUrl(form, current = '') {
  const query = new URLSearchParams(current);
  for(const key of ['inquiryContext','boardId','mlsNumber','propertyAddress','cta']) query.delete(key);
  for (const key of ['city','zip','neighborhood','minPrice','maxPrice','location','beds','baths','propertyType','bounds','polygon','availability','minSqft','waterfront','newConstruction','priceReduced','newListings']) if (form[key]) query.set(key, form[key]);
  query.set('inquiry', 'received');
  return `/homes?${query}`;
}
export async function sendFunnelAction(session, action, funnelProfile = {}, funnelTelemetry = {}) {
  const response = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...session, funnelAction: action, funnelProfile, funnelTelemetry }), keepalive: action === 'hidden' || action === 'exit' });
  const result = await response.json();
  if (!response.ok || !result.accepted) throw new Error(result.error || 'Could not save your preferences. Please try again.');
  if(action==='complete')void syncInquiry(result.reference).catch(()=>{});
  return result;
}

export function intakeUrl(values = {}, cta = '') {
  const query = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  for (const [key, value] of Object.entries(values)) {
    if (value) query.set(key, String(value)); else query.delete(key);
  }
  if (cta) { query.set('cta', cta); funnelEvent('cta_clicked', {cta}); }
  return `/?${query}#contact`;
}
// Integration point for approved analytics tags. Never include contact details.
export function funnelEvent(name, detail = {}) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('gms:funnel', {detail: {name, ...detail}}));
}

export function searchInquiryUrl(filters = {}, property = null, current = '') {
  const query = new URLSearchParams(current);
  if(filters.location) for(const key of ['city','zip','neighborhood']) query.delete(key);
  for (const [key,value] of Object.entries(filters)) if (value) query.set(key,String(value));
  query.set('inquiryContext','search');
  if(property){ query.set('boardId',property.boardId);query.set('mlsNumber',property.mlsNumber);query.set('propertyAddress',property.address); }
  return `${property ? `/property/${property.boardId}/${property.mlsNumber}` : '/homes'}?${query}#contact`;
}
