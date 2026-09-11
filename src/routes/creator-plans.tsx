import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/creator-plans')({beforeLoad:()=>{throw redirect({to:'/plans'});}});
