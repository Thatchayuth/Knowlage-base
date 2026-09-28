import { useEffect, useState } from 'react'

// Smooth expand / collapse.
// Animates height via grid-template-rows 0fr ↔ 1fr, and keeps children
// mounted until the closing transition ends.
const COLLAPSE_MS = 300

export default function Collapse({ open, children }) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown]     = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      // Two frames: mount at 0fr first, then transition to 1fr.
      let id2
      const id1 = requestAnimationFrame(() => { id2 = requestAnimationFrame(() => setShown(true)) })
      return () => { cancelAnimationFrame(id1); cancelAnimationFrame(id2) }
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), COLLAPSE_MS)
    return () => clearTimeout(t)
  }, [open])

  if (!mounted) return null
  return (
    <div
      className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
      style={{ gridTemplateRows: shown ? '1fr' : '0fr', opacity: shown ? 1 : 0 }}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
