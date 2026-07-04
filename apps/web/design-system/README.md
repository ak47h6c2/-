# CareerPilot APAC Design System

This directory is the code-side source for the CareerPilot APAC Figma handoff.

- `careerpilot-apac.design-system.json` defines tokens, component names, states, and quality gates.
- `FIGMA_HANDOFF.md` defines the target Figma file structure and connector prerequisites.
- `generated/careerpilot-figma-library.use-figma.js` is the generated Plugin API script for `use_figma`.
- `http://localhost:3000/design-system` renders the local visual preview for capture or review.
- `../src/app/globals.css` is the implementation source for CSS variables and component classes.
- `npm run design:check -w @careerpilot/web` verifies that the JSON spec and CSS stay aligned.

Before pushing UI changes to Figma, run:

```powershell
npm run figma:export -w @careerpilot/web
npm run design:check -w @careerpilot/web
npm run visual:smoke -w @careerpilot/web
```

Figma component naming should follow the `figmaComponent` fields in the JSON spec.
