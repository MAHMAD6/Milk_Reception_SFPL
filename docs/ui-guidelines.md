# UI Guidelines

The interface is built on **shadcn/ui** (Radix primitives + Tailwind), **sonner** for toasts and
**framer-motion** for motion. Keep new screens on these building blocks so the app stays consistent.

## Building blocks

| Need | Use |
| --- | --- |
| Buttons, inputs, labels, badges, cards | `@/components/ui/*` (shadcn, config in `components.json`) |
| Dialogs | `Modal` from `@/components/ui/modal` — focus trap, Escape, scroll lock, `role="dialog"` |
| Slide-over panels | `Sheet` from `@/components/ui/sheet` |
| Menus / popovers / tooltips | `dropdown-menu`, `popover`, `tooltip` |
| Toasts | `useToast()` (sonner adapter) or `toast` from `sonner` — never `alert()` |
| Loading states | `PageLoader` / `Spinner` from `@/components/ui/spinner` |
| Error / empty full-page states | `StatusScreen` from `@/components/ui/status-screen` |
| Workspace heading | `PageHeader` from `@/components/ui/page-header` (title, one-line description, actions) |
| Tabs / view switchers | `SegmentedTabs` from `@/components/ui/segmented-tabs` — the only tab style; arrow-key navigation |
| KPI tiles | `StatCard` from `@/components/ui/stat-card` — neutral surface, colour only on the icon |
| Clickable non-button elements | add `role="button"`, `tabIndex={0}` and `onKeyDown={onActivateKey}` (`@/lib/a11y`) |
| Authenticated page frame | `StationShell`, or `Header` + `HierarchicalNavDrawer` |

Mount modals as `<AnimatePresence>{open && <Modal key="…" …/>}</AnimatePresence>` so they animate out.
`Modal` does not close on outside clicks by default so data-entry forms are not lost to a stray click;
pass `closeOnOutsideClick` for read-only dialogs and `preventClose` while a request is in flight.

## Design tokens

Colours are CSS variables in `src/app/globals.css`, exposed as Tailwind colours
(`bg-background`, `bg-card`, `bg-subtle`, `bg-muted`, `border-border`, `border-border-strong`,
`text-foreground`, `text-muted-foreground`, `bg-primary`, `hover:bg-primary-hover`, …).
Do not hard-code hex values in class names.

Selected list items use a primary ring on a white card (`border-primary ring-1 ring-primary`), not a solid
filled block. Form labels and headings are sentence case — no `uppercase tracking-wider`.

Typography: Inter (self-hosted via `@fontsource-variable/inter`), weights capped at `font-semibold`.
Use `tabular-nums` for figures; reserve `font-mono` for code.

## Layering (z-index)

Only use the named scale — never `z-50`, `z-[999]`, etc.

| Class | Value | For |
| --- | --- | --- |
| `z-raised` | 10 | in-flow elements lifted above siblings |
| `z-sticky` | 20 | sticky table headers / toolbars |
| `z-sidebar`, `z-header` | 30 | persistent sidebar, app top bar |
| `z-modal` | 50 | dialogs, sheets, drawers and their overlays |
| `z-popover` | 60 | dropdowns, popovers (above dialogs) |
| `z-banner` | 70 | offline / sync / update banners |
| `z-toast` | 80 | sonner toasts |
| `z-tooltip` | 90 | tooltips |

Values live in `--z-*` variables in `globals.css`, exposed as `@utility z-*` rules in the same file
(Tailwind v4 is configured in CSS; there is no `tailwind.config.js`).
