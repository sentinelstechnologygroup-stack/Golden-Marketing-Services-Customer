const listing=require('./listing-email.cjs');
const escape=listing.escape;
async function load(site,property,{fetcher=fetch}={}){
 if(!property||property.boardId!=='147'||!/^[A-Za-z0-9-]{1,50}$/.test(property.mlsNumber||''))return null;
 const theme=listing.theme(site),query=new URLSearchParams({action:'detail',boardId:'147',mlsNumber:property.mlsNumber});
 try{
  const r=await fetcher(`${theme.apiOrigin}/api/idx?${query}`,{redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
  if(!r.ok)return null;const data=await r.json(),home=data.listings?.find(l=>String(l.boardId)==='147'&&String(l.mlsNumber)===property.mlsNumber);
  if(!home)return null;const card=listing.projectCard(home,theme);return card?{...card,mlsNumber:property.mlsNumber,brokerage:typeof home.brokerage==='string'?home.brokerage.slice(0,180):''}:null;
 }catch{return null;}
}
function render(site,property,card){
 if(!property)return '';
 const theme=listing.theme(site),url=listing.detailUrl(theme,property),image=card?.image&&/^https:\/\/cdn\.repliers\.io\/[A-Za-z0-9_./-]+$/.test(card.image)&&!card.image.includes('..')?card.image:null;
 return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border:1px solid #E4E0D8;background:#F8F7F4"><tr>${image?`<td width="150" style="padding:14px 0 14px 14px;vertical-align:top"><a href="${escape(url)}"><img src="${escape(image)}" width="150" alt="${escape(card.address)}" style="display:block;width:150px;max-width:100%;height:auto;border:0"></a></td>`:''}<td style="padding:16px;vertical-align:top"><p style="font:11px Arial,sans-serif;letter-spacing:1px;color:#80622e;margin:0 0 8px">PROPERTY YOU ASKED ABOUT</p><strong style="font:20px/1.35 Georgia,serif;color:#192D3D">${escape(card?.address||'Your requested property')}</strong>${card?.price?`<p style="font:bold 17px Arial,sans-serif;color:#192D3D;margin:9px 0">${escape(card.price)}</p>`:''}${card?.summary?`<p style="font:12px/1.6 Arial,sans-serif;color:#55616B;margin:8px 0">${escape(card.summary)}</p>`:''}<p style="font:12px Arial,sans-serif;margin:8px 0">MLS #${escape(property.mlsNumber)}</p><a href="${escape(url)}" style="font:bold 13px Arial,sans-serif;color:#192D3D">View property &rarr;</a></td></tr><tr><td colspan="${image?'2':'1'}" style="padding:0 14px 14px;font:10px/1.6 Arial,sans-serif;color:#65717A">${card?.brokerage?'Listed by '+escape(card.brokerage)+'. ':''}Source: Houston Association of REALTORS® (HAR). Information and availability may change; independently verify details.</td></tr></table>`;
}
module.exports={load,render};
