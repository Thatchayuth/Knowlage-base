import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  fetchMenu,
  fetchKnowledge,
  adminCreateKnowledge,
  adminUpdateKnowledge,
} from '../../api/services'
import { useToast } from '../../components/ui/Toast'
import KnowledgeForm from '../../components/admin/KnowledgeForm'
import Spinner from '../../components/ui/Spinner'

export default function KnowledgeFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [level1List, setLevel1List] = useState(location.state?.level1List || [])
  const [loadingOptions, setLoadingOptions] = useState(level1List.length === 0)
  const [initial, setInitial] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (level1List.length) {
      setLoadingOptions(false)
      return
    }
    let mounted = true
    fetchMenu()
      .then(menu => {
        if (!mounted) return
        setLevel1List(menu.map(l1 => ({
          id: l1.id,
          name: l1.name,
          level2: l1.level2 || [],
        })))
      })
      .catch(() => toast({ message: 'Failed to load categories', type: 'error' }))
      .finally(() => { if (mounted) setLoadingOptions(false) })
    return () => { mounted = false }
  }, [level1List.length, toast])

  useEffect(() => {
    if (!isEdit) {
      setLoadingDetail(false)
      return
    }
    let mounted = true
    fetchKnowledge(id)
      .then(item => {
        if (!mounted) return
        setInitial({
          id: item.Id,
          level1Id: item.Level1Id,
          level2Id: item.Level2Id,
          title: item.Title,
          displayMode: item.DisplayMode,
          contentHtml: item.ContentHtml,
          pdfUrl: item.PdfUrl,
          videoUrl: item.VideoUrl,
          highlight: Boolean(item.Highlight),
          sortOrder: item.SortOrder,
        })
      })
      .catch(() => {
        if (mounted) {
          toast({ message: 'Failed to load knowledge item', type: 'error' })
          navigate('/administrator/knowledge')
        }
      })
      .finally(() => { if (mounted) setLoadingDetail(false) })
    return () => { mounted = false }
  }, [id, isEdit, navigate, toast])

  const handleSubmit = async (data) => {
    setSaving(true)
    try {
      if (isEdit) {
        await adminUpdateKnowledge(id, data)
        toast({ message: 'Knowledge item updated', type: 'success' })
      } else {
        await adminCreateKnowledge(data)
        toast({ message: 'Knowledge item created', type: 'success' })
      }
      navigate('/administrator/knowledge')
    } catch (e) {
      toast({ message: e.response?.data?.error || 'Save failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const loading = loadingOptions || loadingDetail
  const title = isEdit ? 'Edit Knowledge Item' : 'New Knowledge Item'

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <p className="text-xs font-mono text-steel-500 mb-1">{isEdit ? 'Modify content or metadata' : 'Create a new knowledge entry'}</p>
        <h1 className="font-display font-bold text-2xl text-brand-ink">{title}</h1>
      </div>
      <div className="panel p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : (
          <KnowledgeForm
            initialData={initial}
            level1List={level1List}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/administrator/knowledge')}
            loading={saving}
          />
        )}
      </div>
    </div>
  )
}
