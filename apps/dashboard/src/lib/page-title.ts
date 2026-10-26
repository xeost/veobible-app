const pageLabels: Record<string, string> = {
  "/": "Dashboard",
  "/current-projects": "Ongoing projects",
  "/login": "Sign in",
  "/bible-versions": "Bible versions",
  "/short-videos": "Short Videos",
  "/long-videos": "Long Videos",
  "/book-videos": "Book Videos",
  "/audios": "Audios",
  "/deployments": "Publications",
  "/settings": "System settings",
  "/admin-tools": "Admin tools",
};

export function dashboardPageTitle(
  pathname: string | null,
  translate: (text: string) => string,
): string {
  const path = pathname?.replace(/\/+$/, "") || "/";
  const label = pageLabels[path];
  if (label) return `${translate(label)} | VeoBible`;

  const video = path.match(/^\/(short-videos|long-videos|book-videos)\/[^/]+$/);
  if (video)
    return `${translate("Video project")} · ${translate(pageLabels[`/${video[1]}`])} | VeoBible`;
  if (/^\/audios\/[^/]+\/[^/]+$/.test(path))
    return `${translate("Audio project")} | VeoBible`;

  return "VeoBible Dashboard";
}
