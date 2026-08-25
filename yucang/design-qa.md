# Yucang Homepage and Login Modal Design QA

Source visual truth:

- `C:\Users\comic\AppData\Local\Temp\codex-clipboard-4066a1d6-c776-4503-963a-857f1a08b6a2.png`
- `C:\Users\comic\AppData\Local\Temp\codex-clipboard-7db34a42-0d0e-46b0-9a2e-0fe0861211e8.png`

Implementation evidence: local 1280 × 720 homepage and login captures were compared side by side with the supplied references in the in-app browser. The temporary captures are not tracked because the supplied reference includes personal browser chrome.

Viewports: 1280 × 720 desktop and 390 × 844 mobile.

## Findings

- No actionable P0, P1, or P2 layout difference remains for the MVP.
- The Auria reference is used only for cinematic composition: centered headline, central subject, and surrounding translucent imagery. The woman, Auria branding, app-store button, English headline, and warm portrait treatment are intentionally not reproduced.
- The central Yucang subject is a transparent, faceless half-body form made from white Chinese text bands. It remains behind the headline and actions.
- Orbit cards use intentionally unequal sizes, starting phases, lane heights, and speeds. Their ellipse is limited to the upper stage, so they do not orbit through the figure's lower body or ground area.
- The login route reuses the existing full two-column Yucang login experience inside a closeable modal over the blurred homepage. It is not a second login design.
- [P3] The first-launch Prompt images are cropped from the user-provided Prompt Vault example grid because the original images exist only in the user's local extension data. Higher-resolution originals can replace these files after a privacy-safe selected export; this does not change layout or data contracts.

## Interaction verification

- Eight first-launch Prompt cards render with a real title and a visible like count of 0.
- Hovering one card pauses only that card, raises it above the others, and transitions it to full opacity. A second card continued moving during the same timed check.
- Moving away resumes the paused card from its current position.
- Clicking Login opens the full two-column login experience over a blurred homepage.
- Clicking the close control removes the modal and returns the URL to `#/home`.
- Search, category filters, Prompt detail, variable replacement, and Prompt copy remain available at `#/discover`.
- The public library renders four columns at 1280 px, three at narrower desktop widths, and one on mobile.
- The Yucang UI follows the system language on first use and includes a persistent Chinese/English switch. The homepage, library, public detail, login, creator flow, and review flow all use the selected UI language.
- The studio homepage, Prompt Vault download/tutorial page, and Yucang library contain reciprocal product-navigation entries.
- Desktop login fits within a 1280 × 720 viewport without document-level scrolling.
- Homepage and login have no horizontal overflow at 390 px.
- Reduced-motion preference disables the orbit animations.
- No browser console errors were observed during homepage, login, library, detail, or responsive checks.

final result: passed
