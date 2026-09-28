/**
 * On/off switch sized for touch (48×28). The label sits beside the switch
 * and is part of the click target.
 */
export default function Toggle({ checked, onChange, label, disabled = false, id }) {
  return (
    <label className={`inline-flex items-center gap-3 select-none ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={!!checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`relative w-12 h-7 rounded-full flex-shrink-0 transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-brand/15 ${
          checked ? 'bg-emerald-500' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
      {label && <span className="text-base text-slate-700">{label}</span>}
    </label>
  )
}
