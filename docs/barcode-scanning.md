# Barcode Scanning

The custom ingredient form supports UPC-A, UPC-E, EAN-8, EAN-13, GTIN-14, and
uncompressed GS1 Digital Link product QR codes.

This document owns code detection, identifier parsing, camera behavior, and scan
privacy. Product enrichment and publication belong in
[`shared-product-catalog.md`](shared-product-catalog.md); provider fields and legal
boundaries belong in the
[`source data inventory`](api-structures/source-data-inventory.md) and
[`licensing ledger`](data-source-licensing.md).

## Current Web Flow

1. The browser uses `BarcodeDetector` when the API is available.
2. Other supported browsers fall back to `@zxing/browser`.
3. A GS1 product QR is parsed locally. Its valid `01` GTIN is sent through the same
   lookup as a linear barcode; the scanned URL is never requested.
4. The normalized GTIN enters the shared product-lookup flow.
5. Imported values stay in the form until the user reviews and saves them.

Camera access requires HTTPS outside local development. Users can always type the
barcode and nutrition label manually.

## Data And Accuracy

- Barcode and custom-food name uniqueness are enforced per user, not globally.
- Eligible user-entered labels can be submitted to the shared catalog only through an
  explicit opt-in.
- GS1 lot, serial, expiration, query, and fragment values are not persisted.
- Random, HTTP, credential-bearing, compressed/unsupported, and invalid-GTIN QR links
  are rejected instead of opened or guessed.
- Unknown products require package, nutrition-label, and barcode photos before catalog
  review.

Missing-value, nutrient-mapping, serving, source-review, caching, and evidence rules are
defined by the catalog and data-architecture documents linked above.

## Future Native App

The scanner UI already routes native Capacitor builds through
`@capacitor/barcode-scanner`. When the native shell is created:

1. Install `@capacitor/cli`, `@capacitor/ios`, and `@capacitor/android`.
2. Initialize Capacitor and add the iOS and Android platforms.
3. Add the iOS camera usage description.
4. Confirm Android camera permissions and the plugin's minimum SDK requirements.
5. Test OAuth deep links and barcode scanning on physical devices.

The product lookup and custom-food review flow are platform-independent and do not need
to be rewritten.
