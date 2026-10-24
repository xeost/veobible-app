/** Align a restored section beneath the editor header at its pinned position. */
export function scrollEditorSectionIntoView(section: HTMLElement) {
  const header = document.querySelector<HTMLElement>(".project-studio-heading");
  const headerBottom = header
    ? (Number.parseFloat(getComputedStyle(header).top) || 0) +
      header.getBoundingClientRect().height
    : 0;
  window.scrollTo({
    top: Math.max(
      0,
      window.scrollY + section.getBoundingClientRect().top - headerBottom - 12,
    ),
    behavior: "instant",
  });
}
