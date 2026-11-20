import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {today} from './lib/accounting';
import type {PaymentEntry} from './lib/payment-ledger';

export function useKolkataDay(onDayChange: () => void) {
 const [day, setDay] = useState(today);
 const knownDay = useRef(day);
 const refresh = useRef(onDayChange);
 refresh.current = onDayChange;
 useEffect(() => {
  let timer: ReturnType<typeof setTimeout>;
  const update = () => {
   clearTimeout(timer);
   const date = today();
   if (date !== knownDay.current) {
    knownDay.current = date;
    setDay(date);
    refresh.current();
   }
   // A Kolkata day ends at 18:30 UTC on that same ISO date.
   const midnight = Date.parse(date + 'T18:30:00Z');
   timer = setTimeout(update, Math.max(1, midnight - Date.now() + 5));
  };
  const onVisibility = () => {
   if (document.visibilityState === 'visible') update();
  };
  update();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', update);
  window.addEventListener('pageshow', update);
  return () => {
   clearTimeout(timer);
   document.removeEventListener('visibilitychange', onVisibility);
   window.removeEventListener('focus', update);
   window.removeEventListener('pageshow', update);
  };
 }, []);
 return day;
}

export function usePaymentArrivals(entries: PaymentEntry[], day: string, onOverview: boolean, admin: boolean) {
 const seen = useRef(new Set<string>());
 const previous = useRef<{day: string; onOverview: boolean; admin: boolean}>();
 const [arrivals, setArrivals] = useState<PaymentEntry[]>([]);

 useLayoutEffect(() => {
  const last = previous.current;
  const canAnnounce = last?.day === day && last.onOverview && onOverview && last.admin === admin;
  const fresh: PaymentEntry[] = [];
  const current = new Map<string, PaymentEntry>();
  for (const entry of entries) {
   const {id, date} = entry.payment;
   if (canAnnounce && date === day && !seen.current.has(id)) fresh.push(entry);
   current.set(id, entry);
   seen.current.add(id);
  }
  previous.current = {day, onOverview, admin};
  if (fresh.length) setArrivals(fresh);
  else setArrivals(arrivals => arrivals.some(({payment}) => {
   const latest = current.get(payment.id)?.payment;
   return !canAnnounce || latest?.date !== payment.date || latest.amount !== payment.amount;
  }) ? [] : arrivals);
 }, [entries, day, onOverview, admin]);

 return arrivals;
}
