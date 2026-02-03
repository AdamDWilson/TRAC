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

Each template requires **3 files** plus a registry entry:

### 1. Register in `templates/index.js`

```javascript
{
    id: "my-template-id",           // Used for filenames and URL routing
    name: "Human Readable Name",    // Shown in template list
    description: "Brief description shown on home page",
    index: 2                        // Display order
}
```

### 2. Create `templates/{id}.form.json` (SurveyJS config)

Uses [SurveyJS](https://surveyjs.io/form-library/documentation/overview) format. Common patterns:

```json
{
    "elements": [
        {
            "type": "panel",
            "name": "panelName",
            "title": "Section Title",
            "elements": [
                {
                    "name": "field_name",
                    "type": "text",
                    "title": "Label shown to user",
                    "description": "Help text below field",
                    "isRequired": true
                }
            ]
        }
    ],
    "showNavigationButtons": "none",
    "showQuestionNumbers": "off"
}
```

**Field types:**
- `text` - Single line input. Add `"inputType": "date"` or `"inputType": "number"` for specialized inputs
- `comment` - Multi-line textarea. Use `"rows": 3` to set height
- `boolean` - Yes/no toggle
- `radiogroup` - Single selection from `"choices": ["Option 1", "Option 2"]`
- `expression` - Calculated field, use `"visible": false` to hide. Example: `"expression": "{field1} + {field2}"`
- `html` - Static HTML content for instructions/links

**Conditional visibility:** `"visibleIf": "{other_field} = true"` or `"visibleIf": "{field} = 'value'"`

### 3. Create `templates/{id}.letter.md` (Nunjucks template)

Uses [Nunjucks](https://mozilla.github.io/nunjucks/) templating with markdown formatting.

**Available filters (defined in `js/renderer.js`):**
- `{{ value | money }}` - Formats number as currency ($1,234.56)
- `{{ date_field | formatDate }}` - Formats YYYY-MM-DD to "January 1, 2024"
- `{{ deposit | depositInterest(start_date) }}` - Calculates deposit + compound interest

**Template structure conventions:**
```markdown
{{ date }}

{{ tenant_name }}
{{ tenant_address_full }}
&nbsp;
&nbsp;
&nbsp;
{{ landlord_name }}
{{ landlord_address_full }}

Dear {{ landlord_name }},

[Letter body with {{ variables }} and {{ calculated | money }} values]

{% if conditional_field %}
Conditional content here.
{% endif %}

For additional information, please contact the RTB (gov.bc.ca/landlordtenant) at 604-660-1020 or 1-800-665-8779.

Thank you,

{{ tenant_name }}
```

**Standard field names** (reuse where applicable):
- `tenant_name`, `tenant_address_full`
- `landlord_name`, `landlord_address_full`
- `tenancy_start_date`, `tenancy_end_date`
- `tenant_forwarding_address_full`, `tenant_forwarding_email`
- `monthly_rent`, `deposit_amount`

### 4. Create `templates/{id}.requirements.md` (optional)

Human-readable instructions for AI assistants describing the form flow and validation logic. Not used by the app but helpful for maintenance.

### Validation

Run `python3 validate_templates.py` to check that:
- All registered templates have required files
- All variables in letter templates exist in form definitions

## TODO

- [ ] Fix tab order issue: when tabbing from deposit_amount field, focus jumps to browser address bar instead of the next visible field (deposit_return_method). May need JavaScript-based focus management for conditionally visible SurveyJS fields.
