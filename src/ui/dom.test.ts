// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackScrollFades, twoTapButton, updateScrollFades } from './dom';

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

describe('scroll fades', () => {
  /** A row whose content is `content` px wide, shown in `width` px, scrolled to `left`. */
  function row(content: number, width: number) {
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollWidth', { value: content });
    Object.defineProperty(el, 'clientWidth', { value: width });
    return el;
  }
  const fades = (el: HTMLElement) =>
    ['scroll-fade-left', 'scroll-fade-right'].filter((c) => el.classList.contains(c));

  it('fades only the sides with more to swipe to', () => {
    const el = row(600, 300);
    updateScrollFades(el);
    expect(fades(el)).toEqual(['scroll-fade-right']);
    el.scrollLeft = 150;
    updateScrollFades(el);
    expect(fades(el)).toEqual(['scroll-fade-left', 'scroll-fade-right']);
    el.scrollLeft = 300;
    updateScrollFades(el);
    expect(fades(el)).toEqual(['scroll-fade-left']);
  });

  it('shows no fade when everything fits', () => {
    const el = row(200, 300);
    updateScrollFades(el);
    expect(fades(el)).toEqual([]);
  });

  it('updates while scrolling', () => {
    const el = row(600, 300);
    trackScrollFades(el);
    el.scrollLeft = 300;
    el.dispatchEvent(new Event('scroll'));
    expect(fades(el)).toEqual(['scroll-fade-left']);
  });
});
