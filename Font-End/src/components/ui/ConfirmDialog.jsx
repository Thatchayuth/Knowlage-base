import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Modal from './Modal'

/**
 * Confirmation dialog. `isDangerous` switches to a red delete style.
 * Accepts both `open`/`isOpen` and `loading`/`isLoading` (older callers use either).
 */
export default function ConfirmDialog(props) {
  const {
    open,
    isOpen,
    onClose,
    onConfirm,
    title = 'ยืนยันการทำรายการ',
    message = 'ต้องการดำเนินการต่อหรือไม่?',
    confirmText,
    cancelText = 'ยกเลิก',
    isDangerous = false,
    loading,
    isLoading,
  } = props

  const resolvedOpen = typeof open === 'boolean' ? open : isOpen
  const resolvedLoading = typeof loading === 'boolean' ? loading : isLoading
  const label = confirmText || (isDangerous ? 'ลบ' : 'ยืนยัน')

  const icon = (
    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg ${
      isDangerous ? 'bg-red-50 text-red-600' : 'bg-brand-soft text-brand'
    }`}>
      <FontAwesomeIcon icon={['fas', isDangerous ? 'triangle-exclamation' : 'circle-question']} />
    </span>
  )

  return (
    <Modal
      isOpen={!!resolvedOpen}
      onClose={onClose}
      title={title}
      icon={icon}
      size="sm"
      busy={!!resolvedLoading}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={resolvedLoading} className="btn-secondary">
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={resolvedLoading}
            className={isDangerous ? 'btn-danger' : 'btn-primary'}
          >
            {resolvedLoading && <FontAwesomeIcon icon={['fas', 'circle-notch']} spin />}
            {resolvedLoading ? 'กำลังดำเนินการ…' : label}
          </button>
        </>
      }
    >
      <div className="text-base leading-relaxed text-slate-600">{message}</div>
    </Modal>
  )
}
