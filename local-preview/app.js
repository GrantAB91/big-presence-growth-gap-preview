const requestedVariant = new URLSearchParams(window.location.search).get("variant") || "portal-audit";

try {
  const response = await fetch("../data/variants.json");
  const variants = await response.json();
  const config = variants[requestedVariant] || variants["portal-audit"];
  document.body.dataset.pageVariant = variants[requestedVariant] ? requestedVariant : "portal-audit";
  document.title = `${config.label} | Big Presence`;
  document.querySelectorAll("[data-preview-copy]").forEach((element) => {
    const value = config[element.dataset.previewCopy];
    if (value) element.textContent = value;
  });
} catch (error) {
  /* The default portal-audit copy remains usable if the config cannot load. */
}

await import("../js/theme.js");
