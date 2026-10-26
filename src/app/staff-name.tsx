export default function StaffName({ name }: { name: string }) {
  const bracketIndex = name.search(/[（(]/);

  if (bracketIndex < 0) return <>{name}</>;

  return (
    <span>
      {name.slice(0, bracketIndex)}
      <span className="staff-name-detail">{name.slice(bracketIndex)}</span>
    </span>
  );
}
