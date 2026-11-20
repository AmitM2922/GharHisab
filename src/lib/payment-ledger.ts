import type {Expense} from '../data';
import type {Payment} from '../types';
import {roundMoney} from './accounting';

export type PaymentEntry = {payment: Payment; expense: Expense};

export function paymentsForExpenses(payments: Payment[], expenses: Expense[]): PaymentEntry[] {
 const invoices = new Map(expenses.map(expense => [expense.id, expense]));
 // The ledger creates a positive payment row only after money has been paid.
 // An invoice can have a completed instalment and still have a balance due.
 return payments.flatMap(payment => {
  const expense = invoices.get(payment.expense_id);
  return expense && payment.amount > 0 ? [{payment, expense}] : [];
 });
}

export function latestPayment(a: PaymentEntry, b: PaymentEntry): number {
 return b.payment.date.localeCompare(a.payment.date)
  || (Date.parse(b.payment.created_at??'')||0)-(Date.parse(a.payment.created_at??'')||0)
  || a.payment.id.localeCompare(b.payment.id);
}

export function paymentSignature(date:string,payee:string,amount:number){
 return [date,payee.trim().replace(/\s+/g,' ').toLowerCase(),roundMoney(amount)].join('\u0000');
}

export function hasMatchingPayment(entries:PaymentEntry[],signature:string,excludeId?:string){
 return entries.some(({payment,expense})=>payment.id!==excludeId&&paymentSignature(payment.date,expense.vendor,payment.amount)===signature);
}
