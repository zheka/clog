// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { twoTapButton } from './dom';

describe('twoTapButton', () => {
  afterEach(() => vi.useRealTimers());

  it('runs the action on the second tap and resets after a pause', () => {
    vi.useFakeTimers();
    const button = document.createElement('button');
    button.textContent = 'Delete';
    const action = vi.fn();
    twoTapButton(button, 'Confirm delete', action);

    button.click();
    expect(button.textContent).toBe('Confirm delete');
    expect(button.classList.contains('confirming')).toBe(true);
    vi.advanceTimersByTime(4000);
    expect(button.textContent).toBe('Delete');
    expect(button.classList.contains('confirming')).toBe(false);

    button.click();
    button.click();
    expect(action).toHaveBeenCalledTimes(1);
    expect(button.textContent).toBe('Delete');
  });
});
