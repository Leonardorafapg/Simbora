type Option = { id: number; full_name: string };

type Props = {
  options: Option[];
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function UserSelect({ options, value, onChange, placeholder = "Nenhum", disabled }: Props) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full disabled:opacity-60"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.full_name}
        </option>
      ))}
    </select>
  );
}
