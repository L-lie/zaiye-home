const state = {
  project: "all",
  asset: "all",
};

const gallery = document.querySelector("[data-gallery]");
const cards = [...document.querySelectorAll(".project-card")];
const emptyState = document.querySelector("[data-empty-state]");

document.querySelectorAll("[data-filter-group]").forEach((group) => {
  const groupName = group.dataset.filterGroup;

  group.addEventListener("click", (event) => {
    const button = event.target.closest(".filter-chip");
    if (!button) return;

    state[groupName] = button.dataset.filter;
    group.querySelectorAll(".filter-chip").forEach((chip) => {
      chip.classList.toggle("is-active", chip === button);
    });
    renderGallery();
  });
});

function matchesFilter(card, key, value) {
  if (value === "all") return true;
  return card.dataset[key].split(" ").includes(value);
}

function renderGallery() {
  let visibleCount = 0;

  cards.forEach((card) => {
    const visible = matchesFilter(card, "project", state.project) && matchesFilter(card, "asset", state.asset);
    card.hidden = !visible;
    if (visible) visibleCount += 1;
  });

  gallery.classList.toggle("has-filtered-items", visibleCount > 0);
  emptyState.hidden = visibleCount > 0;
}
