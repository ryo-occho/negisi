import AppClient from './app-client';

export const dynamic = 'force-dynamic';

export default function Home() {
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
  }).format(new Date());
  const [year, month, day] = today.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1 + (day > 15 ? 1 : 0), 1));
  return (
    <AppClient
      initialMonth={next.toISOString().slice(0, 7)}
      initialHalf={day > 15 ? 'first' : 'second'}
    />
  );
}
