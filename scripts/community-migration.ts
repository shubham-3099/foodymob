import {all,one,run,now,type Database} from '../server/db.ts';
import {normalized} from '../server/community.ts';
// Idempotent data migration, separate from immutable schema migrations.
export async function migrateCommunity(db:Database) {
 if(await one(db,"SELECT key FROM settings WHERE key='community_migrated_v4'"))return;
 const statements=[db.prepare("UPDATE users SET role='user' WHERE role='vlogger'")];
 const creators=await all<any>(db,'SELECT * FROM creators');
 const creatorUsers=new Map<string,string>();
 for(const c of creators) {
  const d=JSON.parse(c.data),id=c.owner_id || 'historical-person-'+c.id;creatorUsers.set(c.id,id);
  if(!c.owner_id)statements.push(db.prepare("INSERT OR IGNORE INTO users(id,email,name,bio,role,location,created_at) VALUES(?,'',?,?,'user','',?)").bind(id,d.name||'Historical reviewer',d.bio||'',c.created_at));
 }
 const allReviews=await all<any>(db,'SELECT * FROM reviews'),restaurants=new Map<string,string>(),firstReview=new Map<string,string>();
 for(const row of await all<any>(db,'SELECT * FROM dishes')) {
  const d=JSON.parse(row.data),embedded=d.reviews||[],own=allReviews.filter(r=>r.dish_id===row.id);
  if(!embedded.length&&!own.length)continue; // No unreviewed restaurant directory.
  const key=normalized(d.restaurant)+'|'+normalized(d.address||d.city||'Address not recorded');
  let rid=restaurants.get(key);
  if(!rid){rid='historical-restaurant-'+row.id;restaurants.set(key,rid);statements.push(db.prepare('INSERT OR IGNORE INTO community_restaurants(id,identity_key,name,address,lat,lng,status,requested_by,created_at,note) VALUES(?,?,?,?,NULL,NULL,?,NULL,?,?)').bind(rid,key,d.restaurant,d.address||d.city||'Address not recorded',row.status==='approved'?'approved':'pending',row.created_at,'Imported from v3; coordinates need confirmation.'));}
  for(const [i,r] of [...embedded,...own].entries()) {
   const id='historical-review-'+row.id+'-'+(r.id||i),author=r.user_id||creatorUsers.get(r.vloggerId)||'historical-person-'+row.id+'-'+i;
   if(!r.user_id&&!creatorUsers.has(r.vloggerId))statements.push(db.prepare("INSERT OR IGNORE INTO users(id,email,name,bio,role,location,created_at) VALUES(?,'',?,'Historical review author','user','',?)").bind(author,r.author||'Historical reviewer',row.created_at));
   const rec=r.recommendation==='MUST TRY'?3:r.recommendation==='Should Try'?2:1;
   const status=r.status==='rejected'?'rejected':row.status==='approved' && (!r.status||r.status==='published')?'published':'pending';
   statements.push(db.prepare('INSERT OR IGNORE INTO community_reviews(id,restaurant_id,user_id,dish_name,dish_key,price,category,experience,recommendation,vlog_url,images,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,rid,author,d.name,normalized(d.name),Number(d.price)||0,d.category||'Other',r.text||'Historical review',rec,'',JSON.stringify(d.image?[d.image]:[]),status,r.created_at||row.created_at,r.created_at||row.created_at));
   if(!firstReview.has(row.id))firstReview.set(row.id,id);
  }
 }
 for(const f of await all<any>(db,'SELECT * FROM follows')) {
  const target=creatorUsers.get(f.creator_id);if(target && f.user_id!==target)statements.push(db.prepare('INSERT OR IGNORE INTO community_follows(user_id,target_id) VALUES(?,?)').bind(f.user_id,target));
 }
 for(const s of await all<any>(db,'SELECT * FROM saved')) {const id=firstReview.get(s.dish_id);if(id)statements.push(db.prepare('INSERT OR IGNORE INTO community_saves(user_id,review_id) VALUES(?,?)').bind(s.user_id,id));}
 statements.push(db.prepare("UPDATE entitlements SET kind='member' WHERE kind='creator'"));
 statements.push(db.prepare("INSERT INTO settings(key,value) VALUES('community_migrated_v4','true')"));
 await db.batch(statements);
}
