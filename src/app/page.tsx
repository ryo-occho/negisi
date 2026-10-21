import ShiftForm from './shift-form';

export default function Home() {
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
  }).format(new Date());
  return (
    <ShiftForm
      initialMonth={today.slice(0, 7)}
      initialHalf={Number(today.slice(8)) <= 15 ? 'first' : 'second'}
    />
  );
}
