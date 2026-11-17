import type { ButtonHTMLAttributes } from 'preact';
import { useLayoutEffect, useState } from 'preact/hooks';

/** How long the button waits for the confirming second tap. */
const CONFIRM_MS = 4000;

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'class'> & {
  class: string;
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** Changing this resets the button, e.g. when its sheet closes. */
  resetKey?: unknown;
};

/**
 * Two-tap confirmation inside the button itself: the first tap shows `confirmLabel`; a second
 * tap within a few seconds runs `onConfirm`, otherwise the button resets.
 */
export function TwoTapButton({ label, confirmLabel, onConfirm, resetKey, ...button }: Props) {
  const [armed, setArmed] = useState(false);
  // Start the reset timer right at the tap (a layout effect runs before the next paint).
  useLayoutEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [armed]);
  // Reset right away (not after the next paint), so a reopened sheet never shows it armed.
  useLayoutEffect(() => setArmed(false), [resetKey]);
  return (
    <button
      type="button"
      {...button}
      class={armed ? `${button.class} confirming` : button.class}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
