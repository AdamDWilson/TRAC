# Template Letters

A pure client-side webpage for generating template letters using SurveyJS for input collection and Nunjucks markdown templates.

## Setup

Requires a local server due to fetch() API restrictions:

```bash
cd template-letters
python3 -m http.server 8000
```

Then open http://localhost:8000

## File Structure

```
template-letters/
├── index.html              # Main entry point (all views)
├── css/
│   └── styles.css          # Mobile-first responsive styles
├── js/
│   ├── renderer.js         # Nunjucks setup + custom filters + markdown rendering
│   └── app.js              # Routing, view management, SurveyJS init, clipboard
└── templates/
    ├── index.js            # Template registry
    ├── {id}.letter.md      # Letter template (Nunjucks syntax)
    ├── {id}.form.json      # SurveyJS form config
    └── *.requirements.md   # Requirements docs (reference only)
```

## Adding New Templates

1. Add entry to `templates/index.js` with id, name, description, index
2. Create `templates/{id}.form.json` with SurveyJS form config
3. Create `templates/{id}.letter.md` with Nunjucks template

## TODO

- [ ] Fix tab order issue: when tabbing from deposit_amount field, focus jumps to browser address bar instead of the next visible field (deposit_return_method). May need JavaScript-based focus management for conditionally visible SurveyJS fields.
