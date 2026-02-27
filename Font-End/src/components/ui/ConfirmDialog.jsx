import Modal from './Modal'

export default function ConfirmDialog(props) {
  const {
    open,
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm',
    message = 'Are you sure?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDangerous = false,
    loading,
    isLoading,
  } = props

  const resolvedOpen = typeof open === 'boolean' ? open : isOpen
  const resolvedLoading = typeof loading === 'boolean' ? loading : isLoading

  return (
    <Modal
      isOpen={resolvedOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={resolvedLoading}
            className="px-4 py-2 rounded-lg border border-white/25 text-slate-300 hover:text-white hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={resolvedLoading}
            className={`px-4 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${
              isDangerous
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
                : 'bg-accent-500/20 text-accent-200 border border-accent-500/40 hover:bg-accent-500/35'
            }`}
          >
            {resolvedLoading ? 'Working…' : confirmText}
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-slate-300">{message}</p>
    </Modal>
  )
}

