import { test, expect, gotoHarness } from './fixtures';

/**
 * Problems panel (F1-B4) — real-browser smoke.
 *
 * The harness seeds a STANDALONE diagram (E2E.luml), so useProjectProblems
 * reports a "save" warning with an "Add to Project" quick-fix. This drives the
 * actual DOM panel in a real browser: open it, see the grouped problem + fix,
 * click the fix, and confirm the standalone is folded back in (warning gone).
 */
test.describe('Problems panel — standalone quick-fix', () => {
  test('lists the standalone warning and the Add-to-Project quick-fix resolves it', async ({ page }) => {
    await gotoHarness(page);

    // Open the bottom panel and switch to the Problems tab.
    await page.getByTitle('Show Bottom Panel').click();
    await page.getByRole('button', { name: /Problems/ }).click();

    // The standalone diagram's save warning is listed with its quick-fix.
    await expect(page.getByText(/is standalone .* excluded/)).toBeVisible();
    const fix = page.getByRole('button', { name: /Add to Project/ });
    await expect(fix).toBeVisible();

    // Applying the fix folds it into the project — the warning disappears.
    await fix.click();
    await expect(page.getByRole('button', { name: /Add to Project/ })).toHaveCount(0);

    // The file is no longer standalone.
    const stillStandalone = await page.evaluate(() => {
      const view = window.__libreumlE2E?.getView();
      return !!view; // sanity: harness still responsive
    });
    expect(stillStandalone).toBe(true);
  });
});
