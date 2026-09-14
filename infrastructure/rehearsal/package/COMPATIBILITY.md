# Rehearsal compatibility policy draft

Rehearsal will begin at `0.x`. Minor releases may contain breaking changes, but every
intentional break must be called out in the changelog with a migration path. Patch
releases must remain backward compatible within their minor line.

The following are public compatibility contracts once published:

- configuration property names, types, defaults, validation, and schema version;
- baseline format and checksum meaning;
- ordered migration digest semantics and classifications;
- CLI command names, flags, state-changing behavior, and exit codes;
- versioned JSON result and error envelopes;
- the meaning and ordering of verification gates.

A change to any of those requires either a compatible extension or a deliberate version
transition. Rehearsal must never silently reinterpret an old config, baseline, digest,
or successful verification receipt.

The first stable `1.0.0` requires external beta evidence, a support policy, and a settled
public API. Supporting additional database families, package managers, or operating
systems is not implied by the 0.x contract.
