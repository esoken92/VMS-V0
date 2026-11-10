'use client';

/**
 * ToggleSwitch — a proper iOS-style switch with correct proportions.
 *
 * Track: fixed h-6 w-11 rounded-full (44×24px — the canonical switch ratio,
 * never a stretched oval). Thumb: h-5 w-5 (20px) circle that translates
 * between translate-x-0.5 (off) and translate-x-[22px] (on) — symmetric 2px
 * margins, matching the settings-page switches. Do NOT "improve" by making the
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
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        checked ? 'bg-primary' : 'bg-input',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'inline-block h-5 w-5 transform rounded-full bg-card shadow',
          'transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  );
}
