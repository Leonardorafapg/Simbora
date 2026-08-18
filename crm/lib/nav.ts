import { LayoutDashboard, Users, Briefcase, MessageCircle, ClipboardList, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Briefcase },
  { href: "/production", label: "Produção", icon: ClipboardList },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/team", label: "Equipe", icon: Users },
];
