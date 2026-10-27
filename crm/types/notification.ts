export type AppNotification = {
  id: number;
  /** agenda_convite | agenda_alterada | agenda_removido | agenda_cancelada | ... */
  type: string;
  title: string;
  body: string | null;
  /** Rota do CRM que abre ao clicar. */
  link: string | null;
  created_at: string;
  read_at: string | null;
};
