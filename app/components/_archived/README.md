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

Rollback of the whole strip: local tag `pre-strip-20260802-1051` / local branch `backup/pre-strip-20260802-1051` /
physical copy `~/thyroid-premium-site-backup-20260802-1051/` — all pinned at commit 27179f7
(tree identical to production commit 18526ff on origin/main, immutable on GitHub).
