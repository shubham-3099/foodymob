import {createFileRoute} from '@tanstack/react-router';
export const Route=createFileRoute('/dishes/$id/')({head:()=>({meta:[{title:'DishSpot — Community food reviews'}]}),component:()=>null});
