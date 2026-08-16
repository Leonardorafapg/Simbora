import { getInitials } from "@/lib/format";

type Props = {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: "h-9 w-9 text-sm",
  md: "h-12 w-12 text-lg",
  lg: "h-16 w-16 text-xl",
};

export default function Avatar({ name, photoUrl, size = "md" }: Props) {
  return (
    <div
      className={`${SIZES[size]} rounded-full bg-cyan text-black flex items-center justify-center font-bold overflow-hidden shrink-0`}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitrária, sem loader configurado
        <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}
