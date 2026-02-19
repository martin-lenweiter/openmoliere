import { test, expect } from "@playwright/test"

test.describe("Route smoke tests", () => {
  test("/ redirects to /proofread", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/proofread/)
  })

  test("/proofread shows proofreader UI", async ({ page }) => {
    await page.goto("/proofread")
    await expect(page.getByRole("textbox")).toBeVisible()
    await expect(page.getByRole("button", { name: "Check" })).toBeVisible()
    await expect(page.getByRole("combobox")).toBeVisible()
  })

  test("/prompt-engineer shows prompt engineer UI", async ({ page }) => {
    await page.goto("/prompt-engineer")
    await expect(page.getByRole("textbox")).toBeVisible()
    await expect(page.getByRole("button", { name: "Improve" })).toBeVisible()
    await expect(page.getByText("Tips")).toBeVisible()
  })
})

test.describe("Tab navigation", () => {
  test("clicking Prompt Engineer navigates to /prompt-engineer", async ({ page }) => {
    await page.goto("/proofread")
    await page.getByRole("link", { name: "Prompt Engineer" }).click()
    await expect(page).toHaveURL(/\/prompt-engineer/)
  })

  test("clicking Proofreader navigates to /proofread", async ({ page }) => {
    await page.goto("/prompt-engineer")
    await page.getByRole("link", { name: "Proofreader" }).click()
    await expect(page).toHaveURL(/\/proofread/)
  })

  test("active tab has correct styling", async ({ page }) => {
    await page.goto("/proofread")
    const proofreaderTab = page.getByRole("link", { name: "Proofreader" })
    await expect(proofreaderTab).toHaveClass(/border-foreground/)

    const promptTab = page.getByRole("link", { name: "Prompt Engineer" })
    await expect(promptTab).not.toHaveClass(/border-foreground/)
  })
})
