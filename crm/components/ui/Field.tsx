export default function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-white/70">{label}</span>
      {children}
    </label>
  );
}
