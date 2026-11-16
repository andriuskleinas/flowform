# How Flowform evolved

From a purple Lovable prototype to an editorial, Claude-assisted form builder in about six
months. The page runs oldest first. Each era has a release with notes and a git tag, so you can
check out the code exactly as it was.

![Flowform's landing page, May to November 2026](evolution/evolution.gif)

| Era | Date | What changed | Release |
| --- | --- | --- | --- |
| [Prototype](#1-prototype) | 12 May 2026 | First published version, built in Lovable | [`era-01-prototype`](https://github.com/andriuskleinas/flowform/releases/tag/era-01-prototype) |
| [A working app](#2-a-working-app) | 17–22 May 2026 | Dashboard, editor, sharing, analytics, AI question suggestions | [`era-02-lovable-mvp`](https://github.com/andriuskleinas/flowform/releases/tag/era-02-lovable-mvp) |
| [Portfolio launch](#3-portfolio-launch) | 3–20 Jul 2026 | Moved to Vercel; conversational mode, logic jumps, Claude summaries | [`era-03-portfolio-launch`](https://github.com/andriuskleinas/flowform/releases/tag/era-03-portfolio-launch) |
| [Editorial Ink](#4-editorial-ink) | 6 Nov 2026 | New design language: ink on paper, one blue, a live hero form | [`era-04-editorial-ink`](https://github.com/andriuskleinas/flowform/releases/tag/era-04-editorial-ink) |
| [Claude up front](#5-claude-up-front) | 9 Nov 2026 | Roboto; Claude features lead the landing page | [`era-05-claude-up-front`](https://github.com/andriuskleinas/flowform/releases/tag/era-05-claude-up-front) |
| [One app shell](#6-one-app-shell) | 13 Nov 2026 | Figtree + DM Mono; a sidebar shell for every signed-in page | [`era-06-app-shell`](https://github.com/andriuskleinas/flowform/releases/tag/era-06-app-shell) |
| [The page is the demo](#7-the-page-is-the-demo) | 16 Nov 2026 | Landing hero you can answer; a phone-first pass on the app | [`era-07-landing-demo`](https://github.com/andriuskleinas/flowform/releases/tag/era-07-landing-demo) |

To run any era locally: `git checkout era-03-portfolio-launch && bun install && bun run dev`.

---

## 1. Prototype

**12 May 2026 · [`882d9e9`](https://github.com/andriuskleinas/flowform/commit/882d9e9)**

Day one, generated and published in Lovable. Purple accents, Plus Jakarta Sans, an aurora glow
and a floating 3D form card. One button: “Start building”. Many of the 275 commits in the
following ten days were small visual edits made in Lovable’s editor.

![Landing page, 12 May 2026](evolution/2026-05-12-landing.png)

## 2. A working app

**17–22 May 2026 · [`72499fc`](https://github.com/andriuskleinas/flowform/commit/72499fc) → [`e96d1d7`](https://github.com/andriuskleinas/flowform/commit/e96d1d7)**

Behind the landing page, a real product appeared: sign-up, a forms dashboard, a drag-and-drop
editor with a preview, public form links, an analytics tab and the first Claude feature, AI
question suggestions. The look stayed purple and rounded, with soft cards and pill buttons.

![Dashboard, 17 May 2026](evolution/2026-05-17-dashboard.png)

## 3. Portfolio launch

**3–20 Jul 2026 · [`062dc4f`](https://github.com/andriuskleinas/flowform/commit/062dc4f)**

The project left Lovable for Vercel and became a portfolio piece. Six upgrade waves added form
lifecycle, new question types, a share hub, a conversational respondent mode with logic jumps,
a real funnel with drop-off, and Claude summaries of open answers. The visual style changed
little; the work was in the product.

![Landing page, July 2026](evolution/2026-07-20-landing.png)

| Dashboard | Respondent view |
| --- | --- |
| ![Dashboard, July 2026](evolution/2026-07-20-dashboard.png) | ![Filling a form, July 2026](evolution/2026-07-20-fill.png) |

<details>
<summary>Results page, July 2026</summary>

![Results page with the AI summary, July 2026](evolution/2026-07-20-results.png)

</details>

## 4. Editorial Ink

**6 Nov 2026 · [`e50a1d4`](https://github.com/andriuskleinas/flowform/commit/e50a1d4) → [`9dc0180`](https://github.com/andriuskleinas/flowform/commit/9dc0180)**

The first deliberate redesign. Purple and glow gave way to near-black ink on warm paper, hairline
rules instead of shadows, and one Klein-style blue for actions and live data. Type moved to
Instrument Serif headlines with Instrument Sans and Fragment Mono. The hero became a working form
you can answer, with letter shortcuts.

![Landing page, 6 Nov 2026](evolution/2026-11-06-landing.png)

![Dashboard, 6 Nov 2026](evolution/2026-11-06-dashboard.png)

## 5. Claude up front

**9 Nov 2026 · [`3b7c12e`](https://github.com/andriuskleinas/flowform/commit/3b7c12e)**

The serif was dropped for Roboto across the product, and the Claude features moved to the top of
the landing page. A strip of facts sat under the buttons, and the dark section became a Features
grid written for users rather than engineers.

![Landing page, 9 Nov 2026](evolution/2026-11-09-landing.png)

<details>
<summary>Results page, 9 Nov 2026</summary>

![Results page, 9 Nov 2026](evolution/2026-11-09-results.png)

</details>

## 6. One app shell

**13 Nov 2026 · [`092bd1b`](https://github.com/andriuskleinas/flowform/commit/092bd1b)**

Figtree and DM Mono replaced Roboto: rounder, easier to read, still exact for numbers. Every
signed-in page moved into one sidebar shell with a workspace switcher, ⌘K search and form-level
Build / Results / Present tabs. The four days before it added a dashboard analytics overview,
categories, “Ask your responses”, teams and roles, dark mode, live presenting, quizzes and partial
responses.

![Landing page, 13 Nov 2026](evolution/2026-11-13-landing.png)

## 7. The page is the demo

**16 Nov 2026 · [`547f815`](https://github.com/andriuskleinas/flowform/commit/547f815)**

The landing hero turned into the product itself: answer the form on the left and watch the
results update on the right. A mobile pass followed, with a bottom tab bar, the forms list first
on the dashboard, and larger tap targets.

![Landing page, 16 Nov 2026](evolution/2026-11-16-landing.png)

![Dashboard, 16 Nov 2026](evolution/2026-11-16-dashboard.png)

| Phone, May 2026 | Phone, Nov 2026 |
| --- | --- |
| <img src="evolution/2026-05-12-mobile.png" alt="Landing page on a phone, May 2026" width="300"> | <img src="evolution/2026-11-16-mobile.png" alt="Landing page on a phone, November 2026" width="300"> |

The social preview was retaken to match: the form and its live results, side by side.

![Social preview, 16 Nov 2026](evolution/og-2026-11-16.png)

---

## The social preview

The card that appears when a Flowform link is shared, and on the GitHub repo. It has followed
each redesign since the first branded version in July.

| | |
| --- | --- |
| **7 Jul 2026**<br>Dark, with a purple glow. The only dark version, made for the portfolio launch. | ![Social preview, 7 Jul 2026](evolution/og-2026-07-07.png) |
| **6 Nov 2026**<br>Editorial Ink: serif headline, a form card with a logic jump. | ![Social preview, 6 Nov 2026](evolution/og-2026-11-06.png) |
| **9 Nov 2026**<br>Roboto replaces the serif; the logic hint goes. | ![Social preview, 9 Nov 2026](evolution/og-2026-11-09.png) |
| **13 Nov 2026**<br>Figtree and DM Mono. | ![Social preview, 13 Nov 2026](evolution/og-2026-11-13.png) |
| **16 Nov 2026**<br>The form and its live results, as on the landing page. | ![Social preview, 16 Nov 2026](evolution/og-2026-11-16.png) |

---

### How these were made

Landing pages, dashboards and phone shots were rendered fresh from each tagged commit: a
temporary git worktree, the dependencies locked at that commit, and the dev server, captured with
Playwright at 1440 × 900 (phones at 390 × 844). Signed-in pages use a mocked backend with demo data,
so no real account appears. July’s respondent and results shots and the 9 Nov results shot are the
originals from the README at the time, taken from git history, as are all five social previews.

May’s dashboard is shown from 17 May. From 19 May until a fix on 3 July, that page never finished
loading, because of a Supabase client method called after it was detached from its client. History
is honest like that.
