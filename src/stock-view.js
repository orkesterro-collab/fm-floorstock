const LOCAL_SOURCE = '1С УТ · Минск';
const areaFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 });

export const area = quantity => areaFormat.format(quantity) + ' м²';
export const dayMonth = iso => iso.slice(8, 10) + '.' + iso.slice(5, 7);

// The two display examples belong to the seeded local catalogue only.
// Imported supplier rows keep their own descriptions, quantities and identities.
export function stockForDisplay(raw) {
  const supplier = raw.source !== LOCAL_SOURCE;
  const item = {
    ...raw,
    displaySku: raw.sku,
    supplier,
    warehouses: [{ name: supplier ? raw.source : 'Склад Флорсток', qty: raw.qty }],
  };
  if (supplier) return item;
  if (raw.sku === '3456' && raw.name === 'Spc Floor Granit Дуб мироока') {
    if (raw.qty === 248.6) {
      item.warehouses = [{ name: 'Матусевича', qty: 200 }, { name: 'СРП', qty: 48.6 }];
    }
    item.reserved = { warehouse: 'СРП', qty: 27.7 };
    item.incoming = { warehouse: 'СРП', qty: 43, date: '2026-12-15' };
    item.factory = {
      availableLabel: 'Более 100 м²', incomingQty: 700, incomingDate: '2026-12-24',
      note: 'Поставка каждую неделю.',
    };
  } else if (raw.sku === 'PP-208' && raw.name === 'Дуб натуральный') {
    item.factory = { supplyFrom: '2026-12-24' };
  }
  return item;
}

export function stockSummary(item, today) {
  if (item.incoming?.date >= today) {
    return dayMonth(item.incoming.date) + ' · ещё ' + area(item.incoming.qty) + ' на ' + item.incoming.warehouse;
  }
  if (item.factory?.supplyFrom >= today) {
    return 'Возможна поставка с завода с ' + dayMonth(item.factory.supplyFrom);
  }
  return '';
}
