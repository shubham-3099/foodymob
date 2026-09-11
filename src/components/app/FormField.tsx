export function Field({
  name,
  label,
  type = "text",
  required = true,
  placeholder = "",
  value,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  value?: string | number;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={value}
        step={type === "number" ? "any" : undefined}
        min={type === "number" ? 0 : undefined}
      />
    </label>
  );
}
