# Interface language

The dashboard is intended for people who edit and publish videos. Do not assume knowledge of software development or the platform's infrastructure.

- Use clear, task-oriented language: creating videos, adjusting timings, saving changes, checking progress, and publishing content.
- Do not display internal development or infrastructure terminology in titles, menus, buttons, forms, help text, accessibility text, notifications, statuses, errors, history, or empty states. This includes messages received from other services.
- Avoid references such as D1, SQL, API, proxy, backend, frontend, Worker, Cloudflare, ViNext, Remotion, Chatterbox, CLI, JSON, UUID, tokens, hooks, callbacks, bindings, migrations, and internal file paths. Use alternatives such as "saved settings," "creating the video," "updates," or "generation available," as appropriate.
- Present settings through graphical controls and history through readable information. Do not expose JSON objects, service responses, error traces, internal identifiers, or configuration variable names.
- Explain errors with an understandable consequence and a possible action. Keep technical details in internal logs for diagnostics. Reuse and extend `src/lib/presentation.ts` to translate statuses, stages, and errors into user-facing language.
- Video editing terms such as volume, thumbnail, narration, passage, Bible version, and timings in seconds are appropriate when they help users make a decision. Describe their practical use without explaining their implementation.
- These rules apply to the visible product, not to code names, contracts, databases, tests, developer documentation, or internal logs. An explicit user instruction may request technical information in a specific view.
- Before delivering an interface change, review its visible text and dynamic messages to ensure they follow these rules.

# Localization

- All interface text must be written in English by default. English is the default interface language and the source language for translations.
- Provide Spanish and Portuguese translations for all interface text, displayed when the user selects the corresponding language. This includes visible labels, help text, accessibility text, notifications, statuses, errors, history, and empty states.
- Reuse `useI18n` and the shared localization system. Add or update translations for all three languages whenever introducing or changing interface text; do not hardcode Spanish or Portuguese as the default text.
- Preserve proper names and Bible content in their intended language, independently of the selected interface language.
