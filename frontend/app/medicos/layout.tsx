import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Médico em Evidência | Simbora Maranhão",
  description: "Construímos sua autoridade digital em 90 dias para que pacientes te encontrem, te sigam e te escolham.",
};

export default function MedicosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#FFFFFF", color: "#0D0D0D" }} className="min-h-screen">
      {children}
    </div>
  );
}
