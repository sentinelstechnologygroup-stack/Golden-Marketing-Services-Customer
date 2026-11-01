// Sign-in action codes remain only in memory and are removed before analytics mounts.
let incoming='';
if(typeof window!=='undefined'&&window.location.pathname==='/account'&&new URLSearchParams(window.location.search).has('oobCode')){incoming=window.location.href;window.history.replaceState({},'','/account');}
export const accountLink=()=>incoming||(typeof window!=='undefined'?window.location.href:'');
export const clearAccountLink=()=>{incoming='';};
