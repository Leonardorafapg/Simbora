// Cache em memória, por aba, sem TTL/persistência: só existe pra evitar que
// o prefetch da splash de login e o primeiro fetch de cada hook (useClients,
// useTeamMembers) disparem duas requisições pro mesmo dado. Não é usado como
// fonte de verdade — cada hook segue dono do próprio estado depois de ler daqui.
const cache = new Map<string, Promise<unknown>>();

export function getOrFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached) return cached as Promise<T>;

  const promise = fetcher().catch((err) => {
    // Não guarda falha em cache — próxima leitura tenta buscar de novo.
    cache.delete(key);
    throw err;
  });
  cache.set(key, promise);
  return promise;
}

// Chamado depois de create/update/remove: a lista em cache ficou desatualizada,
// então a próxima página que montar o hook busca de novo em vez de herdar o
// array velho (o componente que fez a mutação já atualiza o próprio estado local).
export function invalidate(key: string): void {
  cache.delete(key);
}

// Chamado no logout: o cache vive na memória da aba (SPA), então sem isso o
// próximo login nessa mesma aba herdaria clientes/equipe do usuário anterior.
export function clearAll(): void {
  cache.clear();
}
