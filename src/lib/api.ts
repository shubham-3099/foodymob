export async function request<T = any>(path: string, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Requested-With": "DishDiscovery" },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Unable to complete request.");
  return result as T;
}
export const fetchCatalog = () =>
  request<{ dishes: import("@/data/seed").Dish[]; vloggers: import("@/data/seed").Vlogger[] }>(
    "/api/catalog",
  );
