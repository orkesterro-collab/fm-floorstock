import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, Layers, Package, Target, Users, BookOpen, Coins, ChevronRight, ChevronDown, CalendarDays, MoreHorizontal, X, Plus, Search, Truck, Check, Building2, Info, RefreshCw, FileText, LogIn, ShoppingBag } from 'lucide-react';
import { demo, updateDemoCatalogue, visible, apply, period, monthLabel, money, totals, statuses, categories } from './model';
import StockScreen from './StockScreen';
import OrderDraft, { useOrderDraft } from './OrderDraft';
import { Chart } from './chart';
import { parseCsv } from './csv';

const STORAGE_KEY = 'floorstock-fm-mobile-demo-v1';
const ROLES = { admin: 'Флорсток', director: 'Директор магазина', seller: 'Продавец' };
const PAGES = {
  'Обзор': ['Обзор', LayoutDashboard], 'Остатки': ['Остатки покрытий', Layers], 'Заказы': ['Заказы', Package],
  'Планы продаж': ['План продаж', Target], 'Команда': ['Команда магазина', Users], 'Баллы': ['Баллы за продажи', Coins],
  'Материалы': ['Материалы партнёра', BookOpen], 'Ещё': ['Ваш кабинет', MoreHorizontal],
};
const PRIMARY_PAGES = ['Обзор', 'Остатки', 'Заказы', 'Ещё'];
const LOCAL_NOTE = 'Демонстрация: изменения сохраняются только в этом браузере.';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Minsk' }).format(new Date());
const dateLabel = value => value ? `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}` : '—';
const initials = name => name.split(' ').slice(0, 2).map(part => part[0]).join('');
const countLabel = (count, forms) => forms[count % 100 >= 11 && count % 100 <= 14 ? 2 : count % 10 === 1 ? 0 : count % 10 >= 2 && count % 10 <= 4 ? 1 : 2];
const validState = value => value && ['shops', 'people', 'stock', 'orders', 'posts'].every(key => Array.isArray(value[key])) && value.plans && value.feeds && value.people.some(person => person.role === 'director' && person.shop === 'p-101') && value.people.some(person => person.role === 'seller' && person.shop === 'p-101');
function readState(fallback) {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY)); return validState(value) ? updateDemoCatalogue(value) : fallback; }
  catch { return fallback; }
}
function Badge({ status }) { return <span className={`status status-${statuses.indexOf(status)}`}>{status}</span>; }
function Field({ label, children, hint }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
function Select({ children, ...props }) { return <span className="select-wrap"><select {...props}>{children}</select><ChevronDown size={18} aria-hidden="true" /></span>; }
function Empty({ icon: Icon = Package, title, text }) { return <div className="empty-state"><Icon size={30} strokeWidth={1.5} aria-hidden="true" /><h3>{title}</h3>{text && <p>{text}</p>}</div>; }
function SectionTitle({ title, children }) { return <div className="section-heading"><h2>{title}</h2>{children}</div>; }

export default function App() {
  const [sample, setSample] = useState(() => readState(demo()));
  const [role, setRole] = useState('director');
  const [shop, setShop] = useState('p-101');
  const [page, setPage] = useState(() => window.location.hash === '#stock' ? 'Остатки' : 'Обзор');
  const [draftPanel, setDraftPanel] = useState(null);
  const [month, setMonth] = useState(period());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const dialog = useRef(null);
  const titleRef = useRef(null);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { const sync = event => { if (event.key === STORAGE_KEY) setSample(readState(demo())); }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, []);
  useEffect(() => {
    const element = dialog.current; if (!element) return;
    if (modal) { if (!element.open) element.showModal(); document.body.classList.add('sheet-open'); }
    else { if (element.open) element.close(); document.body.classList.remove('sheet-open'); }
    return () => document.body.classList.remove('sheet-open');
  }, [modal]);
  const user = role === 'admin' ? { id: 'fs', name: 'Флорсток', role: 'admin', shop: '' } : sample.people.find(person => person.role === role && person.shop === 'p-101');
  const state = visible(sample, user);
  const admin = role === 'admin', seller = role === 'seller';
  const shopId = admin ? state.shops.find(item => item.id === shop)?.id || state.shops[0]?.id || '' : user.shop;
  const { draft, save, remove } = useOrderDraft(user.id, shopId);
  const draftCount = new Set(draft.map(line => line.displaySku || line.sku)).size;
  const company = state.shops.find(item => item.id === shopId)?.name || 'Магазин';
  const orders = state.orders.filter(order => order.shop === shopId).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const people = state.people.filter(person => person.shop === shopId);
  const { sales, sold } = totals(orders, month);
  const points = totals(orders.filter(order => order.seller), month).points;
  const target = state.plans[`${shopId}/${month}`] || 0;
  const percentage = target ? Math.round(sales / target * 100) : 0;
  const pendingOrders = orders.filter(order => statuses.indexOf(order.status) >= 0 && statuses.indexOf(order.status) < 3);
  const personName = id => state.people.find(person => person.id === id)?.name || 'Без привязки';
  const filteredOrders = orders.filter(order => (!filter || order.status === filter) && `${order.id} ${order.name}`.toLowerCase().includes(query.trim().toLowerCase()));
  const morePages = ['Планы продаж', 'Команда', 'Баллы', 'Материалы'].filter(name => !seller || !['Планы продаж', 'Команда'].includes(name));
  function go(nextPage) {
    if (nextPage === 'Остатки' || window.location.hash === '#stock') {
      const url = new URL(window.location.href);
      url.hash = nextPage === 'Остатки' ? 'stock' : '';
      window.history.replaceState(null, '', url);
    }
    setPage(nextPage); setQuery(''); setFilter(''); window.scrollTo({ top: 0, behavior: 'instant' }); requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true })); }
  function openModal(name, order) { setError(''); if (order) setSelected(order); setModal(name); }
  function closeModal() { if (!busy) { setModal(null); setError(''); } }
  function persist(next) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { throw new Error('Браузер не смог сохранить изменения. Проверьте доступное место и настройки хранения.'); } setSample(next); }
  async function submit(event) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); setBusy(true); setError('');
    try {
      const fresh = structuredClone(readState(sample)); let action;
      if (modal === 'План на месяц') action = { type: 'plan', shop: shopId, month: values.month, amount: Number(values.amount) };
      if (modal === 'Приглашение') action = { type: 'invite', shop: shopId, ...values };
      if (modal === 'Новый магазин') action = { type: 'shop', ...values };
      if (modal === 'Публикация') action = { type: 'publish', ...values };
      if (modal === 'Импорт остатков') { if (values.file.size > 1_600_000) throw new Error('Выберите CSV размером не больше 1,6 МБ.'); action = { type: 'stock', source: `Поставщик · ${values.source.trim()}`, rows: parseCsv(await values.file.text()) }; }
      if (modal === 'Новый заказ') {
        const product = fresh.stock.find(item => item.sku === values.sku && item.price != null);
        if (!product) throw new Error('У выбранного покрытия нет цены.');
        if (fresh.orders.some(order => order.shop === shopId && order.id === values.id.trim())) throw new Error('Такой номер заказа уже используется.');
        action = { type: 'order', order: { id: values.id, shop: shopId, seller: values.seller, sku: product.sku, name: product.name, qty: Number(values.qty), amount: Number(values.qty) * product.price, status: 'Принят', revision: 1, date: today(), saleDate: '' } };
      }
      if (modal === 'Заказ') {
        const current = fresh.orders.find(order => order.shop === shopId && order.id === selected.id);
        if (!current || current.revision !== selected.revision) throw new Error('Заказ изменился. Закройте карточку и откройте его снова.');
        action = { type: 'order', order: { ...current, status: values.status, saleDate: current.saleDate || (['Отгружен', 'Возврат'].includes(values.status) ? today() : ''), revision: current.revision + 1 } };
      }
      if (!action) throw new Error('Не удалось определить действие. Откройте форму снова.');
      apply(fresh, user, action); persist(fresh); setModal(null); setNotice(modal === 'Приглашение' ? 'Приглашение добавлено в демо. Письмо не отправлено.' : 'Сохранено в демо-кабинете');
    } catch (failure) { setError(failure.message || 'Не удалось сохранить изменения.'); } finally { setBusy(false); }
  }
  function changeRole(nextRole) { setDraftPanel(null); setRole(nextRole); setShop('p-101'); setModal(null); go('Обзор'); }
  function resetDemo() { try { persist(demo()); setRole('director'); setShop('p-101'); setMonth(period()); setModal(null); go('Обзор'); setNotice('Демонстрационные данные восстановлены'); } catch (failure) { setError(failure.message); } }
  function orderCards(rows) {
    return rows.length ? <div className="order-list">{rows.map(order => <button className="order-card" key={`${order.shop}/${order.id}`} onClick={() => openModal('Заказ', order)} aria-label={`Заказ ${order.id}, ${order.name}, ${order.status}`}>
      <span className="order-card-top"><strong>{order.id}</strong><span className="secondary-text">{dateLabel(order.date)}</span></span><span className="order-name">{order.name}</span>
      <span className="order-card-bottom"><Badge status={order.status} /><strong className="amount">{money(order.amount)} <span>BYN</span></strong></span>
    </button>)}</div> : <Empty title="Заказов пока нет" text={query || filter ? 'Попробуйте другое название или статус.' : 'Здесь появятся заказы выбранного магазина.'} />;
  }
  const monthControl = <label className="month-control"><CalendarDays size={18} aria-hidden="true" /><span>{monthLabel(month)}</span><ChevronDown size={16} aria-hidden="true" /><input type="month" aria-label="Отчётный месяц" value={month} onChange={event => event.target.value && setMonth(event.target.value)} onClick={event => { try { event.currentTarget.showPicker(); } catch {} }} /></label>;
  const productOptions = state.stock.filter((item, index, all) => item.price != null && all.findIndex(candidate => candidate.sku === item.sku && candidate.price != null) === index);
  return <div className="app-frame">
    <header className="app-header"><button className="brand" onClick={() => go('Обзор')} aria-label="Флорсток — обзор"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Флорсток<small>Кабинет партнёра</small></span></button><button className="header-draft" onClick={() => setDraftPanel({review: true})} aria-label={`Мой заказ, позиций: ${draftCount}`}>
        <span className="header-draft-icon"><Truck size={26} aria-hidden="true" />{draftCount > 0 && <span className="header-draft-count">{draftCount}</span>}</span>
        <span>Мой заказ</span>
      </button></header>
    {page !== 'Остатки' && <div className="demo-strip"><span className="demo-label">Демо</span><span>Данные примера</span><button onClick={() => openModal('Рабочий доступ')} aria-label="О демонстрационной версии"><Info size={17} /><span>Подробнее</span></button></div>}
    <main className="main-content">
      {page !== 'Остатки' && <div className="page-heading"><p className="eyebrow">{company} <span>·</span> {ROLES[role]}</p><h1 ref={titleRef} tabIndex={-1}>{PAGES[page][0]}</h1>{['Обзор', 'Планы продаж', 'Баллы'].includes(page) && monthControl}</div>}
      {admin && <div className="admin-context"><Field label="Магазин"><Select aria-label="Выбрать магазин" value={shopId} onChange={event => { setDraftPanel(null); setShop(event.target.value); }}>{state.shops.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><button className="square-button" aria-label="Добавить магазин" onClick={() => openModal('Новый магазин')}><Plus size={20} /></button></div>}
      {page === 'Обзор' && <>
        <section className="sales-hero" aria-label={seller ? 'Мои продажи' : 'Объём продаж'}><div className="hero-label"><ShoppingBag size={19} /><span>{seller ? 'Мои продажи' : 'Продажи магазина'}</span></div><div className="hero-amount">{money(sales)} <span>BYN</span></div><p>По отгруженным заказам за месяц</p><div className="hero-bottom"><span>{sold.length} {countLabel(sold.length, ['отгрузка', 'отгрузки', 'отгрузок'])}</span><button onClick={() => go(seller ? 'Баллы' : 'Планы продаж')}>Подробнее <ChevronRight size={17} /></button></div></section>
        <div className="metric-grid"><button className="metric-card" onClick={() => go('Заказы')}><span className="metric-label"><Package size={19} />В работе</span><strong>{pendingOrders.length}<small>{countLabel(pendingOrders.length, ['заказ', 'заказа', 'заказов'])}</small></strong><span className="metric-foot">От приёма до выдачи</span></button><button className="metric-card" onClick={() => go('Баллы')}><span className="metric-label"><Coins size={19} />{seller ? 'Мои баллы' : 'Баллы команды'}</span><strong>{money(points)}<small>балл.</small></strong><span className="metric-foot">За отгрузки в месяце</span></button></div>
        {!seller && <section className="card plan-card"><SectionTitle title="Выполнение плана"><span className="plan-percent">{target ? `${percentage}%` : '—'}</span></SectionTitle><div className="progress-track" role="progressbar" aria-label="Выполнение плана продаж" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(percentage, 100)}><span style={{ width: `${Math.min(percentage, 100)}%` }} /></div><div className="plan-summary"><span>{target ? `${money(sales)} из ${money(target)} BYN` : 'План на этот месяц ещё не задан'}</span><button className="inline-link" onClick={() => go('Планы продаж')}>Открыть</button></div></section>}
        <section className="card chart-card"><SectionTitle title="Динамика продаж"><span className="secondary-text">BYN</span></SectionTitle><div className="chart-legend"><span><i />Продажи</span>{target > 0 && <span><i className="legend-plan" />План</span>}</div><Chart month={month} sold={sold} target={target} /></section>
        <section className="recent-section"><SectionTitle title="Последние заказы"><button className="inline-link" onClick={() => go('Заказы')}>Все заказы</button></SectionTitle>{orderCards(orders.slice(0, 3))}</section>
      </>}
      {page === 'Остатки' && <StockScreen stock={state.stock} feeds={state.feeds} draft={draft}
        onAdd={item => setDraftPanel({item})} onImport={admin ? () => openModal('Импорт остатков') : undefined} />}
      {page === 'Заказы' && <>
        {admin && <button className="primary-button page-action" onClick={() => openModal('Новый заказ')}><Plus size={19} />Новый демо-заказ</button>}
        <div className="search-controls"><label className="search-field"><Search size={20} aria-hidden="true" /><input aria-label="Поиск заказа" value={query} onChange={event => setQuery(event.target.value)} placeholder="Номер или покрытие" />{query && <button aria-label="Очистить поиск" onClick={() => setQuery('')}><X size={18} /></button>}</label><Select aria-label="Статус заказа" value={filter} onChange={event => setFilter(event.target.value)}><option value="">Все статусы</option>{statuses.map(status => <option key={status}>{status}</option>)}</Select></div>
        <div className="list-intro"><p>{seller ? 'Мои заказы' : 'Заказы магазина'} · {filteredOrders.length}</p></div>{orderCards(filteredOrders)}
      </>}
      {page === 'Планы продаж' && <>
        <section className="sales-hero plan-hero"><div className="hero-label"><Target size={20} /><span>План на месяц</span></div><div className="hero-amount">{target ? money(target) : '—'} <span>{target > 0 && 'BYN'}</span></div><p>{target ? `${percentage}% выполнено` : 'План ещё не задан'}</p><div className="progress-track"><span style={{ width: `${Math.min(percentage, 100)}%` }} /></div></section>
        <div className="metric-grid"><div className="metric-card"><span className="metric-label">Продано, BYN</span><strong>{money(sales)}</strong></div><div className="metric-card"><span className="metric-label">До плана, BYN</span><strong>{target ? money(Math.max(target - sales, 0)) : '—'}</strong></div></div>
        {admin && shopId && <button className="primary-button page-action" onClick={() => openModal('План на месяц')}><Target size={18} />{target ? 'Изменить план' : 'Задать план'}</button>}
        <section className="card chart-card"><SectionTitle title="План и факт" /><div className="chart-legend"><span><i />Факт</span><span><i className="legend-plan" />План</span></div><Chart month={month} sold={sold} target={target} /></section><p className="page-note">В факте учитываются отгруженные заказы. Полный возврат исключает продажу из расчёта.</p>
      </>}
      {page === 'Команда' && <>
        <button className="primary-button page-action" onClick={() => openModal('Приглашение')}><Plus size={19} />Пригласить сотрудника</button><div className="list-intro"><p>Сотрудники · {people.length}</p></div>
        <div className="people-list">{people.map(person => <article className="card person-card" key={person.id}><div className="person-top"><span className="person-avatar">{initials(person.name)}</span><div><h2>{person.name}</h2><p>{ROLES[person.role]}</p></div></div><div className="person-meta"><span className={person.pending ? 'pending-label' : 'active-label'}>{person.pending ? 'Демо-приглашение' : 'Активен в демо'}</span><span className="person-code">Код для 1С: <code>{person.id}</code></span></div></article>)}</div>
        <p className="page-note">Приглашения в демонстрации остаются в этом браузере. Письма сотрудникам не отправляются.</p>
      </>}
      {page === 'Баллы' && <>
        <section className="points-hero"><span className="points-icon"><Coins size={25} /></span><p>{seller ? 'Мои начисления' : 'Начисления команды'}</p><strong>{money(points)} <span>балл.</span></strong></section><div className="info-card"><Info size={19} /><p>1 балл за каждые полные 100 BYN в отгруженном заказе. Полный возврат снимает начисление.</p></div><SectionTitle title="История начислений" />
        <div className="points-list">{sold.filter(order => order.seller).map(order => <button className="card point-row" key={order.id} onClick={() => openModal('Заказ', order)}><span><strong>{order.id}</strong><span>{personName(order.seller)}</span><small>{money(order.amount)} BYN · {dateLabel(order.saleDate)}</small></span><strong className="point-value">+{Math.floor(order.amount / 100)}</strong></button>)}</div>
        {!sold.some(order => order.seller) && <Empty icon={Coins} title="Начислений пока нет" text="Баллы появятся после отгрузки заказов." />}
      </>}
      {page === 'Материалы' && <>
        {admin && <button className="primary-button page-action" onClick={() => openModal('Публикация')}><Plus size={19} />Добавить материал</button>}<div className="material-filters" aria-label="Раздел материалов">{['', ...categories].map(kind => <button key={kind} aria-pressed={filter === kind} className={filter === kind ? 'selected' : ''} onClick={() => setFilter(kind)}>{kind || 'Все'}</button>)}</div>
        <div className="material-list">{state.posts.filter(post => !filter || post.kind === filter).map(post => <article className="card material-card" key={post.id}><div className="material-meta"><span>{post.kind}</span><time dateTime={post.date}>{dateLabel(post.date)}</time></div><h2>{post.title}</h2><p>{post.body}</p>{post.url && <a className="material-link" href={post.url} target="_blank" rel="noopener noreferrer"><FileText size={18} />Открыть материал</a>}</article>)}</div>
        {!state.posts.some(post => !filter || post.kind === filter) && <Empty icon={BookOpen} title="Материалов пока нет" text="Здесь появятся публикации выбранного раздела." />}
      </>}
      {page === 'Ещё' && <>
        <button className="card profile-card" onClick={() => openModal('Профиль')}><span className="person-avatar">{initials(user.name)}</span><span><strong>{user.name}</strong><small>{ROLES[role]}</small></span><ChevronRight size={20} /></button>
        <div className="card more-menu">{morePages.map(name => { const Icon = PAGES[name][1]; return <button key={name} onClick={() => go(name)}><span className="menu-icon"><Icon size={21} /></span><span>{name}</span><ChevronRight size={19} /></button>; })}</div>
        <div className="card more-menu secondary-menu"><button onClick={() => openModal('Рабочий доступ')}><span className="menu-icon"><LogIn size={21} /></span><span>Рабочий доступ</span><ChevronRight size={19} /></button><button onClick={() => openModal('Сбросить демонстрацию')}><span className="menu-icon"><RefreshCw size={20} /></span><span>Сбросить демо</span><ChevronRight size={19} /></button></div>
        <p className="page-note">Мобильный кабинет Флорсток.<br />Демонстрационные данные — только для знакомства с возможностями.</p>
      </>}
      {['Остатки', 'Заказы', 'Баллы', 'Планы продаж'].includes(page) &&
        <div aria-hidden="true" className="paper-vignette" data-page={page} />}
    </main>
    <OrderDraft key={JSON.stringify([user.id, shopId])} panel={draftPanel} onClose={() => setDraftPanel(null)}
      stock={state.stock} draft={draft} save={save} remove={remove} />
    <nav className="bottom-nav" aria-label="Основная навигация">{PRIMARY_PAGES.map(name => { const Icon = PAGES[name][1]; const active = page === name || name === 'Ещё' && !PRIMARY_PAGES.includes(page); return <button key={name} onClick={() => go(name)} aria-current={active ? 'page' : undefined}><span className="nav-icon"><Icon size={22} strokeWidth={active ? 2.2 : 1.7} />{name === 'Заказы' && pendingOrders.length > 0 && <span className="nav-count" aria-label={`${pendingOrders.length} в работе`}>{pendingOrders.length}</span>}</span><span>{name}</span></button>; })}</nav>
    <dialog ref={dialog} className="bottom-sheet" aria-labelledby="sheet-title" onCancel={event => { event.preventDefault(); closeModal(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeModal(); } }}>
      {modal && <><div className="sheet-grip" aria-hidden="true" /><div className="sheet-heading"><h2 id="sheet-title">{modal === 'Заказ' ? selected.id : modal}</h2><button className="square-button" autoFocus aria-label="Закрыть окно" disabled={busy} onClick={closeModal}><X size={22} /></button></div>
        {modal === 'Профиль' ? <div className="sheet-content"><p className="sheet-description">Посмотрите кабинет в нужной роли.</p><div className="role-options">{Object.entries(ROLES).map(([value, label]) => <button key={value} className={role === value ? 'role-option chosen' : 'role-option'} onClick={() => changeRole(value)}><span><strong>{label}</strong><small>{value === 'admin' ? 'Все магазины и управление' : value === 'director' ? 'Команда и план магазина' : 'Личные продажи и баллы'}</small></span>{role === value && <Check size={21} />}</button>)}</div><p className="form-note">Роли в демо доступны для просмотра. Это не вход в рабочий аккаунт.</p><button className="secondary-button" onClick={() => openModal('Рабочий доступ')}><LogIn size={19} />Рабочий доступ</button></div>
          : modal === 'Рабочий доступ' ? <div className="sheet-content"><span className="access-icon"><Building2 size={30} /></span><h3>Пока знакомимся с кабинетом</h3><p className="sheet-description">Здесь можно проверить мобильные экраны, роли и действия на примерах. Остатки и заказы не связаны с реальной 1С.</p><p className="sheet-description">Рабочие аккаунты партнёров и обмен с 1С нужно подключить отдельно. Данные, которые вы меняете сейчас, сохраняются только в этом браузере.</p><button className="primary-button" onClick={closeModal}>Продолжить просмотр</button></div>
            : modal === 'Сбросить демонстрацию' ? <div className="sheet-content"><p className="sheet-description">Восстановить исходные примеры? Ваши изменения заказов, планов, остатков и команды в этом браузере будут удалены.</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" onClick={resetDemo}>Восстановить примеры</button><button className="secondary-button" onClick={closeModal}>Отмена</button></div>
              : <form className="sheet-content" onSubmit={submit}>
                {modal === 'Заказ' && <><div className="order-detail-title"><span className="secondary-text">{selected.sku}</span><h3>{selected.name}</h3><Badge status={selected.status} /></div><dl className="detail-list">{[['Магазин', company], ['Продавец', personName(selected.seller)], ['Дата заказа', dateLabel(selected.date)], ['Количество', `${money(selected.qty)} м²`], ['Сумма', `${money(selected.amount)} BYN`]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{admin && <Field label="Статус заказа"><Select name="status" defaultValue={selected.status}>{statuses.map(status => <option key={status}>{status}</option>)}</Select></Field>}</>}
                {modal === 'План на месяц' && <><Field label="Месяц"><input type="month" name="month" defaultValue={month} required /></Field><Field label="План продаж, BYN"><input type="number" inputMode="decimal" name="amount" min="0" max="1000000000" step="0.01" defaultValue={target || ''} required /></Field></>}
                {modal === 'Приглашение' && <><Field label="Имя сотрудника"><input name="name" autoComplete="off" maxLength={160} placeholder="Имя и фамилия" required /></Field><Field label="Email сотрудника"><input type="email" name="email" inputMode="email" autoComplete="off" maxLength={160} placeholder="name@example.com" required /></Field><Field label="Роль"><Select name="role"><option value="seller">Продавец</option>{admin && <option value="director">Директор магазина</option>}</Select></Field><div className="info-card"><Info size={18} /><p>Будет создано демо-приглашение. Письмо на этот адрес не отправляется.</p></div></>}
                {modal === 'Новый магазин' && <><Field label="Название магазина"><input name="name" maxLength={160} required /></Field><Field label="Код партнёра из 1С" hint="Латинские буквы, цифры, дефис или подчёркивание"><input name="id" autoCapitalize="none" autoComplete="off" pattern="[A-Za-z0-9_-]+" maxLength={160} required /></Field></>}
                {modal === 'Публикация' && <><Field label="Раздел"><Select name="kind">{categories.map(kind => <option key={kind}>{kind}</option>)}</Select></Field><Field label="Заголовок"><input name="title" maxLength={160} required /></Field><Field label="Текст"><textarea name="body" rows={4} maxLength={10000} required /></Field><Field label="Ссылка на документ или урок" hint="Для сертификата ссылка обязательна"><input type="url" name="url" inputMode="url" placeholder="https://" /></Field></>}
                {modal === 'Импорт остатков' && <><Field label="Название поставщика"><input name="source" maxLength={140} placeholder="Например, Север" required /></Field><Field label="CSV-файл в UTF-8"><input className="file-input" type="file" name="file" accept=".csv,text/csv" required /></Field><p className="sheet-description">Колонки: <code>sku;name;qty;type;price</code>. Первые три обязательны. Количество — в м². Импорт заменит остатки этого поставщика в демо.</p><a className="download-link" download="supplier-example.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent('\uFEFFsku;name;qty;type;price\nEV-101;Дуб Вирдия светлый;48,5;Ламинат;67')}`}><FileText size={18} />Скачать пример CSV</a></>}
                {modal === 'Новый заказ' && <><Field label="Номер заказа"><input name="id" maxLength={160} defaultValue={`ФС-${Date.now().toString().slice(-7)}`} required /></Field><Field label="Покрытие"><Select name="sku" required>{productOptions.map(product => <option key={product.sku} value={product.sku}>{product.name} · {money(product.price)} BYN/м²</option>)}</Select></Field><Field label="Количество, м²"><input type="number" name="qty" inputMode="decimal" min="0.001" max="1000000000" step="0.001" required /></Field><Field label="Продавец"><Select name="seller"><option value="">Без привязки</option>{people.filter(person => person.role === 'seller').map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</Select></Field></>}
                {error && <p className="form-error" role="alert">{error}</p>}{(modal !== 'Заказ' || admin) && <><p className="form-note">{LOCAL_NOTE}</p><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить в демо'}</button></>}
              </form>}
      </>}
    </dialog>
    {notice && <div className="toast" role="status"><Check size={18} /><span>{notice}</span></div>}
  </div>;
}
