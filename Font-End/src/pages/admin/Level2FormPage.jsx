import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { fetchMenu, adminCreateLevel2, adminUpdateLevel2 } from '../../api/services'
import { useToast } from '../../components/ui/Toast'
import Level2Form from '../../components/admin/Level2Form'
import Spinner from '../../components/ui/Spinner'

export default function Level2FormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  const [level1Options, setLevel1Options] = useState([])
  const [initial, setInitial] = useState(location.state?.item || null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    fetchMenu()
      .then(menu => {
        if (!mounted) return
        const normalized = menu.map(l1 => ({ id: l1.id, name: l1.name, level2: l1.level2 || [] }))
        setLevel1Options(normalized.map(l1 => ({ id: l1.id, name: l1.name })))
        if (isEdit && !initial) {
          for (const l1 of normalized) {
            const found = (l1.level2 || []).find(l2 => String(l2.id) === id)
            if (found) {
              setInitial({ id: found.id, name: found.name, level1Id: l1.id, sortOrder: found.sortOrder })
              break
            }
          }
        }
      })
      .catch(() => toast({ message: 'Failed to load categories', type: 'error' }))
      .finally(() => { if (mounted) setLoading(false) })

    return () => { mounted = false }
  }, [id, initial, isEdit, toast])

  const handleSubmit = async (data) => {
    setSaving(true)
    try {
      if (isEdit) {
        await adminUpdateLevel2(id, data)
        toast({ message: 'Sub-category updated', type: 'success' })
      } else {
        await adminCreateLevel2(data)
        toast({ message: 'Sub-category created', type: 'success' })
      }
      navigate('/administrator/level2')
    } catch (e) {
      toast({ message: e.response?.data?.error || 'Save failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const title = isEdit ? 'Edit Level 2 Sub-category' : 'New Level 2 Sub-category'

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-6">
        <p className="text-xs font-mono text-slate-500 mb-1">{isEdit ? 'Update name and sort order' : 'Attach a new sub-category to a Level 1 group'}</p>
        <h1 className="font-display font-bold text-2xl text-slate-100">{title}</h1>
      </div>
      <div className="panel p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : (
          <Level2Form
            initialData={initial}
            level1Options={level1Options}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/administrator/level2')}
            loading={saving}
            lockLevel1={isEdit}
          />
        )}
      </div>
    </div>
  )
}
