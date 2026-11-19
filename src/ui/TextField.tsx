import { config } from '../config';
import { suggestValues } from '../core/suggestions';
import { cleanText } from '../core/text';
import type { AttemptForm } from './attemptForm';
import { ChipRow } from './ChipRow';
import { DoneInput } from './DoneInput';

interface Props {
  form: AttemptForm;
  /** `location` or an activity field such as `grade`. */
  field: string;
  id: string;
  chipsId: string;
}

/** A required text field with its chip row: recent values, matches first while typing. */
export function TextField({ form, field, id, chipsId }: Props) {
  const value = form.values.value[field] ?? '';
  // Only text the user typed filters the chips, not a prefilled value.
  const query = form.typed.value[field] ? value : '';
  const scope = {
    activity: form.activity.value,
    location: cleanText(form.values.value.location ?? ''),
  };
  const suggestions = suggestValues(
    form.attempts(),
    field,
    query,
    scope,
    form.editingId.value,
    config.maxChips,
  );
  return (
    <>
      <DoneInput
        id={id}
        class="required-input"
        // Red hint while empty: all fields are required (the hint is never part of the value).
        placeholder={`add ${field}`}
        value={value}
        onInput={(text) => form.setField(field, text, true)}
      />
      <ChipRow id={chipsId} class="chips-container" items={suggestions}>
        {suggestions.map((v) => (
          <span
            key={v}
            class={v === value ? 'chip-small current' : 'chip-small'}
            onClick={() => form.setField(field, v, false)}
          >
            {v}
          </span>
        ))}
      </ChipRow>
    </>
  );
}
