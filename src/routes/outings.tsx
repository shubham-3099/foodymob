import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/outings')({beforeLoad:()=>{throw redirect({to:'/explore'});}});
