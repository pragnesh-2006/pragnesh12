# EssayLens

A responsive front-end concept for an automated essay scoring project. It gives students a simple place to submit a draft, view a score breakdown, and get one actionable revision suggestion.

## Run it

Open `index.html` in a modern browser. The site is plain HTML, CSS, and JavaScript; it has no build step or package installation.

## Included in this prototype

- Responsive student workspace with essay editor and word counter.
- General, argumentative, and narrative rubric options.
- Demo score breakdown for development, organization, clarity, and language/mechanics, each with its own rubric-linked color line.
- Scoring rubric modal with skill descriptions and score-band explanations.
- Local evaluation history and writing insights, including average skill scores and a recent-score chart.
- Free editing for the workspace and profile display names, saved in this browser.
- Separate Writing tips for revision strategies and How it works for the scoring workflow.
- Sample essay, copy-feedback action, modal overview, and clear-history control.
- Project roadmap covering text preprocessing, linguistic/structural/semantic features, model comparison, scoring metrics, and future BERT integration.

## Scoring note

The current score is a local illustrative estimate derived from simple writing signals such as word count, paragraph count, vocabulary variety, sentence length, transitions, capitalization, and punctuation. It is **not** a trained model, validated score, or official grade. Essay text is neither sent to a server nor stored by the prototype. Score summaries are saved in browser local storage; users can clear them from My evaluations.

For a research-backed implementation, connect the interface to a scoring API trained on human-rated essays. Establish prompt-aware train/validation/test splits, compare feature-based baselines with transformer models, and report metrics such as quadratic weighted kappa (QWK), mean absolute error (MAE), and Pearson or Spearman correlation. Keep the demo disclaimer until model quality and feedback have been validated.

## Files

- `index.html` — page structure and UI
- `styles.css` — responsive visual design
- `app.js` — local demo interactions and transparent heuristic estimate
