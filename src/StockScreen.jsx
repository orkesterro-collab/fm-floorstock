import { useId, useMemo, useState } from 'react';
import { Check, ChevronDown, Layers, Plus, Search, Upload, X } from 'lucide-react';
import { area, dayMonth, stockForDisplay, stockSummary } from './stock-view';
import './stock-screen.css';

const timestamp = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Minsk',
});
const calendarDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Minsk' });

function positionLabel(n) {
  if (n % 100 >= 11 && n % 100 <= 14) return 'позиций';
  if (n % 10 === 1) return 'позиция';
  if (n % 10 >= 2 && n % 10 <= 4) return 'позиции';
  return 'позиций';
}

function StockDetails({ item, feed, today }) {
  const { reserved, factory, incoming } = item;
  const updated = Date.parse(feed);
  return <div className="inventory-details">
    <h3>{item.supplier ? 'Склад поставщика' : 'Склады РБ'}</h3>
    <dl className="inventory-facts">
      {item.warehouses.map(warehouse => <div key={warehouse.name}><dt>{warehouse.name}</dt><dd>{area(warehouse.qty)}</dd></div>)}
      {reserved && <div><dt>В резерве · {reserved.warehouse}</dt><dd>{area(reserved.qty)}</dd></div>}
      {incoming && <div><dt>{incoming.date >= today ? 'Ожидаем' : 'План на'} {dayMonth(incoming.date)} · {incoming.warehouse}</dt><dd>{area(incoming.qty)}</dd></div>}
    </dl>
    {factory && <>
      <h3>Склад завода</h3>
      <dl className="inventory-facts">
        {factory.availableLabel && <div><dt>Сейчас на складе</dt><dd>{factory.availableLabel}</dd></div>}
        {factory.incomingDate && <div><dt>{factory.incomingDate >= today ? 'Поступление' : 'План на'} {dayMonth(factory.incomingDate)}</dt><dd>{area(factory.incomingQty)}</dd></div>}
        {factory.supplyFrom && <div><dt>Возможная поставка</dt><dd>{factory.supplyFrom >= today ? 'С ' + dayMonth(factory.supplyFrom) : 'Срок уточняется'}</dd></div>}
      </dl>
      {factory.note && <p>{factory.note}</p>}
    </>}
    {Number.isFinite(updated) && <p className="inventory-freshness">Обновлено {timestamp.format(updated)}</p>}
  </div>;
}

function StockCard({ item, feed, selectedQty, onAdd, today }) {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const summary = stockSummary(item, today);
  return <article className="card inventory-card">
    <span className="product-type">{item.displaySku || item.sku} · {item.type}</span>
    <h2>{item.name}</h2>
    <p className="inventory-available"><strong>{area(item.qty)}</strong> {item.supplier ? 'у поставщика' : 'в наличии'}</p>
    {summary && <p className="inventory-shipment">{summary}</p>}
    {item.supplier && <p className="inventory-shipment">{item.source}</p>}
    <div className="inventory-actions">
      <button type="button" className="inventory-disclosure" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpanded(!expanded)}>
        По складам <ChevronDown size={16} aria-hidden="true" />
      </button>
      <button type="button" className="inventory-add" disabled={item.qty <= 0 && !selectedQty} onClick={() => onAdd(item)}>
        {selectedQty ? <><Check size={16} aria-hidden="true" />В заказе · {area(selectedQty)}</> : <><Plus size={16} aria-hidden="true" />В заказ</>}
      </button>
    </div>
    <div id={detailId} hidden={!expanded}>
      {expanded && <StockDetails item={item} feed={feed} today={today} />}
    </div>
  </article>;
}

export default function StockScreen({ stock, feeds = {}, draft = [], onAdd, onImport }) {
  const [query, setQuery] = useState('');
  const [minimum, setMinimum] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [withSupply, setWithSupply] = useState(false);
  const items = useMemo(() => stock.map(stockForDisplay), [stock]);
  const today = calendarDate.format(Date.now());
  const words = query.trim().toLocaleLowerCase('ru').split(/\s+/);
  const validMinimum = /^\d*(?:[.,]\d*)?$/.test(minimum) && Number.isFinite(Number(minimum.replace(',', '.')));
  const minQty = Number(minimum.replace(',', '.'));
  const matches = items.filter(item => {
    const terms = [item.sku, item.displaySku, item.name, item.type, item.source].join(' ').toLocaleLowerCase('ru');
    return validMinimum && item.qty >= minQty && words.every(word => terms.includes(word))
      && (!availableOnly || item.qty > 0)
      && (!withSupply || Boolean(stockSummary(item, today)));
  });

  function clearFilters() {
    setQuery('');
    setMinimum('');
    setAvailableOnly(false);
    setWithSupply(false);
  }

  return <section className="inventory-screen" aria-label="Остатки покрытий">
    <div className="inventory-search">
      <label className="search-field"><Search size={18} aria-hidden="true" />
        <input aria-label="Название или артикул" type="text" value={query} placeholder="Название или артикул" onChange={event => setQuery(event.target.value)} />
        {query && <button type="button" aria-label="Очистить поиск" onClick={() => setQuery('')}><X size={15} /></button>}
      </label>
      <input className="inventory-minimum" aria-label="Минимальная площадь, м²" aria-invalid={!validMinimum} inputMode="decimal" placeholder="м² от" value={minimum} onChange={event => setMinimum(event.target.value)} />
    </div>
    {!validMinimum && <p className="inventory-error" role="alert">Введите площадь в м², например 24,5.</p>}
    <div className="inventory-filters" aria-label="Отбор по наличию">
      <button type="button" aria-pressed={availableOnly} onClick={() => setAvailableOnly(!availableOnly)}>{availableOnly && <Check size={14} />}В наличии</button>
      <button type="button" aria-pressed={withSupply} onClick={() => setWithSupply(!withSupply)}>{withSupply && <Check size={14} />}С поступлением</button>
    </div>
    <div className="inventory-count"><p role="status">{matches.length} {positionLabel(matches.length)}</p>
      {onImport && <button className="inline-link" onClick={onImport}><Upload size={16} />Загрузить CSV</button>}
    </div>
    <div className="stock-list">
      {matches.map(item => <StockCard key={JSON.stringify([item.source, item.sku])} item={item} today={today} feed={feeds[item.source]} onAdd={onAdd}
        selectedQty={draft.filter(row => row.sku === item.sku && row.source === item.source).reduce((sum, row) => sum + row.qty, 0)} />)}
    </div>
    {matches.length > 0 && <div aria-hidden="true" className="ink-crew" />}
    {!matches.length && <div className="card inventory-empty"><Layers size={26} /><h2>Покрытия не найдены</h2>
      {(query || minimum || availableOnly || withSupply) && <button className="inline-link" onClick={clearFilters}>Сбросить фильтры</button>}
    </div>}
  </section>;
}
