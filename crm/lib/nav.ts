import {
  LayoutDashboard,
  Briefcase,
  CalendarClock,
  MessageCircle,
  ClipboardList,
  ClipboardCheck,
  SearchCheck,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Fora do menu lateral (atalho próprio: engrenagem da topbar, card em Configurações), mas segue na paleta. */
  hideInSidebar?: boolean;
  /** Chave de lib/permissions.ts exigida para o item aparecer no menu. Sem ela, todos veem. */
  permission?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "calendar.view" },
  { href: "/clients", label: "Clientes", icon: Briefcase, permission: "client.view" },
  { href: "/production", label: "Produção", icon: ClipboardList, permission: "calendar.view" },
  { href: "/revisao", label: "Revisão", icon: SearchCheck, permission: "post.review" },
  { href: "/aprovacoes", label: "Aprovações", icon: ClipboardCheck, permission: "calendar.approve" },
  { href: "/agenda", label: "Agenda", icon: CalendarClock },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, permission: "whatsapp.view" },
  { href: "/team", label: "Equipe", icon: Users, hideInSidebar: true },
  { href: "/settings", label: "Configurações", icon: Settings, hideInSidebar: true },
];
