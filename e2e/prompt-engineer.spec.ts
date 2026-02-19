import { test, expect } from "@playwright/test"

test.describe("Prompt Engineer interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/prompt-engineer")
  })

  test("Improve button disabled when textarea is empty", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Improve" })).toBeDisabled()
  })

  test("typing in textarea enables the Improve button", async ({ page }) => {
    await page.getByRole("textbox").fill("Write a haiku about testing")
    await expect(page.getByRole("button", { name: "Improve" })).toBeEnabled()
  })

  test("character count updates as user types", async ({ page }) => {
    await expect(page.getByText("0 / 20,000")).toBeVisible()
    await page.getByRole("textbox").fill("Hello")
    await expect(page.getByText("5 / 20,000")).toBeVisible()
  })

  test("Tips panel expands and collapses", async ({ page }) => {
    const tipsButton = page.getByRole("button", { name: /Tips/ })
    await tipsButton.click()
    await expect(page.getByText(/specific/i)).toBeVisible()
    await tipsButton.click()
  })
})
