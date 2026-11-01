import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Heart} from 'lucide-react';
import {watchAccount,watchSaves,updateSaves} from '../../lib/visitorAccount';
export default function FavoriteButton({listingId,address}){
 const navigate=useNavigate(),[user,setUser]=useState(null),[homes,setHomes]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>watchAccount(setUser),[]);
 useEffect(()=>{setHomes([]);return watchSaves(user,d=>setHomes(d.homes));},[user]);
 const saved=homes.includes(listingId);
 async function toggle(){if(!user?.emailVerified){navigate('/account');return;}setBusy(true);setError('');try{await updateSaves({homes:saved?homes.filter(id=>id!==listingId):[listingId,...homes].slice(0,50)});}catch{setError('Favorite could not be saved. Please try again.');}finally{setBusy(false);}}
 return <div className="absolute right-3 top-3 z-30"><button type="button" disabled={busy} aria-pressed={saved} aria-label={(saved?'Remove favorite: ':'Add favorite: ')+address} onClick={toggle} className="grid h-11 w-11 place-items-center rounded-full bg-white text-primary shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"><Heart size={21} fill={saved?'currentColor':'none'} aria-hidden="true"/></button>{error&&<span role="alert" className="block max-w-48 bg-white p-2 text-xs text-red-800">{error}</span>}</div>;
}
