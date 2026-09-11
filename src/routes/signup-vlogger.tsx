import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/signup-vlogger')({beforeLoad:()=>{throw redirect({to:'/signup'});}});
