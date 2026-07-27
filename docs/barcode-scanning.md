# Barcode scanning

The custom ingredient form supports UPC-A, UPC-E, EAN-8, EAN-13, GTIN-14, and
uncompressed GS1 Digital Link product QR codes.

## Current web flow

1. The browser uses `BarcodeDetector` when the API is available.
2. Other supported browsers fall back to `@zxing/browser`.
3. A GS1 product QR is parsed locally. Its valid `01` GTIN is sent through the same
   lookup as a linear barcode; the scanned URL is never requested.
4. The blendCalc verified catalog and legal source caches are checked first.
5. Missing product fields are filled independently. USDA remains the nutrition authority
   when it reports nutrition, while Open Food Facts may provide a missing image,
   category, or serving without replacing USDA nutrients.
6. Source nutrient keys and alternate USDA nutrient IDs resolve through approved
   database mappings and equivalences before manual-entry fields are populated.
7. Imported nutrition stays in the form until the user reviews and saves it.

Camera access requires HTTPS outside local development. Users can always type the
barcode and nutrition label manually.

## Data and accuracy

- Open Food Facts is community-maintained and may be incomplete.
- USDA branded records may use a different serving than the current package label.
- The UI identifies the source and requires review before saving.
- Barcode and custom-food name uniqueness are enforced per user, not globally.
- Eligible user-entered labels can be submitted to the shared catalog only through an
  explicit opt-in.
- Open Food Facts records remain live source lookups and are not copied into the shared
  catalog.
- USDA responses are cached in Supabase with expiration dates; Open Food Facts responses
  are not.
- Nutrients omitted by a source remain missing rather than being converted to zero.
- Reported zero values remain reported zero. Alternate IDs are canonicalized without
  changing the source value, and unit changes require an approved nutrient-specific
  conversion.
- GS1 lot, serial, expiration, query, and fragment values are not persisted.
- Random, HTTP, credential-bearing, compressed/unsupported, and invalid-GTIN QR links
  are rejected instead of opened or guessed.
- Unknown products require package, nutrition-label, and barcode photos before catalog
  review.

See [`shared-product-catalog.md`](shared-product-catalog.md) for verification,
moderation, licensing, and deployment details.

## Future native app

The scanner UI already routes native Capacitor builds through
`@capacitor/barcode-scanner`. When the native shell is created:

1. Install `@capacitor/cli`, `@capacitor/ios`, and `@capacitor/android`.
2. Initialize Capacitor and add the iOS and Android platforms.
3. Add the iOS camera usage description.
4. Confirm Android camera permissions and the plugin's minimum SDK requirements.
5. Test OAuth deep links and barcode scanning on physical devices.

The product lookup and custom-food review flow are platform-independent and do not need
to be rewritten.
