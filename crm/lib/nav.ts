import {
  LayoutDashboard,
  Briefcase,
  MessageCircle,
  ClipboardList,
  ClipboardCheck,
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
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Briefcase },
  { href: "/production", label: "Produção", icon: ClipboardList },
  { href: "/aprovacoes", label: "Aprovações", icon: ClipboardCheck },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/team", label: "Equipe", icon: Users, hideInSidebar: true },
  { href: "/settings", label: "Configurações", icon: Settings, hideInSidebar: true },
];
