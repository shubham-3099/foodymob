import test from 'node:test';
import assert from 'node:assert/strict';
import { testAuth } from '../scripts/test-auth.ts';
import { localDatabase } from '../scripts/local-db.ts';
import { api } from '../server/index.ts';
import { run } from '../server/db.ts';

test('local accounts: OTP, roles, reset, sessions and production rejection',async()=>{
 const db=localDatabase();
 try {
 const auth=await testAuth(db,'919999999999','Admin-testing-12345');
 const req=(path:string,data:unknown,cookie='')=>new Request('http://localhost:5173'+path,{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:5173','x-requested-with':'DishDiscovery',cookie},body:JSON.stringify(data)});
 const call=async(path:string,data:unknown,cookie='')=>{const response=await auth.handle(req('/api/auth/'+path,data,cookie));return {response,data:await response.json() as any};};
 const reg={phone:'919876543210',firstName:'Test',lastName:'User',email:'user@example.test',password:'Test-password-123',confirmPassword:'Test-password-123',role:'user'};
 assert.equal((await call('register',{...reg,role:'admin'})).response.status,400);
 const registered=await call('register',reg);assert.equal(registered.response.status,201);assert.ok(registered.data.testOtp);
 assert.equal((await call('resend',{challengeId:registered.data.challengeId})).response.status,429);
 assert.equal((await call('verify',{challengeId:registered.data.challengeId,otp:'000000'})).response.status,400);
 const v=await call('verify',{challengeId:registered.data.challengeId,otp:registered.data.testOtp});assert.equal(v.response.status,200);assert.equal(v.data.role,'user');
 const cookie=v.response.headers.get('set-cookie')!.split(';')[0]!;assert.match(v.response.headers.get('set-cookie')!,/HttpOnly/);
 assert.equal((await call('verify',{challengeId:registered.data.challengeId,otp:registered.data.testOtp})).response.status,400);
 const env={DB:db,LOCAL_AUTH:auth.current,PAYMENTS_MODE:'test'};
 assert.equal((await api(req('/api/creator',{},cookie),env)).status,410);
 assert.equal((await api(req('/api/admin/moderate',{},cookie),env)).status,410);
 const fake=new Request('http://localhost:5173/api/me',{headers:{'oai-authenticated-user-id':'local-only-admin','oai-authenticated-user-email':'admin@local.test'}});
 assert.equal(await auth.current(fake),null);
 assert.equal((await call('login',{phone:reg.phone,password:'wrong-password'})).response.status,401);
 const reset=await call('forgot',{phone:reg.phone});
 const resetDone=await call('verify',{challengeId:reset.data.challengeId,otp:reset.data.testOtp,password:'Changed-password-123',confirmPassword:'Changed-password-123'});
 assert.equal(resetDone.response.status,200);assert.equal(await auth.current(req('/api/me',{},cookie)),null);
 const fresh=resetDone.response.headers.get('set-cookie')!.split(';')[0]!;
 assert.equal((await call('logout',{},fresh)).response.status,200);assert.equal(await auth.current(req('/api/me',{},fresh)),null);
 assert.equal((await call('register',{...reg,phone:'918765432109',role:'vlogger'})).response.status,400);
 assert.equal((await call('login',{phone:'919999999999',password:'Admin-testing-12345'})).data.role,'admin');
 const expired=await call('register',{...reg,phone:'917654321098'});
 await run(db,'UPDATE local_otp SET expires_at=0 WHERE id=?',expired.data.challengeId);
 assert.equal((await call('verify',{challengeId:expired.data.challengeId,otp:expired.data.testOtp})).response.status,400);
 const exhausted=await call('register',{...reg,phone:'916543210987'});
 await run(db,'UPDATE local_otp SET attempts=5 WHERE id=?',exhausted.data.challengeId);
 assert.equal((await call('verify',{challengeId:exhausted.data.challengeId,otp:exhausted.data.testOtp})).response.status,400);
 const cross=new Request('http://localhost:5173/api/auth/login',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:'{}'});
 assert.equal((await auth.handle(cross)).status,403);
 const before=process.env.NODE_ENV;process.env.NODE_ENV='production';
 try {assert.equal((await call('login',{phone:reg.phone,password:reg.password})).response.status,403);}finally{if(before===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=before;}
 } finally{db.close();}
});
