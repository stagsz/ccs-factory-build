# UI design reviewer review: Show the slot count on the dashboard

- Job: j-20261016-002
- Round: 1

## Summary
The indicator is a fourth `<span>` inside the existing `#counts` element, with the exact markup the spec gives. It adds no CSS, classes, colours or fonts. It inherits the `.counts` flex row (gap 14px, 13px type) and the `.counts b` tabular-nums rule, so spacing and type scale match the other three counts. Colours come from inherited `--fg`, so light and dark themes are unaffected. The only concern is a minor phone-width one.

## Findings
- **note** `dashboard/index.html:23`: `.counts` has no `flex-wrap`. With a fourth item the row is about 330px wide, plus 20px header padding on each side. At a 360px viewport it may overflow by a few pixels (the header itself wraps, but the counts row does not). At 390px and wider it fits. The spec forbids new CSS, so this is not a blocker. Fix (optional follow-up): add `flex-wrap: wrap` to the `.counts` rule.

## Checked
- Diff of `dashboard/index.html`: no new style rules, classes, elements outside `#counts`, colours or fonts.
- `.counts` and `.counts b` rules (lines 23-24) and the header flex layout (line 20).
- Light and dark theme tokens (lines 9-17): the new span uses only inherited colour.
- The `title` tooltip adds no styling.
- Did not run a browser. The width estimate above is from the CSS, not a rendered screenshot.

VERDICT: pass
