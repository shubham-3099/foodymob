import {one,now,type Database} from '../server/db.ts';
import {IMG} from '../src/data/seed.ts';
export async function seedCommunitySamples(db:Database){
 if(await one(db,"SELECT key FROM settings WHERE key='sample_community_v1'"))return;
 const time=now(),statements=[];
 const people=[['sample-anna','Anna Smith'],['sample-ajay','Ajay Khanna'],['sample-meera','Meera Sharma']];
 for(const [id,name] of people)statements.push(db.prepare("INSERT OR IGNORE INTO users(id,email,name,bio,role,location,created_at) VALUES(?,'',?,'Sample profile · Food explorer','user','',?)").bind(id,name,time));
 const restaurants=[['sample-market','Market Kitchen (Sample)','Sector 17, Chandigarh',30.7398,76.7827],['sample-cafe','Garden Cafe (Sample)','Ambala Cantt, Haryana',30.3382,76.8434],['sample-street','Street Bowl (Sample)','Sector 29, Gurugram',28.468,77.063]] as const;
 for(const [id,name,address,lat,lng] of restaurants)statements.push(db.prepare("INSERT OR IGNORE INTO community_restaurants(id,identity_key,name,address,lat,lng,status,requested_by,created_at,note) VALUES(?,?,?,?,?,?,'approved',NULL,?,'Illustrative testing data, not a real recommendation')").bind(id,id,name,address,lat,lng,time));
 const dishes=[['momos','Veg Momos','Noodles',160,IMG.momos,0],['burger','Veg Burger','Burgers',180,IMG.burger,0],['pizza','Margherita Pizza','Pizza',280,IMG.pizza,1],['icecream','Ice Cream Sundae','Ice cream',120,IMG.iceCream,1],['noodles','Chilli Garlic Noodles','Noodles',190,IMG.noodles,2],['poke','Garden Poke Bowl','Healthy',220,IMG.poke,1],['biryani','Vegetable Biryani','Indian',240,IMG.biryani,2],['tacos','Crispy Tacos','Mexican',200,IMG.tacos,0]] as const;
 for(const [index,d] of dishes.entries()){
 const [slug,name,category,price,photo,restaurant]=d;
 for(let n=0;n<2;n++)statements.push(db.prepare("INSERT OR IGNORE INTO community_reviews(id,restaurant_id,user_id,dish_name,dish_key,price,category,experience,recommendation,vlog_url,images,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,'',?,'published',?,?)").bind('sample-'+slug+'-'+n,restaurants[restaurant][0],people[(index+n)%people.length]![0],name,name.toLowerCase(),price,category,'Sample review for testing: '+(n?'A satisfying portion and good flavour.':'Freshly served, with a crisp texture and balanced seasoning.'),n&&index%2?2:3,JSON.stringify([photo]),time-index*1000-n,time));
 }
 statements.push(db.prepare("INSERT INTO settings(key,value) VALUES('sample_community_v1','true')"));await db.batch(statements);
}
