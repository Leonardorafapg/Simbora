import type { Client, ClientCreateInput, ClientUpdateInput } from "@/types/client";

async function parseErrorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return data.message ?? fallback;
}

export async function fetchClients(): Promise<Client[]> {
  const res = await fetch("/api/clients");
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível carregar os clientes."));
  return res.json();
}

export async function createClient(input: ClientCreateInput): Promise<Client> {
  const res = await fetch("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível cadastrar o cliente."));
  return res.json();
}

export async function updateClient(id: number, input: ClientUpdateInput): Promise<Client> {
  const res = await fetch(`/api/clients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível salvar as alterações."));
  return res.json();
}

export async function deleteClient(id: number): Promise<void> {
  const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível remover o cliente."));
}
