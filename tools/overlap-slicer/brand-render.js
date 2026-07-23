(() => {
  const brand = window.AI_OVERLAP_SLICER_BRAND;
  const footer = document.querySelector("#brandFooter");
  if (!brand || !footer) return;

  footer.innerHTML = "";
  footer.setAttribute("aria-label", "品牌信息");

  const website = makeLink(brand.websiteLabel || brand.company, brand.websiteUrl);
  const author = makeAuthorNote(brand.authorLabel || brand.maker);
  const divider = document.createElement("span");
  divider.className = "brand-divider";
  divider.textContent = "/";

  footer.append(website, divider, author);

  document.addEventListener("click", (event) => {
    if (author.contains(event.target)) return;
    author.classList.remove("is-open");
  });

  function makeLink(label, url) {
    const link = document.createElement("a");
    link.href = resolveUrl(url);
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = label;
    return link;
  }

  function makeAuthorNote(label) {
    const wrap = document.createElement("span");
    wrap.className = "brand-author";

    const button = document.createElement("button");
    button.className = "brand-author-button";
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-haspopup", "dialog");

    const card = document.createElement("span");
    card.className = "brand-note";
    card.setAttribute("role", "dialog");

    const title = document.createElement("strong");
    title.textContent = brand.authorNoteTitle || "作者的话";

    const text = document.createElement("span");
    text.textContent = brand.authorNote || "作者的话还没写。";

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = wrap.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(isOpen));
    });

    card.append(title, text);
    wrap.append(button, card);
    return wrap;
  }

  function resolveUrl(url) {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) return chrome.runtime.getURL(url);
    return url;
  }
})();
