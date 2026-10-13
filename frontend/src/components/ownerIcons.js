import { User, LayoutDashboard, FileText, Wallet, BarChart3, Package, Users, PlusCircle, GraduationCap, Armchair, UserPlus, BadgePercent, LayoutGrid, Clock, BookOpen, Receipt, Store } from 'lucide-react'
export const ICONS = { User, LayoutDashboard, FileText, Wallet, BarChart3, Package, Users, PlusCircle, GraduationCap, Armchair, UserPlus, BadgePercent, LayoutGrid, Clock, BookOpen, Receipt, Store }
export const iconOf = (name) => ICONS[name] || PlusCircle
