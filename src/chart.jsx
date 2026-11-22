import { useId } from 'react';
import { money } from './model';
export function Chart({ month, sold, target }) {
  const gradientId = useId().replace(/:/g, '');
  const [year, monthNumber] = month.split('-').map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  const now = new Date();
  const currentMonth = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Minsk' }).format(now).slice(0, 7);
  const currentDay = +new Intl.DateTimeFormat('ru', { day: 'numeric', timeZone: 'Europe/Minsk' }).format(now);
  const lastSale = sold.reduce((last, order) => Math.max(last, +order.saleDate.slice(-2)), 0);
  const end = Math.min(days, Math.max(lastSale, month === currentMonth ? currentDay : days, 1));
  const values = Array(days).fill(0);
  for (const order of sold) values[Number(order.saleDate.slice(-2)) - 1] += order.amount;
  let total = 0;
  const cumulative = values.slice(0, end).map(value => total += value);
  const max = Math.max(1000, Math.ceil(Math.max(total, target) / 3000) * 3000);
  const x = day => 42 + (day - 1) * 286 / (days - 1);
  const y = value => 151 - value * 124 / max;
  const axisLabel = value => value >= 1_000_000 ? `${Number((value / 1_000_000).toFixed(1))} м` : value >= 1000 ? `${Number((value / 1000).toFixed(1))} к` : String(Math.round(value));
  const path = cumulative.map((value, index) => `${index ? 'L' : 'M'}${x(index + 1)} ${y(value)}`).join(' ');
  return <svg className="sales-chart" viewBox="0 0 344 185" role="img" aria-label={`Продажи нарастающим итогом: ${money(total)} BYN${target ? `, план: ${money(target)} BYN` : ''}`}>
    <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#808080" stopOpacity=".20" /><stop offset="1" stopColor="#808080" stopOpacity=".015" /></linearGradient></defs>
    {[0, 1, 2, 3].map(step => <g key={step}><line x1="42" x2="328" y1={y(step * max / 3)} y2={y(step * max / 3)} stroke="#e8e8e8" strokeDasharray="3 5" /><text x="2" y={y(step * max / 3) + 4}>{axisLabel(step * max / 3)}</text></g>)}
    {target > 0 && <path d={`M42 151L328 ${y(target)}`} fill="none" stroke="#a4a4a4" strokeDasharray="5 5" strokeWidth="1.5" />}
    <path d={`${path} L${x(end)} 151 L42 151Z`} fill={`url(#${gradientId})`} /><path d={path} fill="none" stroke="#808080" strokeWidth="2.5" strokeLinejoin="round" /><circle cx={x(end)} cy={y(total)} r="4" fill="#808080" stroke="#fff" strokeWidth="2" />
    {[1, 10, 20, days].map(day => <text key={day} x={x(day)} y="176" textAnchor="middle">{String(day).padStart(2, '0')}</text>)}
  </svg>;
}
