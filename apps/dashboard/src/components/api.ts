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
  if (!response.ok) throw new Error(data.error ?? "Error de conexión");
  return data;
}
export const date = (value: string | null) =>
  value ? new Date(value).toLocaleString("es-AR") : "—";
