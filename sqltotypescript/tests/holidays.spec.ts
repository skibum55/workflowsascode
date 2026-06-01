// tests/holidays.spec.ts
import { test, expect } from "@playwright/test";
import { createHoliday, createHolidays } from "../generated/factories/holiday.factory";

test.describe("Holidays", () => {
  test("creates a new fixed holiday via the UI", async ({ page }) => {
    const holiday = createHoliday({
      Name: "Christmas Day",
      Date: new Date("2025-12-25"),
      IsFixed: true,
    });

    await page.goto("/holidays/new");

    await page.getByLabel("Name").fill(holiday.Name!);
    await page.getByLabel("Date").fill("2025-12-25");
    await page.getByLabel("Is Fixed").check();

    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText(holiday.Name!)).toBeVisible();
  });

  test("displays a list of holidays in the grid", async ({ page }) => {
    // Seed the database with 5 random holidays before the test
    const holidays = createHolidays(5);

    // Insert via API call
    for (const holiday of holidays) {
      await page.request.post("/api/holidays", { data: holiday });
    }

    await page.goto("/holidays");

    // Verify each holiday appears in the grid
    for (const holiday of holidays) {
      await expect(page.getByRole("row", { name: holiday.Name! })).toBeVisible();
    }
  });

  test("edits an existing holiday", async ({ page }) => {
    // Seed a single holiday
    const original = createHoliday({ IsFixed: false });
    await page.request.post("/api/holidays", { data: original });

    // Generate updated values
    const updated = createHoliday({
      Oid: original.Oid, // keep the same ID
      Name: "Updated Holiday Name",
      IsFixed: true,
    });

    await page.goto(`/holidays/${original.Oid}/edit`);

    await page.getByLabel("Name").clear();
    await page.getByLabel("Name").fill(updated.Name!);

    await page.getByLabel("Is Fixed").check();

    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText(updated.Name!)).toBeVisible();
  });

  test("deletes a holiday from the grid", async ({ page }) => {
    const holiday = createHoliday();
    await page.request.post("/api/holidays", { data: holiday });

    await page.goto("/holidays");

    const row = page.getByRole("row", { name: holiday.Name! });
    await row.getByRole("button", { name: "Delete" }).click();

    // Confirm the delete dialog if one exists
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(row).not.toBeVisible();
  });

  test("bulk creates holidays via API and validates count in UI", async ({
    page,
  }) => {
    const holidays = createHolidays(20, {
      CreatedBy: "Test Runner",
    });

    // Bulk insert via API
    await page.request.post("/api/holidays/bulk", { data: holidays });

    await page.goto("/holidays");

    // Verify the grid row count badge
    await expect(page.getByTestId("total-count")).toHaveText("20");
  });

  test("soft-deleted holidays do not appear in the grid", async ({ page }) => {
    const active = createHoliday({ GCRecord: null });
    const deleted = createHoliday({ GCRecord: 1 });

    await page.request.post("/api/holidays", { data: active });
    await page.request.post("/api/holidays", { data: deleted });

    await page.goto("/holidays");

    await expect(page.getByRole("row", { name: active.Name! })).toBeVisible();
    await expect(page.getByRole("row", { name: deleted.Name! })).not.toBeVisible();
  });
});