// @vitest-environment jsdom
import { render } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollFades } from './dom';
import { TwoTapButton } from './TwoTapButton';

describe('TwoTapButton', () => {
  afterEach(() => vi.useRealTimers());

  function setup(resetKey = 0) {
    const root = document.createElement('div');
    const onConfirm = vi.fn();
    const show = (key: number) =>
      render(
        <TwoTapButton
          class="delete-btn"
          label="Delete"
          confirmLabel="Tap again to delete"
          onConfirm={onConfirm}
          resetKey={key}
        />,
        root,
      );
    show(resetKey);
    return { button: root.querySelector('button')!, onConfirm, show };
  }

  it('runs the action on the second tap and resets after a pause', () => {
    vi.useFakeTimers();
    const { button, onConfirm } = setup();
    button.click();
    expect(button.textContent).toBe('Tap again to delete');
    expect(button.className).toBe('delete-btn confirming');
    vi.advanceTimersByTime(4000);
    expect(button.textContent).toBe('Delete');
    expect(button.className).toBe('delete-btn');

    button.click();
    button.click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(button.textContent).toBe('Delete');
  });

  it('resets when its reset key changes', () => {
    const { button, onConfirm, show } = setup(0);
    button.click();
    show(1);
    expect(button.textContent).toBe('Delete');
    button.click();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('scrollFades', () => {
  /** A row whose content is `content` px wide, shown in `width` px. */
  function row(content: number, width: number) {
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollWidth', { value: content });
    Object.defineProperty(el, 'clientWidth', { value: width });
    return el;
  }

  it('reports only the sides with more to swipe to', () => {
    const el = row(600, 300);
    expect(scrollFades(el)).toEqual({ left: false, right: true });
    el.scrollLeft = 150;
    expect(scrollFades(el)).toEqual({ left: true, right: true });
    el.scrollLeft = 300;
    expect(scrollFades(el)).toEqual({ left: true, right: false });
  });

  it('reports none when everything fits', () => {
    expect(scrollFades(row(200, 300))).toEqual({ left: false, right: false });
  });
});
