import {useEffect,useState} from 'react';
import VisitorAccount from '../components/conversion/VisitorAccount';
import {watchAccount} from '../lib/visitorAccount';
import '../components/conversion/property-search.css';
export default function Account(){const [user,setUser]=useState(null);useEffect(()=>watchAccount(setUser),[]);return <section className="property-search" style={{maxWidth:1000,margin:'0 auto',padding:'40px 20px'}}><h1>Your home search profile</h1><VisitorAccount user={user} onRefresh={setUser} page/></section>;}
