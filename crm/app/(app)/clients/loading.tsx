import ClientGridSkeleton from "@/components/clients/ClientGridSkeleton";
import PageHeader from "@/components/ui/PageHeader";

/** Mostrado pelo Next enquanto a página de clientes carrega no servidor. */
export default function Loading() {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-8">
      <PageHeader title="Clientes" description="Cadastre e acompanhe os clientes e seus responsáveis." />
      <ClientGridSkeleton />
    </div>
  );
}
