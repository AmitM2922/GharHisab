import {Expense,money} from '../data';
import {materialLines} from '../lib/materials';
export default function MaterialBreakdown({expense}:{expense:Expense}){
 const items=materialLines(expense);if(!items.length)return null;
 return <div className="invoice-material-breakdown"><h4>Material breakdown <span>{items.length}</span></h4>{items.map((item,index)=><div className="invoice-material-row" key={item.id||index}><div><strong>{item.material}</strong><small>{item.quantity.toLocaleString('en-IN')} {item.unit} × {money(item.rate)} / {item.unit}</small></div><b>{money(item.amount)}</b></div>)}<div className="invoice-material-total"><span>Invoice total</span><strong>{money(expense.amount)}</strong></div></div>
}
