import {useState} from 'react';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {request} from '@/lib/api';
import {LocationPicker} from './LocationPicker';
import {photoUrl,type Place,type Restaurant} from './types';
export function ReviewForm({restaurants,onDone}:{restaurants:Restaurant[];onDone:()=>Promise<void>}) {
 const initialId=new URLSearchParams(location.search).get('restaurant')||'';
 const [selected,setSelected]=useState(initialId),[search,setSearch]=useState(''),[newRestaurant,setNewRestaurant]=useState(false),[place,setPlace]=useState<Place|null>(null),[images,setImages]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const restaurant=restaurants.find(r=>r.id===selected);
 async function upload(files:FileList|null){if(!files)return;setError('');setBusy(true);try{const added=[...images];for(const file of Array.from(files)){if(added.length>=5)throw new Error('Up to five photos per review.');const form=new FormData();form.set('file',file);const r=await fetch('/api/community/images',{method:'POST',headers:{'X-Requested-With':'DishDiscovery'},body:form});const d=await r.json();if(!r.ok)throw new Error(d.error||'Photo upload failed.');added.push(d.id);setImages([...added]);}}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');setMessage('');const form=e.currentTarget,d=Object.fromEntries(new FormData(form));try{if(!restaurant&&!newRestaurant)throw new Error('Select a restaurant or request a new one.');if(newRestaurant&&(!place||place.lat===null))throw new Error('Set the restaurant address and coordinates.');const r:any=await request('/api/community/reviews','POST',{...d,restaurantId:newRestaurant?undefined:selected,address:place?.label,lat:place?.lat,lng:place?.lng,price:Number(d['price']),recommendation:Number(d['recommendation']),images});setMessage(r.message);form.reset();setImages([]);setSelected('');setNewRestaurant(false);setPlace(null);await onDone();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section><h1>Share a dish</h1><p>Tell people what you ate, what you paid and whether it was worth trying.</p>
 <form className="community-form" onSubmit={submit}>
 <fieldset><legend>Where did you eat?</legend><label>Find a reviewed restaurant<Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Restaurant name or address"/></label><div className="restaurant-options">{restaurants.filter(r=>(r.name+' '+r.address).toLowerCase().includes(search.toLowerCase())).slice(0,10).map(r=><button type="button" className={selected===r.id&&!newRestaurant?'selected':''} key={r.id} onClick={()=>{setSelected(r.id);setNewRestaurant(false);}}><strong>{r.name}</strong><span>{r.address}</span></button>)}</div>
 {!restaurants.length&&<p>No restaurants yet. Be the first to review a dish.</p>}
 <Button variant="outline" type="button" onClick={()=>{setNewRestaurant(true);setSelected('');}}>Restaurant not listed? Add its first review</Button>
 {restaurant&&!newRestaurant&&<p className="success-note">{restaurant.name} · {restaurant.address}<br/>Your review will publish immediately.</p>}
 {newRestaurant&&<div className="new-restaurant"><label>Restaurant name<Input required name="restaurantName" defaultValue={search} maxLength={150}/></label><LocationPicker value={place} onChange={setPlace} restaurant/><p className="pending-note">The first review needs admin verification, usually 3–4 days. You can submit as many other new restaurants as you want while waiting.</p></div>}</fieldset>
 <div className="two-columns"><label>Dish name<Input required name="dishName" maxLength={100}/></label><label>Actual price paid (₹)<Input required name="price" type="number" min="0" max="1000000" step="0.01"/></label></div>
 <label>Cuisine or dish category<Input required name="category" placeholder="e.g. North Indian, momos, dessert" maxLength={60}/></label>
 <label>Your experience<Textarea required name="experience" minLength={10} maxLength={4000} rows={5} placeholder="Taste, portion, service—what should others know?"/></label>
 <label>Food-vlog link (optional)<Input name="vlogUrl" type="url" placeholder="https://…" maxLength={2000}/></label>
 <fieldset><legend>Your recommendation</legend><div className="recommendation-options">{['Avoid','Should try','Must try'].map((label,i)=><label key={label}><input required type="radio" name="recommendation" value={i+1}/>{label}</label>)}</div></fieldset>
 <label>Dish photos (up to 5, JPEG/PNG/WebP, max 3 MB each)<Input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={e=>void upload(e.target.files)}/></label>
 <div className="photo-previews">{images.map(id=><div key={id}><img src={photoUrl(id)} alt="Your uploaded dish"/><button type="button" onClick={()=>setImages(images.filter(x=>x!==id))}>Remove</button></div>)}</div>
 {error&&<p className="notice-error" role="alert">{error}</p>}{message&&<p className="success-note" role="status">{message} <a href="/profile">View your reviews</a></p>}
 <Button disabled={busy}>{busy?'Saving…':newRestaurant?'Submit first review for verification':'Publish review'}</Button></form></section>;
}
