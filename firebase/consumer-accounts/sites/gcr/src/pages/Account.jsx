import {useEffect,useState} from 'react';
import ConsumerHub from '../components/conversion/ConsumerHub';
import {watchAccount} from '../lib/visitorAccount';
import '../components/conversion/property-search.css';
export default function Account(){const [user,setUser]=useState(null);useEffect(()=>watchAccount(setUser),[]);return <section className="property-search" style={{maxWidth:1480,margin:'0 auto',padding:'40px 20px'}}><ConsumerHub user={user} onUser={setUser} site="brokerage"/></section>;}
