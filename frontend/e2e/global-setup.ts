async function globalSetup() {
  const apiUrl = process.env.E2E_API_URL || "http://localhost:8000";
  const response = await fetch(`${apiUrl}/test/reset`, { method: "POST" });
  if (!response.ok) {
    throw new Error(`Database reset failed: ${response.status}`);
  }
}

export default globalSetup;
