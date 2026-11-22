import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDown, Pencil, Trash2, Truck, X } from 'lucide-react';
import { stockForDisplay } from './stock-view';
import './order-draft.css';

const changed = 'fm-draft-change';
const number = value => Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 3 });
const sameProduct = (left, right) => left.sku === right.sku && left.source === right.source;
const sameLine = (left, right) => sameProduct(left, right) && left.warehouse === right.warehouse;
const lineId = row => JSON.stringify([row.source, row.sku, row.warehouse]);

function subscribe(listener) {
  window.addEventListener('storage', listener);
  window.addEventListener(changed, listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(changed, listener);
  };
}

function readDraft(raw) {
  const rows = JSON.parse(raw || '[]');
  if (!Array.isArray(rows) || !rows.every(row => row && typeof row.sku === 'string'
    && typeof row.source === 'string' && typeof row.warehouse === 'string'
    && typeof row.name === 'string' && Number.isFinite(row.qty) && row.qty > 0)) {
    throw new Error('Не удалось прочитать сохранённый заказ.');
  }
  return rows;
}

export function useOrderDraft(userId, shopId) {
  const key = 'floorstock-order-draft-v1:' + JSON.stringify([shopId, userId]);
  const raw = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(key); } catch { return null; }
  });
  const draft = useMemo(() => {
    try { return readDraft(raw); } catch { return []; }
  }, [raw]);

  function change(update) {
    const write = () => {
      let current;
      try { current = readDraft(localStorage.getItem(key)); } catch {
        throw new Error('Не удалось прочитать заказ из хранилища браузера.');
      }
      const rows = update(current);
      try { localStorage.setItem(key, JSON.stringify(rows)); } catch {
        throw new Error('Не удалось сохранить заказ. Проверьте доступ к хранилищу браузера.');
      }
      window.dispatchEvent(new Event(changed));
    };
    if (navigator.locks) return navigator.locks.request(key, write);
    return write();
  }

  function save(row, original) {
    return change(rows => {
      if (original && !sameLine(original, row)) {
        if (rows.some(previous => sameLine(previous, row))) {
          throw new Error('Этот склад уже добавлен. Измените его строку в заказе.');
        }
        rows = rows.filter(previous => !sameLine(previous, original));
      }
      const index = rows.findIndex(previous => sameLine(previous, row));
      if (index === -1) rows.push(row);
      else rows[index] = row;
      return rows;
    });
  }

  function remove(row) {
    return change(rows => rows.filter(previous => !sameLine(previous, row)));
  }

  return { draft, save, remove };
}

function QuantityForm({ item, original, draft, save, onSaved }) {
  const previous = draft.find(row => sameProduct(row, item));
  const initialWarehouse = original?.warehouse || previous?.warehouse;
  const warehouses = item.warehouses;
  const first = warehouses.find(entry => entry.name === initialWarehouse) || warehouses.find(entry => entry.qty > 0) || warehouses[0];
  const [warehouse, setWarehouse] = useState(first?.name || '');
  const existing = draft.find(row => sameProduct(row, item) && row.warehouse === warehouse);
  const [amount, setAmount] = useState(existing ? number(existing.qty).replace(/\s/g, '') : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const available = warehouses.find(entry => entry.name === warehouse)?.qty || 0;
  const normalized = amount.trim().replace(',', '.');
  const qty = Number(normalized);

  function selectWarehouse(name) {
    setWarehouse(name);
    const row = draft.find(line => sameProduct(line, item) && line.warehouse === name);
    if (!original) setAmount(row ? number(row.qty).replace(/\s/g, '') : '');
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    if (!/^\d+(\.\d{1,3})?$/.test(normalized) || !Number.isFinite(qty) || qty <= 0) {
      setError('Введите количество в м², до трёх знаков после запятой.');
      return;
    }
    if (qty > available) {
      setError('На выбранном складе доступно ' + number(available) + ' м².');
      return;
    }
    setSaving(true);
    try {
      await save({ sku: item.sku, source: item.source, displaySku: item.displaySku, name: item.name, qty, warehouse }, original);
      onSaved();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSaving(false);
    }
  }

  return <form className="sheet-content draft-content" onSubmit={submit}>
    <h3>{item.displaySku || item.sku} {item.name}</h3>
    <label className="field"><span>Склад</span>
      <span className="select-wrap"><select value={warehouse} onChange={event => selectWarehouse(event.target.value)}>
        {warehouses.map(entry => <option key={entry.name} value={entry.name} disabled={Boolean(original && entry.name !== original.warehouse && draft.some(line => sameProduct(line, item) && line.warehouse === entry.name))}>{entry.name} · доступно {number(entry.qty)} м²</option>)}
      </select><ChevronDown size={18} aria-hidden="true" /></span>
    </label>
    <label className="field"><span>Количество, м²</span>
      <input type="text" inputMode="decimal" autoComplete="off" maxLength={16} required placeholder="0" value={amount}
        onChange={event => { setAmount(event.target.value); setError(''); }} aria-describedby={error ? 'draft-amount-error' : undefined} />
    </label>
    {error && <p id="draft-amount-error" className="form-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={saving || available <= 0} type="submit">
      {existing || original ? 'Сохранить' : 'Добавить'} {qty > 0 && Number.isFinite(qty) ? number(qty) + ' м²' : ''}
    </button>
  </form>;
}

function DraftSheet({ panel, onClose, stock, draft, save, remove }) {
  const ref = useRef(null);
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState('');
  const chosen = edit || panel.item;
  const raw = chosen && stock.find(row => sameProduct(row, chosen));
  const item = raw && stockForDisplay(raw);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    document.body.classList.add('draft-sheet-open');
    return () => { dialog.close(); document.body.classList.remove('draft-sheet-open'); };
  }, []);

  async function deleteRow(row) {
    try { await remove(row); setError(''); } catch (failure) { setError(failure.message); }
  }
  return <dialog className="bottom-sheet" ref={ref} aria-labelledby="order-draft-heading"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === ref.current && event.clientY < ref.current.getBoundingClientRect().top) onClose(); }}>
    <div className="sheet-grip" aria-hidden="true" />
    <header className="sheet-heading"><h2 id="order-draft-heading">{chosen ? 'В заказ' : 'Мой заказ'}</h2>
      <button className="square-button" type="button" onClick={onClose} aria-label="Закрыть"><X size={20} /></button>
    </header>
    {chosen && (item
      ? <QuantityForm key={lineId(chosen)} item={item} original={edit} draft={draft} save={save} onSaved={() => edit ? setEdit(null) : onClose()} />
      : <p className="sheet-content">Этой позиции больше нет в остатках.</p>)}
    {!chosen && <div className="sheet-content draft-content">
      <p className="draft-note">Черновик заказа сохраняется в этом браузере.</p>
      {draft.length === 0 && <div className="draft-empty"><span className="paper-driver" aria-hidden="true" /><p>Заказ пока пуст</p><small>Выберите покрытие и нажмите «В заказ».</small></div>}
      <ul className="draft-items">{draft.map(row => {
        const product = stock.find(entry => sameProduct(entry, row));
        const current = product && stockForDisplay(product);
        const available = current?.warehouses.find(entry => entry.name === row.warehouse)?.qty || 0;
        return <li key={lineId(row)}>
          <div><strong>{current?.displaySku || row.displaySku || row.sku} {current?.name || row.name}</strong>
            <p>{row.warehouse} · {number(row.qty)} м²</p>
            {available < row.qty && <small className="draft-warning">Сейчас доступно {number(available)} м²</small>}
          </div>
          {current && <button className="square-button" onClick={() => setEdit(row)} aria-label={'Изменить ' + row.name}><Pencil size={17} /></button>}
          <button className="square-button" onClick={() => deleteRow(row)} aria-label={'Удалить ' + row.name}><Trash2 size={17} /></button>
        </li>;
      })}</ul>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="button" onClick={onClose}>Продолжить подбор</button>
    </div>}
  </dialog>;
}

export default function OrderDraft(props) {
  return props.panel ? <DraftSheet {...props} /> : null;
}
