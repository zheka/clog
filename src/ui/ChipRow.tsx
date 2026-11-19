import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { scrollFades, type ScrollFades } from './dom';

interface Props {
  id: string;
  class: string;
  /** What the row shows; when it changes, the row scrolls back to the start. */
  items: string[];
  'aria-disabled'?: boolean;
  children: ComponentChildren;
}

/**
 * A chip row: one line that scrolls sideways, with edge fades where there is more. When its
 * items change it scrolls back to the start, so the best matches are visible.
 */
export function ChipRow(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [fades, setFades] = useState<ScrollFades>({ left: false, right: false });
  const itemsKey = props.items.join('\n');
  useLayoutEffect(() => {
    const row = ref.current!;
    row.scrollLeft = 0;
    setFades(scrollFades(row));
  }, [itemsKey]);
  const fadeClass = `${fades.left ? ' scroll-fade-left' : ''}${fades.right ? ' scroll-fade-right' : ''}`;
  return (
    <div
      ref={ref}
      id={props.id}
      class={props.class + fadeClass}
      aria-disabled={props['aria-disabled']}
      onScroll={(e) => setFades(scrollFades(e.currentTarget))}
    >
      {props.children}
    </div>
  );
}
