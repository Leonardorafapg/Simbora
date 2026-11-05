export type Client = {
  id: number;
  name: string;
  photo_url: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_group_id: string | null;
  instagram: string | null;
  notes: string | null;
  default_social_id: number | null;
  default_designer_id: number | null;
  is_active: boolean;
};

/** O mínimo pra mostrar e escolher um cliente (Produção, revisão, dashboard): sem contato nem notas. */
export type ClientRef = Pick<Client, "id" | "name" | "photo_url" | "default_social_id" | "default_designer_id" | "is_active">;

export type ClientCreateInput = {
  name: string;
  photo_url?: string | null;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp_group_id?: string;
  instagram?: string;
  notes?: string;
  default_social_id?: number | null;
  default_designer_id?: number | null;
};

export type ClientUpdateInput = Partial<{
  name: string;
  photo_url: string | null;
  contact_name: string;
  email: string;
  phone: string;
  whatsapp_group_id: string;
  instagram: string;
  notes: string;
  default_social_id: number | null;
  default_designer_id: number | null;
  is_active: boolean;
}>;
