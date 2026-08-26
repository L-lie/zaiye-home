# Yucang detail and account drawer QA

- source visual truth: `C:/Users/comic/AppData/Local/Temp/codex-clipboard-d49076b5-27d0-4f4e-9ef1-46f4d3fa55bf.png` and `C:/Users/comic/AppData/Local/Temp/codex-clipboard-42e6c7b0-138e-4879-bd2c-8b9e5ac2dcbf.png`
- implementation screenshot: `design-qa-implementation.png`
- viewport: current Codex in-app browser desktop viewport
- state: official visual Prompt detail; account drawer behavior also guarded by CSS and route tests

## Full-view comparison evidence

The implementation now keeps the image and variable controls in the left track, while title, summary, metadata and final Prompt occupy the right track. The title is reduced from the earlier oversized treatment. The account drawer overlays the right edge and no longer changes body padding or the fixed home-header right edge.

## Focused region evidence

The image moved from top `162.5px` to `-296px` after a page scroll and computed `position` is `static`, proving it scrolls with the surrounding content instead of remaining pinned while text moves underneath it. The lower viewport shows “修改变量” directly below the image and “最终 Prompt” directly below the right-side work information.

## Findings and comparison history

- Earlier P1: the sticky featured image remained fixed while text scrolled. Fixed by removing sticky positioning and internal text-only scroll limits.
- Earlier P1: opening the account drawer pushed the page and account header left. Fixed by removing drawer-driven body padding and header right offsets.
- Earlier P2: the title dominated the information column. Fixed with a smaller responsive title scale.
- Earlier P2: portrait and landscape assets were forced to occupy the full column width. Fixed by preserving intrinsic image proportions with bounded maximum dimensions.

## Required fidelity surfaces

- typography: existing family and weights preserved; detail title scale reduced.
- spacing/layout: stable two-column desktop grid and natural single-column mobile fallback preserved.
- colors/tokens: existing Yucang dark green, cream and gold tokens unchanged.
- image quality: original supplied resource image remains uncropped and unstretched.
- copy/content: no product copy changed.

## Primary interactions and console

- Resource detail route rendered from real resource JSON.
- Page scroll verified; image and content move together.
- Core route and integration contract tests passed.
- No new console errors observed during the local detail-page check.

final result: passed
