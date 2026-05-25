# Data model

## Existing core tables

- `users`
- `questions`
- `test_results`
- `user_answers`
- `friendships`
- `messages`
- `battles`

## New theory tables

- `theory_categories`
- `theory_topics`
- `theory_sections`
- `theory_assets`

## Legacy handbook table

- `handbook_data`

`handbook_data` is still used as a compatibility fallback while theory content is being migrated to the normalized theory tables.

## New question fields

`questions` now has migration targets for:

- `ticket_number`
- `question_number`
- `explanation_html`
- `source_rule_slug`
- `theory_section_id`

These fields support:

- ticket-based exam mode
- richer explanations
- future "Читати правило" links from test questions to theory sections

