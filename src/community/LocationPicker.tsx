import {useEffect,useRef,useState} from 'react';
import {request} from '@/lib/api';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import type {Place} from './types';
export function LocationPicker({value,onChange,restaurant=false}:{value:Place|null;onChange:(p:Place)=>void;restaurant?:boolean}) {
 const [query,setQuery]=useState(value?.label||''),[places,setPlaces]=useState<Place[]>([]),[busy,setBusy]=useState(false),[gps,setGps]=useState(false),[error,setError]=useState('');
 const chosen=useRef(value?.label||'');
 useEffect(()=>{
  const q=query.trim();if(q.length<3||query===chosen.current){setPlaces([]);setBusy(false);return;}
  const controller=new AbortController();let active=true;setPlaces([]);setBusy(true);setError('');
  const timer=setTimeout(async()=>{try{const response=await fetch('/api/location/search',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'DishDiscovery'},body:JSON.stringify({q}),signal:controller.signal});const result=await response.json();if(!response.ok)throw new Error(result.error||'Location search is unavailable.');if(active){setPlaces(result.places);if(!result.places.length)setError('No places found. Try a nearby landmark or a more specific address.');}}catch(e){if(active)setError((e as Error).message);}finally{if(active)setBusy(false);}},1200);
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[query]);
 function choose(p:Place){chosen.current=p.label;setQuery(p.label);setPlaces([]);setError('');onChange(p);}
 function current(){setGps(true);setError('');if(!navigator.geolocation){setError('GPS is unavailable. Search for your area above.');setGps(false);return;}
 navigator.geolocation.getCurrentPosition(async pos=>{const p={label:'Current location',lat:pos.coords.latitude,lng:pos.coords.longitude};try{const r:any=await request('/api/location/reverse','POST',p);if(r.places?.[0])p.label=r.places[0].label;}catch{/* The GPS coordinates remain usable when address lookup is unavailable. */}setGps(false);choose(p);},()=>{setError('GPS is unavailable or permission was denied. Search for your area above.');setGps(false);},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});}
 return <div className="location-picker"><label>{restaurant?'Restaurant address':'Search location'}<Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Start typing an area, city or address" autoComplete="off" aria-controls="location-suggestions" onKeyDown={e=>{if(e.key==='Enter')e.preventDefault();}}/></label>
 {busy&&<p role="status" className="fineprint">Searching locations…</p>}
 {places.length>0&&<ul id="location-suggestions" className="place-results">{places.map((p,i)=><li key={i}><button type="button" onClick={()=>choose(p)}>{p.label}</button></li>)}</ul>}
 <div className="control-row"><Button type="button" variant="outline" disabled={gps} onClick={current}>{gps?'Locating…':'Use current location'}</Button></div>
 {error&&<p role="alert" className="notice-error">{error}</p>}
 <p className="fineprint">Suggestions use Photon and <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>. Your search text or GPS coordinates are sent for lookup.</p></div>;
}
