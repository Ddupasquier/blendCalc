import { expect, test, waitForAppReady } from "./support/browserTest";
import { getLocalQaAccountForWorker } from "./support/localQaAccounts";

type BarcodeDraftResponse = {
  status: "found";
  draft: {
    alcoholByVolume?: { percent?: number };
    allergens?: string[];
    barcode: string;
    brandOwner?: string;
    hasSourceServing?: boolean;
    ingredients?: string;
    name: string;
    nutrients: Array<{ nutrientId: number; value: number }>;
    source: string;
  };
};

const representativeBarcodeExperiences = [
  {
    barcode: "00021130493609",
    name: "Roasted Onion & Garlic Pasta Sauce",
    brand: "Safeway, Inc.",
    expectedAlcoholByVolume: null,
    expectedAllergen: null,
    expectedAutofillStep: "Share",
    expectedSourceServing: true,
    minimumNutrientCount: 10,
  },
  {
    barcode: "00011110904416",
    name: "Blue Agave Light Golden Syrup",
    brand: "QA Pantry",
    expectedAlcoholByVolume: null,
    expectedAllergen: null,
    expectedAutofillStep: "Share",
    expectedSourceServing: false,
    minimumNutrientCount: 5,
  },
  {
    barcode: "09000000000209",
    name: "QA Federal Label Mystery Beer",
    brand: "blendCalc QA Beverage Lab",
    expectedAlcoholByVolume: 5.2,
    expectedAllergen: null,
    expectedAutofillStep: "Share",
    expectedSourceServing: false,
    minimumNutrientCount: 1,
  },
  {
    barcode: "09000000000216",
    name: "QA Wheat Beer",
    brand: "blendCalc QA Beverage Lab",
    expectedAlcoholByVolume: 5.4,
    expectedAllergen: "wheat",
    expectedAutofillStep: "Share",
    expectedSourceServing: false,
    minimumNutrientCount: 3,
  },
  {
    barcode: "09000000000230",
    name: "QA Sparkling Water",
    brand: "blendCalc QA Beverage Lab",
    expectedAlcoholByVolume: null,
    expectedAllergen: null,
    expectedAutofillStep: "Macros",
    expectedSourceServing: false,
    minimumNutrientCount: 1,
  },
] as const;

test("representative DB-first barcode results produce consistent manual-entry experiences", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(180_000);
  const account = getLocalQaAccountForWorker(testInfo.parallelIndex);
  testInfo.annotations.push({
    type: "QA account",
    description: account.email,
  });

  for (const expectedProduct of representativeBarcodeExperiences) {
    await test.step(expectedProduct.name, async () => {
      await page.goto("/ingredients/fridge/manual-entry");
      await waitForAppReady(page);

      const dialog = page.getByRole("dialog", { name: "Enter Manually" });
      const barcodeInput = dialog.getByLabel("UPC / Barcode");
      const responsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          response
            .url()
            .endsWith(`/api/products/barcode/${expectedProduct.barcode}`),
      );
      await barcodeInput.fill(expectedProduct.barcode);
      await barcodeInput.press("Tab");

      const response = await responsePromise;
      expect(response.status()).toBe(200);
      const body = (await response.json()) as BarcodeDraftResponse;
      expect(body.status).toBe("found");
      expect(body.draft).toMatchObject({
        barcode: expectedProduct.barcode,
        brandOwner: expectedProduct.brand,
        hasSourceServing: expectedProduct.expectedSourceServing,
        name: expectedProduct.name,
        source: "shared-catalog",
      });
      expect(body.draft.nutrients.length).toBeGreaterThanOrEqual(
        expectedProduct.minimumNutrientCount,
      );

      if (expectedProduct.expectedAlcoholByVolume === null) {
        expect(body.draft.alcoholByVolume).toBeUndefined();
      } else {
        expect(body.draft.alcoholByVolume?.percent).toBe(
          expectedProduct.expectedAlcoholByVolume,
        );
      }
      if (expectedProduct.expectedAllergen) {
        expect(body.draft.allergens).toContain(
          expectedProduct.expectedAllergen,
        );
      }

      await expect(
        dialog.getByText(`${expectedProduct.name} · ${expectedProduct.brand}`, {
          exact: true,
        }),
      ).toBeVisible();
      await dialog.getByRole("button", { name: "Autofill" }).click();
      await expect(
        dialog.getByRole("tab", { name: expectedProduct.expectedAutofillStep }),
      ).toHaveAttribute("aria-selected", "true");
      if (expectedProduct.expectedAutofillStep === "Share") {
        await expect(
          dialog.getByText(expectedProduct.name, { exact: true }).first(),
        ).toBeVisible();
      } else {
        await dialog.getByRole("tab", { name: "Identity" }).click();
        await expect(dialog.getByLabel("Food name")).toHaveValue(
          expectedProduct.name,
        );
        await expect(dialog.getByLabel("Brand")).toHaveValue(
          expectedProduct.brand,
        );
      }

      if (expectedProduct.expectedAlcoholByVolume !== null) {
        await dialog.getByRole("tab", { name: "Servings" }).click();
        await expect(dialog.getByLabel("Label format optional")).toHaveText(
          "Alcohol beverage label",
        );
        await expect(dialog.getByLabel("Alcohol by volume (%) *")).toHaveValue(
          String(expectedProduct.expectedAlcoholByVolume),
        );
      }

      await dialog.getByRole("button", { name: "Close sheet" }).click();
      await expect(dialog).toBeHidden();
    });
  }
  const heldPublicApiResponse = await page.request.get(
    "/api/v1/products/09000000000209",
  );
  expect(heldPublicApiResponse.status()).toBe(404);

  await page.goto("/ingredients/fridge/manual-entry");
  await waitForAppReady(page);
  const dialog = page.getByRole("dialog", { name: "Enter Manually" });
  const missingBarcode = "04006381333931";
  await page.route(
    `**/api/products/barcode/${missingBarcode}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "not-found",
          barcode: missingBarcode,
        }),
      });
    },
  );
  const notFoundResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().endsWith(`/api/products/barcode/${missingBarcode}`),
  );
  await dialog.getByLabel("UPC / Barcode").fill(missingBarcode);
  await dialog.getByLabel("UPC / Barcode").press("Tab");
  const notFoundResponse = await notFoundResponsePromise;
  expect(notFoundResponse.status()).toBe(200);
  await expect(
    dialog.getByText(
      "No source match found for this barcode yet. You can still save it; shared submissions will rely on label photos.",
    ),
  ).toBeVisible();
});
