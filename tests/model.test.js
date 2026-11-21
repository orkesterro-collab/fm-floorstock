import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, demo, empty, totals, visible } from '../src/model.js';
import { parseCsv } from '../src/csv.js';

const admin = { id: 'fs', role: 'admin' };
const director = { id: 'director-a', shop: 'a', role: 'director' };
const seller = { id: 'seller-a', shop: 'a', role: 'seller' };
function fixture() {
 const state = empty();
 state.shops = [{ id: 'a', name: 'Демо А' }, { id: 'b', name: 'Демо Б' }];
 state.people = [director, seller, { id: 'seller-b', shop: 'b', role: 'seller' }].map(person => ({ ...person, email: person.id + '@example.test' }));
 state.plans = { 'a/2026-11': 1000, 'b/2026-11': 2000 };
 return state;
}
const order = (changes = {}) => ({ id: 'ФС-1', shop: 'a', seller: 'seller-a', sku: 'Д-1', name: 'Дуб', qty: 2.5, amount: 199.99, status: 'Отгружен', date: '2026-11-01', saleDate: '2026-11-02', revision: 1, ...changes });

test('role views scope shops, people, orders and plans; emails stay out of views', () => {
 const state = fixture();
 state.orders = [order(), order({ id: 'ФС-2', seller: 'director-a' }), order({ id: 'ФС-3', shop: 'b', seller: 'seller-b' })];
 // Imported identities cannot expose a same-ID row from a different shop.
 state.people.push({ ...seller, shop: 'b' });
 const adminView = visible(state, admin);
 assert.equal(adminView.orders.length, 3);
 assert.equal(adminView.shops.length, 2);
 assert.deepEqual(adminView.plans, state.plans);
 const directorView = visible(state, director);
 assert.deepEqual(directorView.orders.map(x => x.id), ['ФС-1', 'ФС-2']);
 assert.deepEqual(directorView.people.map(x => x.id), ['director-a', 'seller-a']);
 assert.deepEqual(directorView.plans, { 'a/2026-11': 1000 });
 const sellerView = visible(state, seller);
 assert.deepEqual(sellerView.orders.map(x => x.id), ['ФС-1']);
 assert.deepEqual(sellerView.people.map(x => x.shop), ['a']);
 assert.deepEqual(sellerView.plans, {});
 for (const view of [adminView, directorView, sellerView]) assert.ok(view.people.every(person => !Object.hasOwn(person, 'email')));
 assert.throws(() => visible(state, { ...seller, role: 'unknown' }), /Нет доступа/);
});

test('only allowed roles can change data; directors invite sellers in their own shop', () => {
 const state = fixture();
 const changes = [
  { type: 'plan', shop: 'a', month: '2026-11', amount: 4000 },
  { type: 'shop', id: 'c', name: 'Демо В' },
  { type: 'publish', kind: 'Новости', title: 'Новость', body: 'Демо' },
  { type: 'stock', source: 'Демо склад', rows: [{ sku: 'A', name: 'Дуб', qty: 1 }] },
  { type: 'order', order: order() }
 ];
 const before = structuredClone(state);
 for (const action of changes) {
  assert.throws(() => apply(state, seller, action));
  assert.throws(() => apply(state, director, action));
 }
 const invite = { type: 'invite', shop: 'a', name: 'Демо сотрудник', email: 'new@example.test', role: 'seller' };
 assert.throws(() => apply(state, seller, invite), /Нет доступа/);
 assert.throws(() => apply(state, director, { ...invite, shop: 'b' }), /Нет доступа/);
 assert.throws(() => apply(state, director, { ...invite, role: 'director' }), /Недоступная роль/);
 assert.deepEqual(state, before);
 apply(state, director, invite);
 assert.equal(state.people.at(-1).shop, 'a');
 assert.equal(state.people.at(-1).pending, true);
 assert.throws(() => apply(state, director, { ...invite, email: 'NEW@EXAMPLE.TEST' }), /уже зарегистрирован/);
 apply(state, admin, changes[0]);
 assert.equal(state.plans['a/2026-11'], 4000);
});

test('points round down per shipped order and use the sale month', () => {
 const orders = [
  order({ amount: 199.99 }), order({ amount: 99.99 }), order({ amount: 200.01 }),
  ...['Принят', 'Комплектуется', 'Готов к выдаче', 'Отменён', 'Возврат'].map(status => order({ amount: 1000, status })),
  order({ amount: 1000, saleDate: '2026-12-01' })
 ];
 const result = totals(orders, '2026-11');
 assert.equal(result.sales, 499.99);
 assert.equal(result.points, 3);
 assert.equal(result.sold.length, 3);
 assert.equal(totals([order({ amount: 0.1 }), order({ amount: 0.2 })], '2026-11').sales, 0.3);
 assert.equal(totals([order({ saleDate: undefined }), order({ saleDate: '2026-11-31' })], '2026-11').sales, 0);
});

test('order revisions are idempotent; a full return removes sales and points', () => {
 const state = fixture();
 apply(state, admin, { type: 'order', order: order({ status: 'Принят', saleDate: '' }) });
 assert.equal(totals(state.orders, '2026-11').points, 0);
 apply(state, admin, { type: 'order', order: order({ revision: 2 }) });
 assert.equal(totals(state.orders, '2026-11').points, 1);
 const shipped = structuredClone(state);
 for (const revision of [1, 2]) apply(state, admin, { type: 'order', order: order({ status: 'Возврат', revision }) });
 assert.deepEqual(state, shipped);
 apply(state, admin, { type: 'order', order: order({ status: 'Возврат', revision: 3 }) });
 assert.equal(state.orders.length, 1);
 assert.equal(totals(state.orders, '2026-11').points, 0);
 assert.equal(totals(state.orders, '2026-11').sales, 0);
 apply(state, admin, { type: 'order', order: order({ shop: 'b', seller: 'seller-b' }) });
 assert.equal(state.orders.length, 2, 'order numbers are scoped to a shop');
});

test('invalid calendar dates and versions fail before changing orders', () => {
 const state = fixture();
 for (const date of ['2026-13-01', '2026-00-01', '2026-11-32', '2026-02-29', '2026-04-31', 'invalid', '']) {
  assert.throws(() => apply(state, admin, { type: 'order', order: order({ date }) }), /Проверьте статус, дату и версию/);
  assert.throws(() => apply(state, admin, { type: 'order', order: order({ saleDate: date }) }), /дату реализации/);
 }
 for (const revision of [0, -1, 1.5, '2', Infinity]) assert.throws(() => apply(state, admin, { type: 'order', order: order({ revision }) }));
 assert.throws(() => apply(state, admin, { type: 'order', order: order({ status: 'Принят', saleDate: 'tomorrow' }) }), /дату реализации/);
 assert.equal(state.orders.length, 0);
 apply(state, admin, { type: 'order', order: order({ date: '2024-02-29', saleDate: '2024-02-29' }) });
 assert.equal(totals(state.orders, '2024-02').points, 1);
});

test('CSV supports BOM, Unicode, both delimiters, CRLF and escaped multiline fields', () => {
 const rows = parseCsv('\uFEFFSKU;NAME;QTY;PRICE;TYPE\r\nД-01;"Дуб; «Светлый» 🪵";12,5;67,90;Ламинат\r\nД-02;"Дуб ""Луна""\r\nматовый";0;;Паркет\r\n');
 assert.deepEqual(rows, [
  { sku: 'Д-01', name: 'Дуб; «Светлый» 🪵', qty: 12.5, price: 67.9, type: 'Ламинат' },
  { sku: 'Д-02', name: 'Дуб "Луна"\r\nматовый', qty: 0, price: null, type: 'Паркет' }
 ]);
 const comma = parseCsv('sku,name,qty,"note;extra"\rA,"Дуб, белый",1,демо');
 assert.equal(comma[0].name, 'Дуб, белый');
 assert.equal(comma[0]['note;extra'], 'демо');
});

test('CSV rejects empty files, duplicate columns, incomplete rows and broken quotes', () => {
 for (const csv of ['', '\uFEFF\r\n ', 'sku,name,qty', 'sku,name,qty\n\n']) assert.throws(() => parseCsv(csv), /пуст|нет строк/);
 for (const csv of ['sku,name\nA,Дуб', 'sku,name,qty,QTY\nA,Дуб,1,2', 'sku,name,qty,\nA,Дуб,1,x']) assert.throws(() => parseCsv(csv), /колонки|Колонки/);
 for (const csv of ['sku,name,qty\nA,Дуб', 'sku,name,qty\n,Дуб,1', 'sku,name,qty\nA,,1', 'sku,name,qty\nA,Дуб,']) assert.throws(() => parseCsv(csv));
 for (const name of ['"Дуб', 'Ду"б', '"Дуб"лишнее']) assert.throws(() => parseCsv('sku;name;qty\nA;' + name + ';1'), /кавычки/);
 assert.throws(() => parseCsv('sku,name,qty\n\nA,Дуб,нет'), /строке 3/);
});

test('CSV quantities and prices must be finite nonnegative decimal numbers', () => {
 for (const value of ['нет', '-1', 'NaN', 'Infinity', '0x10', '1e6', '1000000001']) {
  assert.throws(() => parseCsv('sku;name;qty\nA;Дуб;' + value), /количества/);
  assert.throws(() => parseCsv('sku;name;qty;price\nA;Дуб;1;' + value), /цены/);
 }
 assert.equal(parseCsv('sku,name,qty,price\nA,Дуб,.5,0')[0].price, 0);
});

test('stock import replaces one source atomically, rejecting duplicate SKUs and bad values', () => {
 const state = fixture();
 state.stock = [{ sku: 'OLD', name: 'Старый', qty: 1, source: 'A' }, { sku: 'OTHER', name: 'Другой', qty: 2, source: 'B' }];
 const rows = parseCsv('sku;name;qty;price\nД-1;Дуб;12,3456;67,999');
 apply(state, admin, { type: 'stock', source: 'A', rows });
 assert.deepEqual(state.stock.map(x => x.sku), ['OTHER', 'Д-1']);
 assert.equal(state.stock[1].qty, 12.346);
 assert.equal(state.stock[1].price, 68);
 assert.ok(state.feeds.A);
 const before = structuredClone(state);
 for (const invalid of [[], [rows[0], rows[0]], [rows[0], { ...rows[0], sku: 'BAD', qty: NaN }]]) {
  assert.throws(() => apply(state, admin, { type: 'stock', source: 'A', rows: invalid }));
  assert.deepEqual(state, before);
 }
});

test('the original demo remains usable for every supported role', () => {
 const state = demo();
 for (const user of [admin, ...state.people]) {
  const view = visible(state, user);
  assert.ok(Array.isArray(view.stock));
  assert.ok(Array.isArray(view.posts));
  const month = state.orders[0].date.slice(0, 7);
  assert.ok(Number.isFinite(totals(view.orders, month).points));
 }
});

test('invites and posts work without randomUUID using getRandomValues', () => {
 const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
 const randomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
 let calls = 0;
 try {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: values => { calls++; return randomValues(values); } } });
  const state = fixture();
  apply(state, director, { type: 'invite', shop: 'a', name: 'Демо сотрудник', email: 'http-demo@example.test', role: 'seller' });
  apply(state, admin, { type: 'publish', kind: 'Новости', title: 'Демо новость', body: 'Проверка локального кабинета' });
  const ids = [state.people.at(-1).id, state.posts[0].id];
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(ids[0], ids[1]);
  assert.equal(calls, 2);
 } finally {
  Object.defineProperty(globalThis, 'crypto', descriptor);
 }
});
