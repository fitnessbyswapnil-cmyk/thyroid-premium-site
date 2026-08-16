# Archived homepage sections — 20260802-1051

Removed from the rendered page in the homepage strip-down (VSL-first layout).
Files are untouched; restore any one with:

    git mv "app/components/_archived/<File>.tsx" app/components/ && re-add to app/page.tsx

| File | On-page heading it rendered |
|---|---|
| AuthoritySection.tsx | "Meet Your Coach" (certifications grid was extracted to CertificationsSection.tsx BEFORE archiving) |
| WhoIsThisForSection.tsx | "This consultation is specifically for you if:" |
| FrameworkSection.tsx | "The Thyroid L.E.A.N. Method" + 90-day timeline |
| ThyroidStrategySession.tsx | "How Your Thyroid Root-Cause Session Works" (#how-it-works Session Clock) |
| FinalCTASection.tsx | "You've been doing this alone long enough." (final CTA + coach card + guarantee) |
| ProblemSection.tsx | "Why You Feel Stuck — The Real Reason Thyroid Fat Won't Move" |
| ResultsSection.tsx | "Transformations — They thought it was their willpower." (archived per Task 4.4: duplicates TransformationWall, this brief prefers the wordless version) |
| MoreThanFatLossSection.tsx | "More Than Fat Loss" (archived 20260803 per live-DOM audit: both photos duplicate TransformationWall clients; its stack SectionCta moved to WhatsappProofSection) |
| ResultsGrid.tsx | "What it looks like when the right pillar gets fixed." (archived 20260816, same day it shipped) |

## Read this before building a fourth results section

ResultsGrid is the THIRD section archived for one reason: **it duplicates
TransformationWall.** ResultsSection went for it, MoreThanFatLossSection went for
it, ResultsGrid went for it. Anyone rebuilding this will hit it again.

The cause is the asset library, not the code. Across `public/transformations`
and `public/MoreThanFatLossSection` there are only **four female clients**
(Heenal, Surekha, Vaidehi, Namrata) and TransformationWall already shows all
four. Any women-only results section is therefore a reprint of the wall.

Two other traps, both verified by opening every file:

- The rest of those images are **male** clients (Ajay, Amol, Ashish, Nitin,
  Raghu). They are unused on purpose. This page targets women 30+.
- **Filenames lie.** `nitin.png` is captioned "Meet Raghu". Never source a
  caption from a filename.

A results section only becomes worth building when new artwork exists: profile
cards ("Meet X", CHALLENGES / RESULTS panels) for clients the wall does not
already show. Mixing the profile format and the before/after format in one grid
looks broken, because the layouts differ inside the images themselves.

Rollback of the whole strip: local tag `pre-strip-20260802-1051` / local branch `backup/pre-strip-20260802-1051` /
physical copy `~/thyroid-premium-site-backup-20260802-1051/` — all pinned at commit 27179f7
(tree identical to production commit 18526ff on origin/main, immutable on GitHub).
