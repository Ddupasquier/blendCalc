# Barcode scanning

The custom ingredient form supports UPC-A, UPC-E, EAN-8, EAN-13, and GTIN-14 package barcodes.

## Current web flow

1. The browser uses `BarcodeDetector` when the API is available.
2. Other supported browsers fall back to `@zxing/browser`.
3. The private Smoothie Mixer verified catalog is checked first.
4. USDA FoodData Central branded foods are checked next through the server-side cache.
5. Open Food Facts is used as the final live lookup source.
6. Imported nutrition stays in the form until the user reviews and saves it.

Camera access requires HTTPS outside local development. Users can always type the barcode and nutrition label manually.

## Data and accuracy

- Open Food Facts is community-maintained and may be incomplete.
- USDA branded records may use a different serving than the current package label.
- The UI identifies the source and requires review before saving.
- Barcode and custom-food name uniqueness are enforced per user, not globally.
- Eligible user-entered labels can be submitted to the shared catalog only through an explicit opt-in.
- Open Food Facts records remain live source lookups and are not copied into the shared catalog.
- USDA responses are cached in Supabase with expiration dates; Open Food Facts responses are not.
- Nutrients omitted by a source remain missing rather than being converted to zero.
- Unknown products require package, nutrition-label, and barcode photos before catalog review.

See [`shared-product-catalog.md`](shared-product-catalog.md) for verification, moderation, licensing, and deployment details.

## Future native app

The scanner UI already routes native Capacitor builds through `@capacitor/barcode-scanner`. When the native shell is created:

1. Install `@capacitor/cli`, `@capacitor/ios`, and `@capacitor/android`.
2. Initialize Capacitor and add the iOS and Android platforms.
3. Add the iOS camera usage description.
4. Confirm Android camera permissions and the plugin's minimum SDK requirements.
5. Test OAuth deep links and barcode scanning on physical devices.

The product lookup and custom-food review flow are platform-independent and do not need to be rewritten.
