import {
  Bell,
  Menu,
  Plus,
  Trash2,
  X,
  Clock,
  AlertTriangle,
  MessageSquare,
  RefreshCw,
  FilePlus2,
  Ban,
  Search,
  Sun,
  Moon,
  ArrowLeft,
  CornerDownRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  ClipboardList,
  Home,
  LayoutDashboard,
  Users,
  MoreHorizontal,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  Snowflake,
  FileText,
} from 'lucide-react'

// Fonte UNICA dos icones do app (§issue #9). Uso: <Icone nome="sino" />.
// Os icones do lucide usam stroke="currentColor", entao herdam a cor do texto;
// 'size' (px) e 'strokeWidth' ajustaveis por prop.
const MAPA = {
  sino: Bell,
  menu: Menu,
  mais: Plus,
  lixeira: Trash2,
  fechar: X,
  relogio: Clock,
  aviso: AlertTriangle,
  chat: MessageSquare,
  atualizar: RefreshCw,
  nova: FilePlus2,
  cancelado: Ban,
  lupa: Search,
  sol: Sun,
  lua: Moon,
  voltar: ArrowLeft,
  'seta-filha': CornerDownRight,
  'chevron-baixo': ChevronDown,
  'chevron-cima': ChevronUp,
  'chevron-direita': ChevronRight,
  'zoom-mais': ZoomIn,
  'zoom-menos': ZoomOut,
  lista: ClipboardList,
  casa: Home,
  painel: LayoutDashboard,
  clientes: Users,
  'mais-opcoes': MoreHorizontal,
  email: Mail,
  cadeado: Lock,
  olho: Eye,
  'olho-fechado': EyeOff,
  check: Check,
  neve: Snowflake,
  arquivo: FileText,
}

export default function Icone({ nome, size = 18, strokeWidth = 2, className }) {
  const Componente = MAPA[nome]
  if (!Componente) return null
  return (
    <Componente
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
    />
  )
}
