import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/vloggers/$id')({beforeLoad:()=>{throw redirect({to:'/people'});}});
