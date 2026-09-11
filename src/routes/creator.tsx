import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/creator')({beforeLoad:()=>{throw redirect({to:'/profile'});}});
