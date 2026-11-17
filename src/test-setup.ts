import { options } from 'preact';

// Preact normally applies screen updates a moment later (batched). In tests, apply them right
// away, so a test can check the page directly after a click, as the UI tests do.
options.debounceRendering = (render) => render();
