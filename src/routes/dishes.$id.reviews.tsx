import {createFileRoute} from '@tanstack/react-router';
export const Route=createFileRoute('/dishes/$id/reviews')({head:()=>({meta:[{title:'FoodyMob — Community food reviews'}]}),component:()=>null});
