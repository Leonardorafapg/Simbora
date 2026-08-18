type Option = { id: number; name: string };

type Props = {
  options: Option[];
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  placeholder?: string;
};

export default function ClientSelect({ options, value, onChange, placeholder = "Nenhum" }: Props) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );
}
