'use client';

/**
 * ToggleSwitch — a proper iOS-style switch with correct proportions.
 *
 * Track: fixed h-6 w-11 rounded-full (44×24px — the canonical switch ratio,
 * never a stretched oval). Thumb: h-4 w-4 circle that translates between
 * translate-x-1 (off) and translate-x-6 (on). Do NOT "improve" by making the
 * track wider relative to its height — that is the malformed-oval bug this
 * component exists to prevent.
 */

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}

export default function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  id,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full',
        'transition-colors duration-200 ease-in-out',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        checked ? 'bg-blue-600' : 'bg-gray-300',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'inline-block h-4 w-4 transform rounded-full bg-white shadow',
          'transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}
