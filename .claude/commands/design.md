---
name: design
description: "Load this project's UI/UX standards — layout, visual hierarchy, components, responsive behavior, accessibility, design systems, and stock styles to avoid. Use before designing, building or reviewing a screen or component."
---

# /design - UI/UX Design Principles Quick Reference

## Purpose

Load the UI/UX Design Principles skill for framework-agnostic design patterns, layout principles, and enterprise UX guidelines.

Use it for any frontend work in this repo — designing, building or reviewing a screen or component — whatever UI framework the project profile (`.harness/guides/project-profile.md`) names.

## Quick Reference

| Command              | Action                                            |
| -------------------- | ------------------------------------------------- |
| `/design`            | Load comprehensive design principles              |
| `/design layout`     | Show layout and information architecture patterns |
| `/design hierarchy`  | Show visual hierarchy principles                  |
| `/design components` | Show component design guidelines                  |
| `/design responsive` | Show responsive design patterns                   |

## What You Get

- Top-Down Design Methodology (layout → features → components → details)
- Layout & Information Architecture (70/30 rule, grid systems)
- Visual Hierarchy Principles (F-pattern, Z-pattern, inverted pyramid)
- Enterprise UX Patterns (action hierarchy, search & filter, bulk actions)
- Component Design Guidelines (cards, buttons, empty states, loading states)
- Responsive Design Patterns (breakpoints, layout changes)
- Accessibility Standards (WCAG 2.1 AA compliance)
- Design System Principles (tokens, naming conventions)
- Common Pitfalls & Solutions

## Quick Principles

### Top-Down Design Order

```
LEVEL 1: FRAME/LAYOUT (Highest Priority)
  → Space division, visual hierarchy, information architecture

LEVEL 2: FEATURE COMMUNICATION
  → Discoverability, action hierarchy, navigation

LEVEL 3: COMPONENT EFFECTIVENESS
  → Widget appropriateness, interaction patterns, feedback

LEVEL 4: VISUAL DETAILS (Lowest Priority)
  → Colors, shadows, animations, typography refinements
```

### The 70/30 Rule

- 70% of space = primary content (what user came to see/do)
- 30% of space = secondary UI (navigation, filters, chrome)

### Action Hierarchy

- **Primary**: 1 per page, large filled button, brand color
- **Secondary**: 2-3 per page, medium outlined button
- **Tertiary**: Unlimited, small text buttons, contextual

## Rules

1. Design top-down: settle the layout before polishing visual details, because detail work on a wrong layout is thrown away.
2. Give every page a visible primary action (call to action), not only a keyboard shortcut.
3. Check every breakpoint (mobile, tablet, desktop).
4. Never use color as the only signal of a state; add a shape, icon or word for users who can't see the color.
5. Provide loading and empty states for every data view.

## Usage Examples

```bash
# Load all design principles
/design

# Get layout patterns
/design layout

# Learn about visual hierarchy
/design hierarchy

# See component guidelines
/design components

# Get responsive patterns
/design responsive
```

## Related Commands

- `/validate` - Project compliance checks

For a design-quality pass over what's shipped, use `/redteam` or `/sweep`.

## Agent Teams

Dispatch **uiux-designer** for design analysis, layout critique, and visual hierarchy
recommendations. **frontend-specialist** builds the actual screens and components.

## Skill Reference

This command loads: `.claude/skills/23-uiux-design-principles/SKILL.md`
