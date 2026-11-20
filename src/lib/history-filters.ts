import {format} from 'date-fns';
import type {DateBounds} from './accounting';

export const paymentMethods=['UPI','Cash','Bank Transfer','Cheque','Other'] as const;

export function historyLink(filters:Record<string,string>={}){
 const query=new URLSearchParams(filters).toString();
 return '/expenses'+(query?'?'+query:'');
}

export function paymentHistoryLink(bounds?:DateBounds,category?:string){
 return historyLink({payments:'completed',...(bounds?{from:bounds.from,to:bounds.to}:{}),...(category?{category}:{})});
}

export function displayDate(date:string,pattern='d MMM yyyy'){
 return format(new Date(date+'T12:00:00'),pattern);
}

export function displayBounds({from,to}:DateBounds){
 if(from===to)return displayDate(from);
 return `${displayDate(from,from.slice(0,4)===to.slice(0,4)?'d MMM':'d MMM yyyy')} – ${displayDate(to)}`;
}
