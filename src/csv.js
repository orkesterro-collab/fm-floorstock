// Supplier imports stay in the local demo. Both common CSV delimiters are supported.
export function parseCsv(input) {
 if (typeof input !== 'string') throw Error('Нужен текстовый CSV-файл');
 const raw = input.replace(/^\uFEFF/, '').trim();
 if (!raw) throw Error('CSV-файл пуст');

 // A semicolon inside a quoted header is content, not a delimiter.
 let headerQuoted = false, separator = ',';
 for (let i = 0; i < raw.length; i++) {
  if (raw[i] === '"') {
   if (headerQuoted && raw[i + 1] === '"') i++;
   else headerQuoted = !headerQuoted;
  } else if (!headerQuoted) {
   if (raw[i] === ';') separator = ';';
   if (raw[i] === '\r' || raw[i] === '\n') break;
  }
 }

 const table = [];
 let row = [], value = '', quoted = false, closedQuote = false, line = 1, rowLine = 1;
 const finishField = () => { row.push(value.trim()); value = ''; closedQuote = false; };
 const finishRow = () => { finishField(); table.push({ values: row, line: rowLine }); row = []; };
 for (let i = 0; i < raw.length; i++) {
  const c = raw[i];
  if (quoted) {
   if (c === '"') {
    if (raw[i + 1] === '"') { value += '"'; i++; }
    else { quoted = false; closedQuote = true; }
   } else { value += c; if (c === '\n' || (c === '\r' && raw[i + 1] !== '\n')) line++; }
  } else if (c === separator) finishField();
  else if (c === '\r' || c === '\n') {
   finishRow();
   if (c === '\r' && raw[i + 1] === '\n') i++;
   rowLine = ++line;
  } else if (closedQuote) {
   if (!/\s/.test(c)) throw Error('Проверьте кавычки в строке ' + line);
  } else if (c === '"') {
   if (value.trim()) throw Error('Проверьте кавычки в строке ' + line);
   value = ''; quoted = true;
  } else value += c;
 }
 if (quoted) throw Error('В CSV не закрыты кавычки');
 finishRow();

 const headers = table.shift().values.map(x => x.toLowerCase());
 if (headers.some(x => !x) || new Set(headers).size !== headers.length) throw Error('Колонки CSV должны иметь уникальные непустые названия');
 for (const key of ['sku', 'name', 'qty']) if (!headers.includes(key)) throw Error('Обязательные колонки CSV — sku, name, qty');
 const rows = table.filter(r => r.values.some(Boolean));
 if (!rows.length) throw Error('В CSV нет строк с товарами');
 return rows.map(({ values, line }) => {
  if (values.length !== headers.length) throw Error('Проверьте строку ' + line);
  const item = Object.fromEntries(headers.map((key, i) => [key, values[i]]));
  if (!item.sku || !item.name) throw Error('Нужны артикул и название в строке ' + line);
  const number = (value, label) => {
   if (!value) throw Error('Нет ' + label + ' в строке ' + line);
   const result = Number(value.replace(',', '.'));
   if (!/^\+?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value) || !Number.isFinite(result) || result < 0 || result > 1e9) throw Error('Проверьте значение ' + label + ' в строке ' + line);
   return result;
  };
  return { ...item, qty: number(item.qty, 'количества'), price: item.price ? number(item.price, 'цены') : null };
 });
}
