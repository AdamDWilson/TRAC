#!/usr/bin/env python3
"""Validate template files for consistency and completeness."""

import json
import os
import re
import sys
from pathlib import Path

TEMPLATES_DIR = Path(__file__).parent / "templates"
REQUIRED_ATTRS = ["id", "name", "description", "index"]
# Variables injected automatically by the system
AUTO_INJECTED_VARS = {"date"}


def parse_templates_index():
    """Parse templates/index.js to extract template definitions."""
    index_path = TEMPLATES_DIR / "index.js"
    if not index_path.exists():
        return None, f"templates/index.js not found"

    content = index_path.read_text()

    # Extract the TEMPLATES array content
    match = re.search(r'const\s+TEMPLATES\s*=\s*\[(.*?)\];', content, re.DOTALL)
    if not match:
        return None, "Could not find TEMPLATES array in index.js"

    array_content = match.group(1)

    # Parse individual template objects
    templates = []
    # Match object literals { ... }
    obj_pattern = re.compile(r'\{([^{}]*)\}', re.DOTALL)

    for obj_match in obj_pattern.finditer(array_content):
        obj_content = obj_match.group(1)
        template = {}

        # Extract id, name, description (string values)
        for attr in ["id", "name", "description"]:
            str_match = re.search(rf'{attr}\s*:\s*["\']([^"\']*)["\']', obj_content)
            if str_match:
                template[attr] = str_match.group(1)

        # Extract index (number value)
        idx_match = re.search(r'index\s*:\s*(\d+)', obj_content)
        if idx_match:
            template["index"] = int(idx_match.group(1))

        if template:
            templates.append(template)

    return templates, None


def validate_template_attrs(template):
    """Check all required attributes are present and non-empty."""
    errors = []
    template_id = template.get("id", "<unknown>")

    for attr in REQUIRED_ATTRS:
        if attr not in template:
            errors.append(f"Template '{template_id}': missing required attribute '{attr}'")
        elif attr == "index":
            if not isinstance(template[attr], int):
                errors.append(f"Template '{template_id}': '{attr}' must be a number")
        elif not template[attr]:
            errors.append(f"Template '{template_id}': '{attr}' is empty")

    return errors


def check_required_files(template_id):
    """Verify .form.json and .letter.md exist for a template."""
    errors = []

    form_path = TEMPLATES_DIR / f"{template_id}.form.json"
    if not form_path.exists():
        errors.append(f"Template '{template_id}': missing {template_id}.form.json")

    letter_path = TEMPLATES_DIR / f"{template_id}.letter.md"
    if not letter_path.exists():
        errors.append(f"Template '{template_id}': missing {template_id}.letter.md")

    return errors


def extract_letter_variables(letter_path):
    """Extract all variable references from a letter template."""
    if not letter_path.exists():
        return set()

    content = letter_path.read_text()
    variables = set()

    # {{ variable_name }} or {{ variable_name | filter }}
    for match in re.finditer(r'\{\{\s*(\w+)', content):
        variables.add(match.group(1))

    # {% if variable_name %} or {% elif variable_name ... %}
    for match in re.finditer(r'\{%\s*(?:if|elif)\s+(\w+)', content):
        variables.add(match.group(1))

    return variables


def extract_form_fields(form_path):
    """Recursively extract all field names from a form.json file."""
    if not form_path.exists():
        return set()

    try:
        with open(form_path) as f:
            form_data = json.load(f)
    except json.JSONDecodeError:
        return set()

    fields = set()

    def extract_from_elements(elements):
        for element in elements:
            if "name" in element:
                fields.add(element["name"])
            if "elements" in element:
                extract_from_elements(element["elements"])

    if "elements" in form_data:
        extract_from_elements(form_data["elements"])

    return fields


def validate_variable_coverage(template_id):
    """Check all letter variables are collected in the form."""
    errors = []

    letter_path = TEMPLATES_DIR / f"{template_id}.letter.md"
    form_path = TEMPLATES_DIR / f"{template_id}.form.json"

    letter_vars = extract_letter_variables(letter_path)
    form_fields = extract_form_fields(form_path)

    # Remove auto-injected variables
    letter_vars = letter_vars - AUTO_INJECTED_VARS

    # Find variables used in letter but not collected in form
    missing = letter_vars - form_fields

    for var in sorted(missing):
        errors.append(f"Template '{template_id}': variable '{var}' used in letter but not in form")

    return errors


def check_requirements_timestamp(template_id):
    """Check if requirements.md is newer than form.json."""
    errors = []

    req_path = TEMPLATES_DIR / f"{template_id}.requirements.md"
    form_path = TEMPLATES_DIR / f"{template_id}.form.json"

    if not req_path.exists() or not form_path.exists():
        return errors

    req_mtime = req_path.stat().st_mtime
    form_mtime = form_path.stat().st_mtime

    if req_mtime > form_mtime:
        errors.append(f"Template '{template_id}': requirements.md is newer than form.json (regenerate form?)")

    return errors


def main():
    """Run all validations and print results."""
    errors = []

    templates, parse_error = parse_templates_index()
    if parse_error:
        print(parse_error)
        sys.exit(1)

    if not templates:
        print("No templates found in index.js")
        sys.exit(1)

    for template in templates:
        # Validate template attributes
        errors.extend(validate_template_attrs(template))

        template_id = template.get("id")
        if not template_id:
            continue

        # Check required files exist
        errors.extend(check_required_files(template_id))

        # Validate variable coverage
        errors.extend(validate_variable_coverage(template_id))

        # Check requirements timestamp
        errors.extend(check_requirements_timestamp(template_id))

    # Print errors
    for error in errors:
        print(error)

    # Print summary
    template_count = len(templates)
    template_word = "template" if template_count == 1 else "templates"
    error_count = len(errors)

    if error_count == 0:
        print(f"Checked {template_count} {template_word}: no errors")
    else:
        error_word = "error" if error_count == 1 else "errors"
        print(f"Checked {template_count} {template_word}: {error_count} {error_word}")

    sys.exit(0 if error_count == 0 else 1)


if __name__ == "__main__":
    main()
