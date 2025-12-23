// client/src/ui/Icon.jsx
// Temporary shim: exposes a FontAwesome-like Icon API but renders lucide icons for now.
// Once @fortawesome packages are installed, swap implementation here only.
import React from 'react';
import {
  Plus, HelpCircle, Search, RefreshCw, Send, Eye, EyeOff, Copy,
  Trash2, Play, Square, Settings, Database, Globe, Server, Zap,
  MessageSquare, Layers, List as ListIcon
} from 'lucide-react';

const map = {
  // Common FA names mapped to lucide fallbacks
  'plus': Plus,
  'circle-question': HelpCircle,
  'magnifying-glass': Search,
  'arrows-rotate': RefreshCw,
  'paper-plane': Send,
  'eye': Eye,
  'eye-slash': EyeOff,
  'copy': Copy,
  'trash-can': Trash2,
  'play': Play,
  'square': Square,
  'gear': Settings,
  'database': Database,
  'globe': Globe,
  'server': Server,
  'bolt': Zap,
  'message-square': MessageSquare,
  'layers': Layers,
  'list': ListIcon,
};

export default function Icon({ name, size = 16, className = '' }) {
  const Cmp = map[name] || map['question-circle'] || HelpCircle;
  return <Cmp size={size} className={className} />;
}