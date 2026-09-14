# Rehearsal security policy draft

Rehearsal handles sensitive database topology and may process sanitized derivatives of
production data. Do not include credentials, connection strings, raw data, or a real
baseline in a public report.

Before public release, the package repository must enable private vulnerability
reporting and publish its exact security contact. Until then, report a suspected issue
privately to the BlendCalc repository owner. Do not open a public issue containing an
exploit, secret, hosted target, or source record.

Supported security updates will cover the latest released 0.x minor only during beta.
A security fix may deliberately tighten configuration or refuse a workflow that an
earlier beta accepted. No current file in this directory is a published package.

The threat boundary and explicit non-guarantees live in [README.md](README.md). A public
release is blocked until secret-canary tests, dependency audit, package-content audit,
the Linux fixture proof, and private-reporting metadata pass together on the release
candidate. The current Linux proof passes locally; it must be repeated in protected CI.
