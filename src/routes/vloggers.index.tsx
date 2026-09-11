import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/vloggers/')({beforeLoad:()=>{throw redirect({to:'/people'});}});
