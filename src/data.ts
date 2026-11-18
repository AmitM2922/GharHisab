export type PaymentProof = {id?:string;clientId?:string;name:string;type:string;url:string;path?:string};
export type MaterialLine={amountOnly?:boolean;roundToRupee?:boolean;id?:string;materialId?:string;material:string;unit:string;quantity:number;rate:number;amount:number};
export type Expense = { id: string; date: string; title: string; category: string; material: string; quantity: number; unit: string; rate: number; amount: number; paid: number; vendor: string; method: string; proof?:PaymentProof;items?:MaterialLine[];version?:number;materialId?:string;vendorId?:string;description?:string;notes?:string;is_public?:boolean;created_at?:string;labour?:{work_type:string;workers?:number;days?:number;daily_rate?:number;period_end?:string} };
export const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits:0,maximumFractionDigits: 2 }).format(n);
export const status = (e: Expense) => e.paid >= e.amount ? 'Paid' : e.paid > 0 ? 'Partially paid' : 'Unpaid';
const records = [
 ['17','2026-11-17','UltraTech cement · PPC','Materials','Cement',100,'bags',385,38500,38500,'Sharma Building Supply','UPI'],
 ['16','2026-11-16','First floor masonry work','Contractor costs','',8,'days',2400,19200,12000,'Ramesh & team','Cash'],
 ['15','2026-11-15','TMT steel · 12 mm','Materials','Steel',650,'kg',62,40300,25000,'Agarwal Steel Traders','Bank Transfer'],
 ['14','2026-11-14','River sand delivery','Materials','Sand',3,'trucks',6500,19500,19500,'Sharma Building Supply','UPI'],
 ['13','2026-11-13','Electrical conduit & fittings','Materials','Electrical',1,'lot',12800,12800,0,'Verma Electricals','UPI'],
 ['12','2026-11-12','Site supervision · November','Other','',1,'visit',8000,8000,8000,'Ar. Neha Singh','Bank Transfer'],
 ['11','2026-11-10','Red clay bricks · Class A','Materials','Bricks',5000,'pcs',8,40000,40000,'Patel Brick Works','Bank Transfer'],
 ['10','2026-11-08','Foundation concrete work','Contractor costs','',10,'days',2100,21000,21000,'Ramesh & team','Cash'],
 ['09','2026-10-28','UltraTech cement · PPC','Materials','Cement',200,'bags',380,76000,76000,'Sharma Building Supply','UPI'],
 ['08','2026-10-21','Foundation reinforcement steel','Materials','Steel',1400,'kg',60,84000,70000,'Agarwal Steel Traders','Bank Transfer'],
 ['07','2026-10-14','Aggregate · 20 mm','Materials','Aggregate',4,'trucks',7200,28800,28800,'Sharma Building Supply','Cash'],
 ['06','2026-10-05','Foundation and plinth contract','Contractor costs','',1,'contract',68000,68000,68000,'Ramesh & team','Bank Transfer'],
 ['05','2026-09-24','Red clay bricks · Class A','Materials','Bricks',10000,'pcs',7.5,75000,75000,'Patel Brick Works','Bank Transfer'],
 ['04','2026-09-17','River sand · foundation','Materials','Sand',5,'trucks',6200,31000,31000,'Sharma Building Supply','Cash'],
 ['03','2026-09-09','Excavation and site preparation','Contractor costs','',1,'contract',45000,45000,45000,'Ramesh & team','Bank Transfer'],
 ['02','2026-08-20','Architectural drawings & approval','Other','',1,'lot',42000,42000,42000,'Ar. Neha Singh','Bank Transfer'],
 ['01','2026-08-05','Site survey and soil testing','Other','',1,'lot',18500,18500,18500,'GeoTest Services','UPI']
];
export const seed: Expense[] = records.map(r => ({id:`GH-${r[0]}`,date:String(r[1]),title:String(r[2]),category:String(r[3]),material:String(r[4]),quantity:Number(r[5]),unit:String(r[6]),rate:Number(r[7]),amount:Number(r[8]),paid:Number(r[9]),vendor:String(r[10]),method:String(r[11])}));

