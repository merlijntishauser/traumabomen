import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5173";
const API_URL = process.env.E2E_API_URL || "http://localhost:8000";

export default defineConfig({
	testDir: ".",
	testMatch: "demo.spec.ts",
	timeout: 300_000,
	expect: { timeout: 15_000 },
	fullyParallel: false,
	workers: 1,
	retries: 0,
	use: {
		baseURL: BASE_URL,
		video: "on",
		viewport: { width: 1280, height: 720 },
		launchOptions: {
			slowMo: 50,
		},
	},
	projects: [
		{
			name: "demo",
			use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } },
		},
	],
	outputDir: "./test-results",
	metadata: {
		apiUrl: API_URL,
	},
});
