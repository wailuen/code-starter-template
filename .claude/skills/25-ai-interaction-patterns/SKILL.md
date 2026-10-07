---
name: 25-ai-interaction-patterns
description: "Interaction patterns for product screens where users work with an AI model: helping users start and refine prompts, human oversight of agent actions, trust and disclosure, memory, and generative UI. Use when designing or reviewing a chat, copilot, agent or other AI-facing surface."
---

# AI Interaction Patterns

AI-specific UX patterns for designing interfaces where users interact with AI models. Covers the full interaction lifecycle: from first prompt to output verification, memory persistence, and trust building.

**Source**: Based on [Shape of AI](https://www.shapeof.ai) pattern library (CC-BY-NC-SA) by Emily Campbell.

## How This Differs from Other UI/UX Skills

| Skill                                 | Focus                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| **23-uiux-design-principles**         | Layout, hierarchy, responsive design (framework-agnostic)                         |
| **25-ai-interaction-patterns** (this) | AI-SPECIFIC interaction logic: how users prompt, control, trust, and relate to AI |

## Reference Documentation

- **[ai-interaction-patterns](ai-interaction-patterns.md)** - Full reference for all 60+ patterns

## Quick Pattern Selection

### By User Problem

| User Says/Feels                     | Apply Pattern                           |
| ----------------------------------- | --------------------------------------- |
| "I don't know what to ask"          | Gallery, Suggestions, Templates         |
| "AI didn't understand me"           | Follow-ups, Nudges, Prompt Enhancer     |
| "I want alternatives"               | Variations, Branches, Randomize         |
| "Is this accurate?"                 | Citations, References, Caveat           |
| "This is taking too long"           | Draft Mode, Controls, Cost Estimates    |
| "I need AI to do something complex" | Action Plan, Stream of Thought          |
| "Is this AI or human?"              | Disclosure, Avatar, Name                |
| "Don't store my data"               | Incognito Mode, Consent, Data Ownership |
| "AI forgot what I said"             | Memory (scoped/global/ephemeral)        |

### By AI Product Type

| Product Type             | Essential Patterns                                                     | Nice-to-Have                    |
| ------------------------ | ---------------------------------------------------------------------- | ------------------------------- |
| **Chat assistant**       | Open Input, Suggestions, Follow-ups, Memory, Disclosure                | Gallery, Voice & Tone, Branches |
| **Code copilot**         | Inline Action, Stream of Thought, Controls, Citations                  | Action Plan, Draft Mode         |
| **Image generator**      | Gallery, Parameters, Variations, Inpainting, Preset Styles             | Draft Mode, Randomize           |
| **Document AI**          | Attachments, Citations, Caveat, Disclosure, Summary                    | Transform, Expand, Follow-ups   |
| **AI agent**             | Action Plan, Controls, Verification, Stream of Thought, Cost Estimates | Memory, Consent                 |
| **Voice assistant**      | Voice Avatar, Personality, Controls, Disclosure                        | Memory, Consent                 |
| **Enterprise analytics** | Citations, Connectors, Filters, Modes, Disclosure                      | Action Plan, Memory             |

### Trust Level Decision

```
High-stakes domain (healthcare, finance, legal)?
  YES -> CRITICAL: Citations + Verification + Disclosure + Caveat + Audit
  NO  -> AI output mixed with human content?
    YES -> HIGH: Disclosure + Citations + Caveat
    NO  -> Could AI output cause harm if wrong?
      YES -> MEDIUM: Caveat + Citations (optional)
      NO  -> LOW: Minimal caveat, focus on UX quality
```

## The Six Pattern Categories

### 1. Wayfinders — Help users construct their first prompt

Gallery, Suggestions, Templates, Follow-ups, Initial CTA, Nudges, Prompt Details, Randomize

### 2. Prompt Actions — Actions users direct AI to complete

Open Input, Inline Action, Chained Action, Regenerate, Transform, Restyle, Expand, Summary, Synthesis, Describe, Auto-fill, Restructure, Madlibs, Inpainting

### 3. Tuners — Adjust context and settings to refine prompts

Attachments, Connectors, Parameters, Model Management, Modes, Filters, Prompt Enhancer, Preset Styles, Saved Styles, Voice and Tone

### 4. Governors — Human-in-the-loop oversight and agency

Action Plan, Stream of Thought, Controls, Draft Mode, Branches, Variations, Citations, References, Verification, Memory, Cost Estimates, Sample Response, Shared Vision

### 5. Trust Builders — Confidence in AI ethics and accuracy

Disclosure, Caveat, Consent, Data Ownership, Watermark, Footprints, Incognito Mode

### 6. Identifiers — Distinct AI qualities at brand/model level

Avatar, Personality, Name, Color, Iconography

## Gotchas

| Rule                                                                 | Why                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------ |
| Use a photorealistic avatar only if the AI matches that capability   | Sets unrealistic expectations, erodes trust            |
| Show Stream of Thought for tasks over 5 seconds                      | Users abandon when they can't see progress             |
| Make Memory visible                                                  | Users must see, edit, and delete what AI remembers     |
| Offer Controls (at minimum: stop) during generation                  | Users need escape hatches                              |
| Don't rely on Caveats alone for safety                               | Caveat blindness is real; design the system to be safe |
| Distinguish AI content from human content in blended UIs             | Users may unknowingly present AI work as their own     |
| Don't overwrite user work without Verification                       | Accidental overwrites destroy trust instantly          |

## Related Skills

- **[23-uiux-design-principles](../23-uiux-design-principles/SKILL.md)** - General design principles

## Support

- `uiux-designer` - AI-specific interaction pattern selection and design

- `frontend-specialist` - Builds these patterns in the project's UI stack
