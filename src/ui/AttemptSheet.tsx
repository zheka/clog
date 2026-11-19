import { config } from '../config';
import type { Store } from '../store';
import type { AttemptForm } from './attemptForm';
import { Chevron } from './Chevron';
import { OutcomeField } from './OutcomeField';
import { TextField } from './TextField';
import { TwoTapButton } from './TwoTapButton';

/**
 * The New/Edit Attempt sheet: context (activity, location), the activity's own fields from
 * config.ts, and the outcome. State and actions live in `form` (attemptForm.ts).
 */
export function AttemptSheet({ form, store }: { form: AttemptForm; store: Store }) {
  const editing = form.editingId.value !== null;
  const expanded = form.contextOpen.value;
  const activity = form.activity.value;
  const location = (form.values.value.location ?? '').trim() || 'Unknown Location';
  return (
    <div
      id="attemptSheet"
      class={form.isOpen.value ? 'modal-overlay active' : 'modal-overlay'}
      onClick={(e) => {
        if (e.target === e.currentTarget) form.close();
      }}
    >
      <div class="modal-sheet">
        <div class="modal-header">
          <span id="attemptSheetTitle" class="modal-title">
            {editing ? 'Edit Attempt' : 'New Attempt'}
          </span>
          <button id="closeAttemptSheetBtn" class="close-btn" onClick={form.close}>
            &times;
          </button>
        </div>

        <form id="attemptForm" onSubmit={(e) => e.preventDefault()}>
          {/* Collapsible context: activity and location */}
          <div class="form-group">
            <label>Context</label>
            <div
              id="contextHeader"
              class={expanded ? 'context-accordion-header' : 'context-accordion-header collapsed'}
              aria-expanded={expanded}
              onClick={form.toggleContext}
            >
              <span id="contextSummaryText" class="context-summary">
                {`${activity} • ${location}`}
              </span>
              <Chevron />
            </div>
            <div
              id="contextBody"
              class={expanded ? 'context-collapsible-body' : 'context-collapsible-body hidden'}
            >
              <div class="form-group">
                <label>Activity</label>
                <div class="activity-picker" id="activityPicker">
                  {config.activities.map((a) => (
                    <button
                      key={a.name}
                      type="button"
                      class={a.name === activity ? 'activity-tab active' : 'activity-tab'}
                      data-activity={a.name}
                      onClick={() => form.switchActivity(a.name)}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
              <div class="form-group">
                <label for="locationInput">Location</label>
                <TextField
                  form={form}
                  field="location"
                  id="locationInput"
                  chipsId="locationChips"
                />
              </div>
            </div>
          </div>

          {/* The selected activity's own fields (from config.ts) */}
          <div id="activityFields" class="activity-fields">
            {form.fieldNames.value.map((field) => (
              <div key={field} class="form-group">
                <label for={`field-${field}`}>{field}</label>
                <TextField
                  form={form}
                  field={field}
                  id={`field-${field}`}
                  chipsId={`chips-${field}`}
                />
              </div>
            ))}
          </div>

          <OutcomeField form={form} store={store} />

          <div class="form-actions">
            <TwoTapButton
              id="deleteBtn"
              class="delete-btn"
              style={{ display: editing ? 'block' : 'none' }}
              label="Delete"
              confirmLabel="Tap again to delete"
              onConfirm={form.deleteAttempt}
              resetKey={form.openCount.value}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
