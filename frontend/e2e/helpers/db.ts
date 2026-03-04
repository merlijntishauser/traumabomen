const API_URL = process.env.E2E_API_URL || "http://localhost:8000";

export async function resetDatabase(): Promise<void> {
  const response = await fetch(`${API_URL}/test/reset`, { method: "POST" });
  if (!response.ok) {
    throw new Error(`Database reset failed: ${response.status}`);
  }
}
