import { useState } from 'react';
import { request } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Mode = 'login' | 'user' | 'verify' | 'forgot';
export function AuthPage({mode}: {mode:Mode}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [challenge,setChallenge]=useState<any>(()=> {
    try {return JSON.parse(sessionStorage.getItem('otp-challenge') || 'null');} catch{return null;}
  });
  const [otp,setOtp]=useState('');
  const signup=mode==='user';
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setError('');
    const data=Object.fromEntries(new FormData(e.currentTarget));
    try {
      const path=signup?'register':mode==='verify'?'verify':mode==='forgot'?'forgot':'login';
      const result:any=await request('/api/auth/'+path,'POST',{...data,...(signup?{role:mode}:{}),...(mode==='verify'?{challengeId:challenge?.challengeId,otp}:{})});
      if(result.challengeId) {
        sessionStorage.setItem('otp-challenge',JSON.stringify(result));
        window.location.assign('/verify');
      } else {
        sessionStorage.removeItem('otp-challenge');
        window.location.assign(result.redirect || '/profile');
      }
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  async function resend() {
    setBusy(true);setError('');
    try {const c=await request('/api/auth/resend','POST',{challengeId:challenge?.challengeId});setChallenge(c);sessionStorage.setItem('otp-challenge',JSON.stringify(c));setOtp('');}
    catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  const field=(name:string,label:string,type='text',autoComplete?:string)=><label key={name} className="auth-label"><span>{label}</span><Input required name={name} placeholder={label} type={type} autoComplete={autoComplete} minLength={name.toLowerCase().includes('password')?10:undefined} maxLength={128}/></label>;
  return <main className="auth-page">
    <a className="auth-brand" href="/">DishSpot</a>
    <h1>{signup?<>Register<br/>As a User</>:mode==='verify'?'Verify':mode==='forgot'?'Reset password':'Welcome Back!'}</h1>
    <form onSubmit={submit} className="auth-form">
      {signup && <>{field('firstName','First name','text','given-name')}{field('lastName','Last name','text','family-name')}{field('email','Email','email','email')}</>}
      {mode!=='verify' && field('phone','Phone with country code','tel','tel')}
      {(signup||mode==='login'||(mode==='verify'&&challenge?.purpose==='reset')) && field('password',mode==='verify'?'New password':'Password','password',mode==='login'?'current-password':'new-password')}
      {(signup||(mode==='verify'&&challenge?.purpose==='reset')) && field('confirmPassword','Re-enter password','password','new-password')}
      {mode==='verify' && <><label className="auth-label"><span>OTP</span><Input required value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Enter your OTP" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"/></label>
        {challenge ? <aside className="test-code" role="status">Local testing only — OTP: <strong>{challenge.testOtp}</strong><br/>Expires after 5 minutes. Maximum 5 attempts. Resend available after 60 seconds. No SMS is sent.</aside>:<p>Start with <a href="/login">login</a> or <a href="/signup">registration</a> to request an OTP.</p>}
        <button type="button" className="auth-text-link" onClick={resend} disabled={busy||!challenge}>Resend OTP</button></>}
      {mode==='login' && <a className="auth-text-link" href="/forgot-password">Forgot your password?</a>}
      {error && <p className="notice-error" role="alert">{error}</p>}
      <Button disabled={busy||(mode==='verify'&&!challenge)} className="auth-submit">{busy?'Please wait…':signup?'Sign up':mode==='login'?'Log in':mode==='forgot'?'Send test OTP':'Submit'}</Button>
    </form>
    <p className="auth-switch">{mode==='login'?<>Don’t have an account? <a href="/signup">Sign up</a></>:<>Already have an account? <a href="/login">Log in</a></>}</p>
  </main>;
}
