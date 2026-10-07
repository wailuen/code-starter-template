---
name: 23-uiux-design-principles
description: "This project's UI/UX standards: layout and hierarchy, action and component sizing, responsive breakpoints, accessibility, motion, interface copy, production-hardening checks, and stock styles to avoid. Use when designing, building or reviewing any screen or component."
---

# UI/UX Design Principles

Framework-agnostic design principles and this project's house defaults for screens and components. Read it before designing or building UI.

## Reference Documentation

### Core Principles

- **[design-principles](design-principles.md)** - Complete UI/UX design principles and guidelines
  - Top-down design methodology
  - Layout & information architecture
  - Visual hierarchy principles
  - Enterprise UX patterns
  - Component design guidelines
  - Responsive design patterns
  - Accessibility standards
  - Design system principles
  - Common pitfalls & solutions

### Motion Design

- **[motion-design](motion-design.md)** - Animation timing, easing curves, and motion patterns
  - Timing reference (50ms-800ms+ by interaction type)
  - Modern CSS easing curves
  - Animation categories (entrance, micro-interaction, state, loading, page)
  - GPU-accelerated properties checklist
  - `prefers-reduced-motion` accessibility (mandatory)
  - Motion anti-patterns and decision framework

### Production Hardening

- **[production-hardening](production-hardening.md)** - Frontend production hardening checklist
  - Text & content resilience (overflow, length extremes, dynamic content)
  - Internationalization (text expansion, formatting, encoding)
  - Error states & recovery (network, HTTP status, form errors)
  - Edge cases & boundary conditions (empty, loading, data volume, concurrency)
  - Accessibility resilience (zoom, keyboard, screen reader, touch)
  - Performance under stress (lazy loading, virtual scrolling, debouncing)

### UX Writing & Microcopy

- **[ux-writing](ux-writing.md)** - Interface text patterns for enterprise applications
  - Button & action label patterns (verb + noun)
  - Error message structure (what + why + fix)
  - Empty state copy (what goes here + why empty + how to fill)
  - Form labels, placeholders, and help text
  - Confirmation dialog structure
  - Toast/banner message patterns
  - Enterprise tone guidelines

## Quick Patterns

### Top-Down Design Order

```
LEVEL 1: FRAME/LAYOUT (Highest Priority)
  ↓ Space division, visual hierarchy, information architecture
LEVEL 2: FEATURE COMMUNICATION
  ↓ Discoverability, action hierarchy, navigation
LEVEL 3: COMPONENT EFFECTIVENESS
  ↓ Widget appropriateness, interaction patterns, feedback
LEVEL 4: VISUAL DETAILS (Lowest Priority)
  → Colors, shadows, animations, typography refinements
```

### The 70/30 Rule

- 70% of space = primary content (what user came to see/do)
- 30% of space = secondary UI (navigation, filters, chrome)

### Action Hierarchy

| Type      | Size | Style    | Position     | Use                           |
| --------- | ---- | -------- | ------------ | ----------------------------- |
| Primary   | 48px | Filled   | Top-right    | 1 per page (Save, Add)        |
| Secondary | 40px | Outlined | Near primary | 2-3 per page (Cancel, Export) |
| Tertiary  | 32px | Text     | Contextual   | Unlimited (Edit, View)        |

### View Type Decision

| Data Type                      | Recommended View       |
| ------------------------------ | ---------------------- |
| Visual content (faces, photos) | Grid (2-4 columns)     |
| Structured data (many fields)  | Table (sortable)       |
| Mobile/narrow screens          | List (single column)   |
| Mixed visual + data            | Grid with Table toggle |

### Stock styles to avoid (when the project has no design language yet)

Unless the brief or design notes ask for them, do not use: a cream or off-white page background, italic accent words in headlines, numbered "01/02/03" section labels, monospace labels, or pill-shaped buttons. These are generic defaults that make a product look like every other generated page. After a first draft, look at which stock styles it reached for and add them to this list.

Once the project has a design system, its tokens and components win (`frontend-specialist` § Non-negotiables).

## Gotchas

| Rule                                         | Why                                                 |
| -------------------------------------------- | --------------------------------------------------- |
| Start with layout, not details               | Perfecting shadows on misplaced cards wastes effort |
| Keep the primary action visible             | Users must find the main action without a keyboard shortcut; add the shortcut for power users |
| Never use color as the only status signal    | Accessibility requires an icon or text as well      |
| Check every breakpoint                       | Mobile, tablet and desktop must all work            |

## When to Use This Skill

Use this skill when:

- Starting a frontend feature or page design
- Reviewing or auditing existing UI/UX
- Making layout or spacing decisions
- Designing navigation or information architecture
- Creating or extending design systems
- Implementing responsive layouts
- Ensuring accessibility compliance
- Resolving visual design problems

## Related Skills

- **[25-ai-interaction-patterns](../25-ai-interaction-patterns/SKILL.md)** - AI UX patterns

## Support

For UI/UX design questions, invoke:

- `uiux-designer` - Design analysis and recommendations

- `frontend-specialist` - Builds the screens and components in the project's UI stack
