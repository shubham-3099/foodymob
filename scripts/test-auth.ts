// Local testing adapter only. Never imported by the production Worker.
import { randomBytes, randomInt, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { one, run, now, uid, type Database } from '../server/db.ts';
import type { User } from '../server/auth.ts';
import { assert, body, json, sameOrigin, errorResponse, str } from '../server/http.ts';

const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const passwordHash = (p: string) => {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(p, salt, 64).toString('hex');
};
function matches(p: string, hash: string) {
  const [salt, key] = hash.split(':');
  return !!salt && !!key && timingSafeEqual(scryptSync(p, salt, 64), Buffer.from(key, 'hex'));
}
function phone(value: unknown) {
  const p = str(value, 10, 20).replace(/[\s()-]/g, '');
  assert(/^\+?[0-9]{10,15}$/.test(p), 400, 'Enter 10–15 digits including your country code.');
  return p.replace(/^\+/, '');
}
function password(value: unknown) {
  assert(typeof value === 'string' && value.length >= 10 && value.length <= 128, 400, 'Password must be 10–128 characters.');
  return value;
}
type Account = { user_id: string; phone: string; password_hash: string; verified: number };
type Challenge = { id: string; user_id: string; purpose: string; code_hash: string; expires_at: number; attempts: number; sent_at: number };
export async function testAuth(db: Database, adminPhone: string, adminPassword: string) {
  assert(process.env["NODE_ENV"] !== 'production', 503, 'Test authentication is disabled in production.');
  // The fixed ID and configuration are the sole admin authority, never request data.
  const admin = 'local-only-admin';
  const p = phone(adminPhone), hash = passwordHash(password(adminPassword));
  const conflict = await one<Account>(db, 'SELECT * FROM local_accounts WHERE phone=?', p);
  assert(!conflict || conflict.user_id === admin, 409, 'Admin phone is already a registered user. Choose another phone.');
  await db.batch([
    db.prepare("UPDATE users SET role='user' WHERE role='admin' AND id<>?").bind(admin),
    db.prepare("INSERT INTO users(id,email,name,bio,role,location,created_at) VALUES(?,'admin@local.test','Administrator','','admin','Ambala',?) ON CONFLICT(id) DO UPDATE SET role='admin'").bind(admin, now()),
    db.prepare('INSERT INTO local_accounts(user_id,phone,password_hash,verified) VALUES(?,?,?,1) ON CONFLICT(user_id) DO UPDATE SET phone=excluded.phone,password_hash=excluded.password_hash,verified=1').bind(admin,p,hash),
    db.prepare('DELETE FROM local_sessions WHERE user_id=?').bind(admin),
  ]);
  const cookie = (token: string, age: number) => `dish_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}`;
  function guard(req: Request) {
    assert(process.env["NODE_ENV"] !== 'production' && ['localhost','127.0.0.1','[::1]'].includes(new URL(req.url).hostname),403,'Test accounts are localhost-only.');
  }
  const sessionToken = (req: Request) => req.headers.get('cookie')?.match(/(?:^|;\s*)dish_session=([^;]+)/)?.[1] ?? '';
  async function current(req: Request): Promise<User | null> {
    guard(req);
    const token = sessionToken(req);
    if (!token) return null;
    const user = await one<User>(db, 'SELECT u.* FROM users u JOIN local_sessions s ON s.user_id=u.id JOIN local_accounts a ON a.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND a.verified=1',digest(token),now());
    if (user?.role === 'admin' && user.id !== admin) return null;
    return user;
  }
  async function limit(key: string, max: number) {
    const bucket = Math.floor(now()/60000);
    const row = await db.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind('auth:'+key+':'+bucket,now()+120000).first<{count:number}>();
    assert(row && row.count<=max,429,'Too many attempts. Try again in a minute.');
  }
  async function issue(userId: string, purpose: string) {
    const old = await one<Challenge>(db,'SELECT * FROM local_otp WHERE user_id=? AND purpose=?',userId,purpose);
    assert(!old || now()-old.sent_at>=60000,429,'Wait 60 seconds before requesting another OTP.');
    const id=uid(), code=String(randomInt(100000,1000000));
    await run(db,'INSERT INTO local_otp(id,user_id,purpose,code_hash,expires_at,attempts,sent_at) VALUES(?,?,?,?,?,0,?) ON CONFLICT(user_id,purpose) DO UPDATE SET id=excluded.id,code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,sent_at=excluded.sent_at',id,userId,purpose,digest(id+code),now()+300000,now());
    return {challengeId:id,testOtp:code,expiresIn:300,resendAfter:60,purpose};
  }
  async function session(userId:string) {
    const token=randomBytes(32).toString('hex');
    await run(db,'INSERT INTO local_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',digest(token),userId,now()+86400000);
    const user=await one<User>(db,'SELECT * FROM users WHERE id=?',userId);
    const response=json({ok:true,role:user?.role,redirect:user?.role==='admin'?'/admin':'/explore'});
    response.headers.set('Set-Cookie',cookie(token,86400));
    return response;
  }
  async function handle(req:Request) {
    try {
      guard(req); sameOrigin(req);
      assert(req.method==='POST',405,'Use POST.');
      const d=await body(req), path=new URL(req.url).pathname;
      await limit('global',100);
      if(path==='/api/auth/register') {
        const ph=phone(d["phone"]); await limit(ph,6);
        assert(d["role"]===undefined||d["role"]==='user',400,'Only normal user registration is available.');
        const first=str(d["firstName"],1,50),last=str(d["lastName"],1,50),email=str(d["email"],3,200).toLowerCase(),pw=password(d["password"]);
        assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),400,'Enter a valid email.');
        assert(pw===d["confirmPassword"],400,'Passwords do not match.');
        assert(!await one(db,'SELECT user_id FROM local_accounts WHERE phone=?',ph),409,'Phone already registered. Log in or reset your password.');
        const id=uid();
        await db.batch([
          db.prepare("INSERT INTO users(id,email,name,bio,role,location,created_at) VALUES(?,?,?,'','user','Ambala',?)").bind(id,email,first+' '+last,now()),
          db.prepare('INSERT INTO local_accounts(user_id,phone,password_hash,verified) VALUES(?,?,?,0)').bind(id,ph,passwordHash(pw)),
        ]);
        return json(await issue(id,'verify'),201);
      }
      if(path==='/api/auth/login') {
        const ph=phone(d["phone"]); await limit(ph,6);
        const a=await one<Account>(db,'SELECT * FROM local_accounts WHERE phone=?',ph);
        const pw=password(d["password"]);
        assert(a && matches(pw,a.password_hash),401,'Invalid phone or password.');
        if(!a.verified) return json(await issue(a.user_id,'verify'));
        return session(a.user_id);
      }
      if(path==='/api/auth/forgot') {
        const ph=phone(d["phone"]); await limit(ph,5);
        const a=await one<Account>(db,'SELECT * FROM local_accounts WHERE phone=?',ph);
        assert(a && a.user_id!==admin,400,'Use a registered non-admin phone. Admin credentials are reset in backend configuration.');
        return json(await issue(a.user_id,'reset'));
      }
      if(path==='/api/auth/resend') {
        const c=await one<Challenge>(db,'SELECT * FROM local_otp WHERE id=?',str(d["challengeId"]));
        assert(c,400,'Start verification again.'); await limit(c.user_id,5);
        return json(await issue(c.user_id,c.purpose));
      }
      if(path==='/api/auth/verify') {
        const c=await one<Challenge>(db,'SELECT * FROM local_otp WHERE id=?',str(d["challengeId"]));
        assert(c && c.expires_at>now() && c.attempts<5,400,'OTP expired or attempt limit reached. Request another OTP.');
        const claim=await run(db,'UPDATE local_otp SET attempts=attempts+1 WHERE id=? AND attempts<5 AND expires_at>?',c.id,now());
        assert(claim.meta.changes===1,400,'OTP no longer valid.');
        assert(digest(c.id+str(d["otp"],6,6))===c.code_hash,400,'Incorrect OTP.');
        let newHash='';
        if(c.purpose==='reset') { const pw=password(d["password"]); assert(pw===d["confirmPassword"],400,'Passwords do not match.'); newHash=passwordHash(pw); }
        const consumed=await run(db,'DELETE FROM local_otp WHERE id=?',c.id);
        assert(consumed.meta.changes===1,400,'OTP already used.');
        if(c.purpose==='reset') await db.batch([
          db.prepare('UPDATE local_accounts SET password_hash=?,verified=1 WHERE user_id=?').bind(newHash,c.user_id),
          db.prepare('DELETE FROM local_sessions WHERE user_id=?').bind(c.user_id),
        ]);
        else await run(db,'UPDATE local_accounts SET verified=1 WHERE user_id=?',c.user_id);
        return session(c.user_id);
      }
      if(path==='/api/auth/logout') {
        await run(db,'DELETE FROM local_sessions WHERE token_hash=?',digest(sessionToken(req)));
        const res=json({ok:true});res.headers.set('Set-Cookie',cookie('',0));return res;
      }
      if(path==='/api/newsletter') {
        const email=str(d["email"],3,200).toLowerCase();
        assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && d["consent"]===true,400,'Enter your email and agree to subscribe.');
        await run(db,'INSERT OR IGNORE INTO local_newsletter(email,created_at) VALUES(?,?)',email,now());
        return json({ok:true,message:'Test subscription saved. No email will be sent.'});
      }
      return json({error:'Not found'},404);
    } catch(e) {return errorResponse(e);}
  }
  return {current,handle};
}
