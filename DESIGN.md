# IndexBoard Design

## Direction & Layout
- Purpose: turn evaluation results into a calm, credible leaderboard in the style of an analysis report. It should feel like a careful research appendix, not a marketing scoreboard, gaming league or neon AI dashboard.
- Defining idea: every bar carries its 95% interval whisker, and the first screen of a board states plainly whether the top is a statistical tie.
- Visual reference: Artificial Analysis leaderboards (horizontal bars per metric, score-vs-cost scatter), but quieter, with a serif report headline.
- Hero: left-aligned serif title, description, actions, then a 4-tile stat row (2x2 on mobile, 4 across from lg). Landing hero is 7/5 split: copy left, a real example chart right.
- Max content width 1152px (max-w-6xl); padding 16px mobile, 24px tablet and up. Section spacing 48–64px, card gaps 20px.
- Breakpoints: <640 single column, 640–1023 single column charts, >=1024 two-column chart grid. Tables scroll inside their own container; the page never scrolls horizontally at 390px.
- Do: tabular numbers, explicit units, honest notes under every chart. Don't: emoji, gradients on charts, rank medals, glow, purple, red/green "winner" colouring.

## Tokens
- Light: background #F6F8FB, surface #FFFFFF, subtle surface #EDF1F6, border #DCE2EA, text #14202E, secondary text #5B6878, primary blue #1F4E8C, primary soft #DCE7F5, muted bar #9FB3CC, gridline #E3E8EF.
- Dark (follows system): background #0D131A, surface #141C25, subtle #1F2833, border #2A3542, text #E5EBF2, secondary #9DA9B7, primary #6FA3E6, muted bar #50647F.
- Status: tie banner uses warm amber (light bg #FBF1DE, text #6B4511, border #E9C98B; dark bg #2B2214, text #F0CB86). Clear lead uses primary soft. Accents stay scarce: primary only for leader/tied bars, links, primary buttons.
- Type: Fraunces (600, opsz) for h1 40–52px/1.1, h2 28px/1.2, tile values 24px; IBM Plex Sans 15–16px/1.6 body, 13px captions, 14px/500 buttons; IBM Plex Mono only for keys and code.
- Spacing scale 4/8/12/16/20/24/32/48/64. Radii: buttons and inputs 6px, cards 10px, chips 999px.
- Depth: 1px borders carry hierarchy; cards may use shadow 0 1px 2px rgba(20,32,46,.04). Sticky header uses background 90% with blur 8px and bottom border.

## Shared Patterns & States
- Panel: surface card, 1px border, 10px radius, 20–24px padding; holds charts, tables, editor sections.
- Bar chart: label column, bar 14px tall, whisker 1.5px with 8px caps, value column right. Leader and tied bars in primary, others muted bar. Note line under each chart.
- Scatter: cost on X, score on Y, dashed 1.5px primary frontier labelled "Nobody beats".
- Banner: status block with title and one-sentence explanation (tie / clear lead / no intervals).
- Table: sticky header and sticky first column, sort buttons with aria-sort, "tied" chip.
- States: loading text skeleton, not-found panel with home link, inline validation list in editor, toasts for copy/save.
- Motion: 150ms ease-out colour transitions only; no chart animation. Content visible on first render.
- Accessibility: 40px minimum targets, visible 2px primary focus ring, aria-label on icon buttons, aria-pressed on language toggle, charts expose per-row titles.

## Media
- No photography: this is an operational data tool, and the charts are the visual. SVG data graphics drawn from real or example data replace imagery; the landing page shows a live example chart instead of an illustration.
