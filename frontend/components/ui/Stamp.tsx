export function Stamp({
  children,
  tone = "ink",
}: {
  children: React.ReactNode;
  tone?: "ink" | "brass" | "danger" | "olive";
}) {
  const color = {
    ink: "border-ink text-ink",
    brass: "border-brass text-brass",
    danger: "border-danger text-danger",
    olive: "border-olive text-olive",
  }[tone];

  return (
    <span
      className={`inline-flex items-center border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${color}`}
    >
      {children}
    </span>
  );
}
