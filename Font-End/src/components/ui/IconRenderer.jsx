import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { far } from '@fortawesome/free-regular-svg-icons'
import { fab } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

library.add(fas, far, fab)

const DEFAULT_ICON = ['far', 'folder-open']

const ALIASES = {
  folder: DEFAULT_ICON,
  document: ['far', 'file-lines'],
  printer: ['fas', 'print'],
  monitor: ['fas', 'display'],
  globe: ['fas', 'globe'],
  book: ['fas', 'book'],
}

const STYLE_MAP = {
  'fa-solid': 'fas',
  'fa-regular': 'far',
  'fa-light': 'fal',
  'fa-thin': 'fat',
  'fa-duotone': 'fad',
  'fa-brands': 'fab',
  fas: 'fas',
  far: 'far',
  fab: 'fab',
}

function parseIcon(icon) {
  if (!icon || !icon.trim()) return DEFAULT_ICON
  const raw = icon.trim()
  const alias = ALIASES[raw.toLowerCase()]
  if (alias) return alias

  const parts = raw.split(/\s+/)
  let prefix = null
  let name = null

  for (const part of parts) {
    if (STYLE_MAP[part]) {
      prefix = STYLE_MAP[part]
      continue
    }
    if (part.startsWith('fa-') && part.length > 3) {
      const candidate = part.replace(/^fa-/, '')
      if (!candidate.startsWith('solid') && !candidate.startsWith('regular') && !candidate.startsWith('brands') && candidate !== 'fw') {
        name = candidate
      }
    }
  }

  if (!name) return DEFAULT_ICON
  return [prefix || 'far', name]
}

export default function IconRenderer({ icon, className = 'text-accent-500', size = 'lg' }) {
  const parsed = parseIcon(icon)
  return (
    <FontAwesomeIcon icon={parsed} className={className} fixedWidth size={size} />
  )
}
