export const statuses=['Принят','Комплектуется','Готов к выдаче','Отгружен','Отменён','Возврат'];
export const categories=['Новости','Обучение','Сертификаты'];
export const empty=()=>({shops:[],people:[],stock:[],orders:[],plans:{},posts:[],feeds:{}});
export const period=(d=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Minsk'}).format(d).slice(0,7);
export const monthLabel=m=>new Date(m+'-15T12:00:00').toLocaleDateString('ru',{month:'long',year:'numeric'}).replace(' г.','');
export const money=n=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:2});
export function demo(){
 // Synthetic sample data for the local prototype; no live accounts or 1C connection.
 const s=empty(), m=period();
 s.shops=[{id:'p-101',name:'Паркет Студио'},{id:'p-102',name:'Дом паркета'}];
 s.people=[{id:'boss',name:'Анна Волкова',role:'director',shop:'p-101'},{id:'alex',name:'Алексей Миронов',role:'seller',shop:'p-101'},{id:'lena',name:'Елена Соколова',role:'seller',shop:'p-101'},{id:'boss2',name:'Ольга Крылова',role:'director',shop:'p-102'}];
 const products=[['EV-101','Дуб Вирдия светлый','Ламинат',248.6,67],['PP-208','Дуб натуральный','Паркет',146.5,108],['AF-304','Дуб Лаунж','Винил',92,79],['EV-115','Дуб дымчатый','Ламинат',318,68],['PP-220','Дуб жемчужный','Паркет',86.5,110],['AF-312','Травертин светлый','Винил',116,76]];
 s.stock=products.map(([sku,name,type,qty,price])=>({sku,name,type,qty,price,source:'1С УТ · Минск'}));
 s.stock.push({...s.stock[0],source:'Поставщик · Север',qty:516},{...s.stock[2],source:'Поставщик · Север',qty:260});
 const today=Number(new Intl.DateTimeFormat('ru',{day:'numeric',timeZone:'Europe/Minsk'}).format(new Date()));
 const sold=[3850,5260,4480,6720,3150,5120,4820,3920,1940];
 s.orders=[...sold,3250,2400,4260,1860].map((amount,i)=>{const x=s.stock[i%6],date=m+'-'+String(Math.min(today,1+Math.round(i*(today-1)/12))).padStart(2,'0');return {id:'ФС-'+(2401+i),shop:'p-101',seller:i%3?'alex':'lena',sku:x.sku,name:x.name,qty:Math.round(amount/x.price*100)/100,amount,status:i<9?'Отгружен':statuses[(i-9)%3],date,saleDate:i<9?date:'',revision:1}});
 s.plans['p-101/'+m]=60000;s.plans['p-102/'+m]=35000;
 s.posts=[{id:'p1',kind:'Новости',title:'Пополнение коллекции EVERSENSE',body:'В демонстрационном каталоге обновились остатки светлых древесных декоров. Доступный объём смотрите отдельно по каждому источнику.',date:m+'-01'}, {id:'p2',kind:'Обучение',title:'Как проверить наличие перед заказом',body:'Найдите товар по артикулу. Проверьте доступный метраж на складе Флорсток и дату выгрузки. Остаток поставщика учитывается отдельно. Согласуйте срок поставки перед подтверждением клиенту.',date:m+'-01'}];
 s.feeds=Object.fromEntries([...new Set(s.stock.map(x=>x.source))].map(k=>[k,new Date().toISOString()]));return s;
}
export function visible(s,user){
 check(user&&['admin','director','seller'].includes(user.role),'Нет доступа');
 const admin=user.role==='admin',director=user.role==='director',shop=user.shop;
 return {...s,shops:s.shops.filter(x=>admin||x.id===shop),people:s.people.filter(x=>admin||(x.shop===shop&&(director||x.id===user.id))).map(({email,...x})=>x),
 orders:s.orders.filter(x=>admin||(x.shop===shop&&(director||x.seller===user.id))),plans:Object.fromEntries(Object.entries(s.plans).filter(([k])=>admin||(director&&k.startsWith(shop+'/')))),user};
}
const check=(ok,msg)=>{if(!ok)throw Error(msg)};
const word=(v,n=160)=>{check(typeof v==='string'&&v.trim()&&v.trim().length<=n,'Проверьте текстовые поля');return v.trim()};
const num=(v,max=1e9)=>{check(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max,'Проверьте числовое значение');return v};
const fixed=(v,ds)=>{num(v);return Number(v.toFixed(ds))};
const validMonth=v=>/^\d{4}-(0[1-9]|1[012])$/.test(v);
const validDate=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const date=new Date(v+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===v};
// Local demo identifiers only. getRandomValues also works when HTTP hides randomUUID.
const demoId=()=>{
 const c=globalThis.crypto;if(typeof c.randomUUID==='function')return c.randomUUID();
 const bytes=c.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
 return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
};
export function apply(s,u,a){
 const admin=u.role==='admin',director=u.role==='director';
 if(a.type==='plan'){check(admin&&s.shops.some(x=>x.id===a.shop)&&validMonth(a.month),'План задаёт Флорсток');s.plans[a.shop+'/'+a.month]=num(a.amount);return}
 if(a.type==='shop'){check(admin,'Нет доступа');const id=word(a.id);check(/^[a-zA-Z0-9_-]+$/.test(id)&&!s.shops.some(x=>x.id===id),'Нужен уникальный код магазина');s.shops.push({id,name:word(a.name)});return}
 if(a.type==='invite'){
 check((admin||director)&&s.shops.some(x=>x.id===a.shop)&&(admin||a.shop===u.shop),'Нет доступа');
 check(a.role==='seller'||(admin&&a.role==='director'),'Недоступная роль');const email=word(a.email).toLowerCase();check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&!s.people.some(x=>x.email===email),'Проверьте адрес. Возможно, он уже зарегистрирован');
 s.people.push({id:demoId(),name:word(a.name),email,shop:a.shop,role:a.role,pending:true});return}
 if(a.type==='publish'){check(admin&&categories.includes(a.kind),'Нет доступа');const url=a.url?new URL(a.url):null;check(!url||url.protocol==='https:','Укажите ссылку HTTPS');check(a.kind!=='Сертификаты'||url,'Добавьте ссылку на сертификат');s.posts.unshift({id:demoId(),kind:a.kind,title:word(a.title),body:word(a.body,10000),url:url?.href||'',date:new Date().toISOString().slice(0,10)});return}
 if(a.type==='stock'){
 check(admin&&Array.isArray(a.rows)&&a.rows.length>0&&a.rows.length<=2000,'Нужен файл с 1–2000 строками');const source=word(a.source);const keys=new Set();
 const rows=a.rows.map(x=>{const sku=word(x.sku);check(!keys.has(sku),'Повтор артикула '+sku);keys.add(sku);return {sku,name:word(x.name),type:word(x.type||'Покрытие'),qty:fixed(x.qty,3),price:x.price==null?null:fixed(x.price,2),source}});
 s.stock=s.stock.filter(x=>x.source!==source).concat(rows);s.feeds[source]=new Date().toISOString();return}
 if(a.type==='order'){check(admin,'Статусы передаёт Флорсток');const o=a.order,shop=s.shops.find(x=>x.id===o.shop);
 check(shop&&(!o.seller||s.people.some(x=>x.id===o.seller&&x.shop===o.shop)),'Проверьте магазин и код сотрудника');
 check(statuses.includes(o.status)&&validDate(o.date)&&Number.isSafeInteger(o.revision)&&o.revision>0,'Проверьте статус, дату и версию');
 check(!o.saleDate||validDate(o.saleDate),'Проверьте дату реализации');
 check(!['Отгружен','Возврат'].includes(o.status)||validDate(o.saleDate),'Укажите дату реализации');
 const id=word(o.id), idx=s.orders.findIndex(x=>x.id===id&&x.shop===o.shop);
 if(idx>=0&&s.orders[idx].revision>=o.revision)return;
 const row={id,shop:o.shop,seller:o.seller||'',sku:word(o.sku),name:word(o.name),qty:fixed(o.qty,3),amount:fixed(o.amount,2),status:o.status,date:o.date,saleDate:o.saleDate||'',revision:o.revision};
 if(idx<0)s.orders.push(row);else s.orders[idx]=row;return}
 throw Error('Неизвестное действие')
}
export function totals(orders,m){const sold=orders.filter(x=>x.status==='Отгружен'&&validDate(x.saleDate)&&x.saleDate.slice(0,7)===m);return {sales:sold.reduce((a,x)=>a+Math.round(x.amount*100),0)/100,points:sold.reduce((a,x)=>a+Math.floor(x.amount/100),0),sold}}
