import { config } from '../config';
import { getCategory } from '../core/outcomes';
import { suggestOutcomes } from '../core/suggestions';
import { normalizeName } from '../core/text';
import { CATEGORIES, type Category } from '../core/types';
import type { Store } from '../store';
import type { AttemptForm } from './attemptForm';
import { ChipRow } from './ChipRow';
import { DoneInput } from './DoneInput';

const CATEGORY_MARK: Record<Category, string> = { success: '🟢', failure: '🔴', work: '⚪' };

/**
 * The outcome: tapping a chip saves the attempt. No text: recent outcomes. While typing: only
 * the matching ones, plus (for a name that doesn't exist yet) a row of its own with one chip per
 * category, which creates the outcome and saves.
 */
export function OutcomeField({ form, store }: { form: AttemptForm; store: Store }) {
  const { outcomes } = store.state.value;
  const name = normalizeName(form.outcomeText.value);
  const names = suggestOutcomes(
    form.attempts(),
    outcomes,
    form.activity.value,
    name,
    config.maxChips,
  );
  const isNew = name !== '' && !outcomes.some((o) => o.name === name);
  const blocked = form.blocked.value;
  const rowClass = (base: string) => (blocked ? `${base} blocked` : base);
  return (
    <div class="form-group">
      <label for="outcomeInput">Outcome</label>
      <DoneInput
        id="outcomeInput"
        placeholder="find or add an outcome"
        value={form.outcomeText.value}
        onInput={(text) => (form.outcomeText.value = text)}
      />
      <ChipRow
        id="outcomeChips"
        class={rowClass('outcome-row')}
        aria-disabled={blocked}
        items={names}
      >
        {names.map((o) => (
          <span
            key={o}
            class={`chip ${getCategory(outcomes, o)}${o === form.currentOutcome.value ? ' current' : ''}`}
            onClick={() => form.logAttempt(o)}
          >
            {o}
          </span>
        ))}
      </ChipRow>
      <ChipRow
        id="newOutcomeChips"
        class={rowClass('outcome-row new-outcome-row')}
        aria-disabled={blocked}
        items={isNew ? [name] : []}
      >
        {isNew &&
          CATEGORIES.map((category) => (
            <span
              key={category}
              class={`chip ${category} new-outcome`}
              data-category={category}
              onClick={() => form.addOutcomeAndLog(name, category)}
            >
              {`${CATEGORY_MARK[category]} ${name}`}
            </span>
          ))}
      </ChipRow>
    </div>
  );
}
