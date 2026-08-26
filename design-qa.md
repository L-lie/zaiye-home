# Design QA

## Resource detail right-column layout

- Reference: user-provided resource detail screenshot at 1526 x 1074.
- Desktop verification: 1526 x 1074 in the in-app browser.
- Result: the hero image and variable controls remain in the left column; metadata and the final Prompt panel occupy the right column. The final Prompt starts on the same row as the variable panel and no longer drops into a separate full-width section.
- Overflow check: document width equals viewport content width (`1511px`), with no horizontal overflow.
- Responsive verification: 800 x 1000.
- Responsive order: image, resource information, variables, final Prompt.
- Responsive overflow check: document width equals viewport content width (`785px`).
- Automated checks: syntax check and all seven relevant Yucang contract suites pass.
