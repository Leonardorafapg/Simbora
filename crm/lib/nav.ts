import {
  LayoutDashboard,
  Users,
  Briefcase,
  MessageCircle,
  ClipboardList,
  ClipboardCheck,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Briefcase },
  { href: "/production", label: "Produção", icon: ClipboardList },
  { href: "/aprovacoes", label: "Aprovações", icon: ClipboardCheck },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/team", label: "Equipe", icon: Users },
  { href: "/settings", label: "Configurações", icon: Settings },
];
