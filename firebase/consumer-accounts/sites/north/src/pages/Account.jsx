import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import {useEffect,useState} from 'react';
import ConsumerHub from '../components/conversion/ConsumerHub';
import {watchAccount} from '../lib/visitorAccount';
import '../components/conversion/property-search.css';
export default function Account(){const [user,setUser]=useState(null);useEffect(()=>watchAccount(setUser),[]);return <><Navbar/><main id="main-content" className="property-search" style={{maxWidth:1480,margin:'0 auto',padding:'150px 20px 40px'}}><ConsumerHub user={user} onUser={setUser} site="north"/></main><Footer/></>;}
