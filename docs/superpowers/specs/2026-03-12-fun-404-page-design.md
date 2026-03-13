# Fun 404 Page — Design Spec

## Goal

Replace the current minimal 404 page on rentierdigital.xyz with an interactive "AI terminal" that simulates searching for the missing page, then promotes the Prompt Contracts book.

## User Experience

1. User lands on a non-existent URL (e.g. `/blog/some-typo`)
2. A terminal-style block appears and starts typing lines one by one
3. The sequence takes ~8 seconds total
4. After the terminal finishes, a book promo CTA fades in
5. A subtle "Back to blog" link sits below

## Terminal Sequence

```
> Searching for "/the-actual-path"...
> Scanning 42 published articles...
> Checking redirects...
> Page not found.
>
> Diagnosis: This page was never built.
> Probably someone vibe-coded the URL.
>
> Recommended fix:
> Stop guessing. Start shipping.
```

- Line 1 uses the actual `window.location.pathname`
- Each line appears with typewriter effect (~30ms per character)
- ~400ms pause between lines
- Blinking cursor at the end of the current line
- "42" is intentional (Hitchhiker's Guide reference) — do not replace with a real count

## Book Promo CTA

After the terminal sequence completes, a card fades in (opacity 0 -> 1, ~300ms transition):

- Cover image (`/prompt-contracts-cover.png`)
- "New book" sky-blue badge
- Title: "Prompt Contracts"
- Tagline: "Stop vibe coding. Ship real software with AI."
- Links to `/prompt-contract` (same tab)
- Same visual style as the homepage book promo
- Cover image: `loading="lazy"`

## Back Link

Below the CTA, a subtle neutral link: "or go back to the blog" pointing to `/blog`.

## Technical Details

- **File**: `src/pages/404.astro`
- **Layout**: Uses existing `BaseLayout.astro` (includes Header + Footer)
- **Styling**: Tailwind only, dark theme consistent with site (`bg-[#0a0a0a]`)
- **Terminal block**: `<div>` with monospace font (`font-mono`), green-ish text (`text-green-400`) on dark bg (`bg-neutral-900/50`), rounded border (`border border-white/10 rounded-lg`)
- **JS**: Vanilla `<script>` tag, no dependencies. Typewriter logic with `setTimeout` chain.
- **Mobile**: Terminal and CTA stack vertically, full width. No horizontal scroll.
- **SEO**: Title "404 — Page Not Found", noindex (already handled by site-level robots config)
- **Performance**: Zero external dependencies, ~50 lines of JS.
- **Accessibility**: If `prefers-reduced-motion: reduce`, render all terminal lines instantly and show the CTA immediately (no animation).
- **No-JS fallback**: Terminal lines are rendered in the HTML as static content. JS adds the typewriter animation on top. Without JS, the user sees the full text + CTA immediately.

## What NOT to do

- No canvas/WebGL — keep it lightweight
- No sound
- No random jokes array — single deterministic sequence
- No article suggestions / search — just the terminal + book CTA
