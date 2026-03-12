import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { adminCreateLevel1, adminUpdateLevel1, fetchMenu } from '../../api/services'
import { useToast } from '../../components/ui/Toast'
import Level1Form from '../../components/admin/Level1Form'
import Spinner from '../../components/ui/Spinner'

export default function Level1FormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  const [initial, setInitial] = useState(location.state?.item || null)
  const [loading, setLoading] = useState(isEdit && !location.state?.item)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEdit || initial) return
    let mounted = true

    fetchMenu()
      .then(menu => {
        if (!mounted) return
        const found = menu.find(l1 => String(l1.id) === id)
        setInitial(found ? { id: found.id, name: found.name, sortOrder: found.sortOrder, icon: found.icon } : null)
      })
      .catch(() => {
        if (mounted) toast({ message: 'Failed to load category', type: 'error' })
      })
      .finally(() => { if (mounted) setLoading(false) })

    return () => { mounted = false }
  }, [id, isEdit, initial, toast])

  const handleSubmit = async (data) => {
    setSaving(true)
    try {
      if (isEdit) {
        await adminUpdateLevel1(id, data)
        toast({ message: 'Category updated', type: 'success' })
      } else {
        await adminCreateLevel1(data)
        toast({ message: 'Category created', type: 'success' })
      }
      navigate('/administrator/level1')
    } catch (e) {
      toast({ message: e.response?.data?.error || 'Save failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const title = isEdit ? 'Edit Level 1 Category' : 'New Level 1 Category'

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-6">
        <p className="text-xs font-mono text-steel-500 mb-1">{isEdit ? 'Update existing category' : 'Create a new top-level category'}</p>
        <h1 className="font-display font-bold text-2xl text-brand-ink">{title}</h1>
      </div>
      <div className="panel p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : (
          <Level1Form
            initialData={initial}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/administrator/level1')}
            loading={saving}
          />
        )}
      </div>
    </div>
  )
}
