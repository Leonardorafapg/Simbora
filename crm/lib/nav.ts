import { LayoutDashboard, Users, Briefcase, MessageCircle, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Briefcase },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/team", label: "Equipe", icon: Users },
];
