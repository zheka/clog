interface Props {
  id: string;
  class?: string;
  placeholder: string;
  value: string;
  onInput: (text: string) => void;
}

/** A text input whose keyboard action key is "Done": it closes the keyboard, saves nothing. */
export function DoneInput(props: Props) {
  return (
    <input
      type="text"
      enterKeyHint="done"
      id={props.id}
      class={props.class}
      placeholder={props.placeholder}
      autocomplete="off"
      value={props.value}
      onInput={(e) => props.onInput(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}
