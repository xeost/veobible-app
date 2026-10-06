import { userMessage } from "../lib/presentation";
export async function api<T = any>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/${url}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const data = (await response.json()) as T & { error?: string };
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("Inicia sesión");
  }
  if (!response.ok) throw new Error(userMessage(data.error, response.status));
  return data;
}
export const date = (value: string | null, language: "es" | "en" = "es") =>
  value
    ? new Date(value).toLocaleString(language === "en" ? "en-US" : "es-AR")
    : "—";
