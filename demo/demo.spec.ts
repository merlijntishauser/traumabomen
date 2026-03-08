import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_URL = process.env.E2E_API_URL || "http://localhost:8000";
const DEMO_EMAIL = `e2e-demo-${Date.now()}@example.com`;
const DEMO_PASSWORD = "DemoPassword123!";
const DEMO_PASSPHRASE = "my-secure-demo-passphrase";

const SCREENSHOT_DIR = "./screenshots";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Take a screenshot and wait for `seconds`, simulating a voiceover pause. */
async function voiceover(
	page: Page,
	seconds: number,
	screenshotName?: string,
): Promise<void> {
	if (screenshotName) {
		await page.screenshot({
			path: `${SCREENSHOT_DIR}/${screenshotName}`,
			fullPage: false,
		});
	}
	await page.waitForTimeout(seconds * 1000);
}

/** Type into a locator field with human-like delay. */
async function humanTypeLocator(
	page: Page,
	locator: ReturnType<Page["locator"]>,
	text: string,
): Promise<void> {
	await locator.click();
	for (const char of text) {
		await page.keyboard.type(char, { delay: 60 + Math.random() * 25 });
	}
}

/** Reset the test database (only deletes e2e-* accounts). */
async function resetDatabase(): Promise<void> {
	await fetch(`${API_URL}/test/reset`, { method: "POST" });
}

/** Dismiss the onboarding safety gate if it appears. */
async function dismissOnboarding(page: Page): Promise<void> {
	const continueButton = page.locator(".onboarding-gate__continue");
	if (
		await continueButton
			.isVisible({ timeout: 3_000 })
			.catch(() => false)
	) {
		await page.waitForTimeout(1500);
		await continueButton.click();
	}
}

// ---------------------------------------------------------------------------
// Demo test
// ---------------------------------------------------------------------------

test("Traumabomen demo walkthrough", async ({ page }) => {
	test.setTimeout(600_000);

	await resetDatabase();

	// -----------------------------------------------------------------------
	// Scene 1: Landing page (0:00 - 0:05)
	// -----------------------------------------------------------------------
	await page.goto("/login");
	await page.waitForLoadState("networkidle");
	await voiceover(page, 3, "01-landing.png");

	// -----------------------------------------------------------------------
	// Scene 2: Registration (0:05 - 0:30)
	// -----------------------------------------------------------------------
	await page.getByRole("link", { name: /create.*account|sign.*up|register/i }).click();
	await page.waitForURL("**/register");
	await page.waitForTimeout(500);

	// Fill email
	await humanTypeLocator(page, page.getByLabel(/email/i), DEMO_EMAIL);
	await page.waitForTimeout(200);

	// Fill password (captures strength meter)
	await humanTypeLocator(page, page.getByLabel(/^password$/i), DEMO_PASSWORD);
	await page.waitForTimeout(300);

	// Wait for password strength indicator before taking screenshots
	await expect(page.locator(".password-meter")).toBeVisible({ timeout: 3_000 });
	await voiceover(page, 2, "02-register-form.png");
	await voiceover(page, 2, "03-password-strength.png");

	// Confirm password
	await humanTypeLocator(
		page,
		page.getByLabel(/confirm password/i),
		DEMO_PASSWORD,
	);

	// Encryption passphrase
	await humanTypeLocator(
		page,
		page.getByLabel(/^encryption passphrase$/i),
		DEMO_PASSPHRASE,
	);

	// Confirm passphrase
	await humanTypeLocator(
		page,
		page.getByLabel(/confirm passphrase/i),
		DEMO_PASSPHRASE,
	);

	// Accept terms
	await page.getByLabel(/i understand/i).check();
	await page.waitForTimeout(500);

	// Submit
	await page.getByRole("button", { name: /create account/i }).click();
	await page.waitForURL("**/trees", { timeout: 20_000 });

	// Dismiss onboarding
	await dismissOnboarding(page);

	// -----------------------------------------------------------------------
	// Scene 3: Onboarding + empty trees (0:30 - 0:35)
	// -----------------------------------------------------------------------
	await voiceover(page, 3, "04-tree-list-empty.png");

	// -----------------------------------------------------------------------
	// Scene 4: Create demo tree (0:35 - 0:43)
	// -----------------------------------------------------------------------
	const demoBtn = page.getByRole("button", { name: /create demo tree/i });
	await expect(demoBtn).toBeVisible({ timeout: 5_000 });
	await demoBtn.click();

	// Wait for navigation to the tree workspace
	await page.waitForURL("**/trees/*", { timeout: 30_000 });
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(2000);
	await voiceover(page, 2, "05-demo-tree-canvas.png");

	// -----------------------------------------------------------------------
	// Scene 5: Canvas exploration (0:43 - 1:03)
	// -----------------------------------------------------------------------
	// Wait for nodes to render
	await expect(page.locator(".react-flow__node").first()).toBeAttached({
		timeout: 10_000,
	});
	await page.waitForTimeout(1000);
	await voiceover(page, 3, "06-canvas-overview.png");

	// Pan around the canvas for visual interest
	const canvas = page.locator(".react-flow__pane");
	await canvas.hover();
	await page.mouse.down();
	await page.mouse.move(640 - 100, 360 - 50, { steps: 20 });
	await page.mouse.up();
	await page.waitForTimeout(1500);

	// Zoom in slightly
	await canvas.hover();
	for (let i = 0; i < 3; i++) {
		await page.mouse.wheel(0, -100);
		await page.waitForTimeout(200);
	}
	await page.waitForTimeout(1500);

	// Reset view with Fit View button so nodes are clickable
	const fitViewBtn = page.getByRole("button", { name: /fit view/i });
	await fitViewBtn.click();
	await page.waitForTimeout(1000);

	// -----------------------------------------------------------------------
	// Scene 6: Person detail - Dorothy (1:03 - 1:18)
	// -----------------------------------------------------------------------
	const dorothyNode = page
		.locator(".react-flow__node")
		.filter({ hasText: "Dorothy" });
	await expect(dorothyNode).toBeVisible({ timeout: 5_000 });
	await dorothyNode.click();
	const panel = page.locator(".detail-panel");
	await expect(panel).toBeVisible({ timeout: 5_000 });
	await page.waitForTimeout(1000);
	await voiceover(page, 2, "07-person-detail.png");

	// Browse events tab
	await panel.getByRole("tab", { name: /events/i }).click();
	await page.waitForTimeout(1500);

	// Browse classifications tab
	await panel.getByRole("tab", { name: /dsm|classification/i }).click();
	await page.waitForTimeout(1500);

	// Close panel
	await page.keyboard.press("Escape");
	await expect(panel).not.toBeVisible({ timeout: 3_000 });
	await page.waitForTimeout(500);

	// -----------------------------------------------------------------------
	// Scene 7: Add person - Emma (1:18 - 1:33)
	// -----------------------------------------------------------------------
	await page.getByLabel("Add person").click();
	await expect(panel).toBeVisible({ timeout: 5_000 });

	await humanTypeLocator(
		page,
		panel.locator("input[type='text']").first(),
		"Emma Whitfield",
	);
	await panel.locator("input[type='number']").first().fill("2010");
	await page.waitForTimeout(500);
	await voiceover(page, 2, "08-add-person.png");

	await panel.getByRole("button", { name: /save/i }).first().click();
	await page.waitForTimeout(1000);

	// -----------------------------------------------------------------------
	// Scene 8: Create relationship (1:33 - 1:43)
	// -----------------------------------------------------------------------
	// Handle the relationship prompt if it appears
	const prompt = page.locator(".relationship-prompt");
	const promptAppeared = await prompt
		.waitFor({ state: "visible", timeout: 5_000 })
		.then(() => true)
		.catch(() => false);

	if (promptAppeared) {
		await page.waitForTimeout(500);
		await voiceover(page, 2, "09-relationship.png");

		// Accept the prompt
		await prompt.getByRole("button", { name: /yes/i }).click();
		await page.waitForTimeout(500);

		// Pick Sophie as the related person (Emma's mother in the Whitfield family)
		const sophieItem = prompt
			.locator(".relationship-prompt__item")
			.filter({ hasText: "Sophie" });
		if (await sophieItem.isVisible().catch(() => false)) {
			await sophieItem.click();
		} else {
			await prompt.locator(".relationship-prompt__item").first().click();
		}
		await page.waitForTimeout(500);

		// Pick "Biological parent" relationship type
		const bioParent = prompt
			.locator(".relationship-prompt__item")
			.filter({ hasText: /biological.*parent|parent.*biological/i });
		if (await bioParent.isVisible().catch(() => false)) {
			await bioParent.click();
		} else {
			await prompt.locator(".relationship-prompt__item").first().click();
		}
		await page.waitForTimeout(1000);
	} else {
		await voiceover(page, 2, "09-relationship.png");
	}

	// Close panel if still open
	await page.keyboard.press("Escape");
	await page.waitForTimeout(500);

	// -----------------------------------------------------------------------
	// Scene 9: Timeline view (1:43 - 1:58)
	// -----------------------------------------------------------------------
	await page
		.locator(".tree-toolbar__tab")
		.filter({ hasText: /timeline/i })
		.click();
	await page.waitForTimeout(2000);
	await voiceover(page, 3, "10-timeline.png");
	await page.waitForTimeout(1500);

	// -----------------------------------------------------------------------
	// Scene 10: Patterns view (1:58 - 2:08)
	// -----------------------------------------------------------------------
	await page
		.locator(".tree-toolbar__tab")
		.filter({ hasText: /pattern/i })
		.click();
	await page.waitForTimeout(1500);
	await voiceover(page, 3, "11-patterns.png");

	// -----------------------------------------------------------------------
	// Scene 11: Journal (2:08 - 2:18)
	// -----------------------------------------------------------------------
	await page
		.locator(".tree-toolbar__tab")
		.filter({ hasText: /journal/i })
		.click();
	await page.waitForTimeout(1500);
	await voiceover(page, 3, "12-journal.png");

	// -----------------------------------------------------------------------
	// Scene 12: Insights (2:18 - 2:23)
	// -----------------------------------------------------------------------
	await page
		.locator(".tree-toolbar__tab")
		.filter({ hasText: /insight/i })
		.click();
	await page.waitForTimeout(1500);
	await voiceover(page, 2, "13-insights.png");

	// -----------------------------------------------------------------------
	// Scene 13: Theme switching (2:23 - 2:35)
	// -----------------------------------------------------------------------
	// Navigate back to canvas for visual impact
	await page
		.locator(".tree-toolbar__tab")
		.filter({ hasText: /canvas/i })
		.click();
	await page.waitForTimeout(1000);

	// Theme toggle is in the footer with aria-label "Cycle theme"
	const themeToggle = page.getByRole("button", { name: /cycle theme/i });
	if (await themeToggle.isVisible().catch(() => false)) {
		await themeToggle.click();
		await page.waitForTimeout(1000);
		await voiceover(page, 2, "14-theme-light.png");
	} else {
		await voiceover(page, 2, "14-theme-light.png");
	}

	// -----------------------------------------------------------------------
	// Scene 14: Logout + re-login (2:35 - 2:50)
	// -----------------------------------------------------------------------
	await page.getByRole("button", { name: /log out/i }).click();
	await page.waitForURL(/\/(unlock|login)/, { timeout: 15_000 });

	// Navigate to login if we landed on unlock
	if (!page.url().includes("/login")) {
		await page.goto("/login");
	}
	await page.waitForURL("**/login", { timeout: 10_000 });
	await page.waitForTimeout(500);

	// Log back in
	await page.getByLabel(/email/i).fill(DEMO_EMAIL);
	await page.getByLabel(/password/i).fill(DEMO_PASSWORD);
	await page.getByRole("button", { name: /log in/i }).click();
	await page.waitForURL("**/unlock", { timeout: 10_000 });

	// Unlock screen
	await page.waitForTimeout(1000);
	await voiceover(page, 2, "16-unlock.png");

	await humanTypeLocator(
		page,
		page.getByLabel(/passphrase/i),
		DEMO_PASSPHRASE,
	);
	await page.getByRole("button", { name: /unlock/i }).click();
	await page.waitForURL("**/trees", { timeout: 30_000 });
	await page.waitForTimeout(1000);

	// Verify tree persisted
	const treeLink = page.locator(".tree-list-item__link").first();
	await expect(treeLink).toBeVisible({ timeout: 10_000 });
	await voiceover(page, 3, "17-trees-persisted.png");

	// Open the tree to show data persisted
	await treeLink.click();
	await page.waitForURL("**/trees/*", { timeout: 10_000 });
	await expect(page.locator(".react-flow__node").first()).toBeAttached({
		timeout: 10_000,
	});
	await page.waitForTimeout(2000);
});
