# Public combined contribution preparation and authorization

The public remittance preview and allocation-file API now accept positive employer contributions when the current allocation format, receipt contract and employer timing review support them. This replaces the previous blanket employer preparation rejection with current evidence checks.

The ten-column file retains separate employer matching and nonelective amounts. Its identity includes the current employer receipt contract, so even a receipt-only review change invalidates an older file authorization. Suspended receipt interpretation blocks preparation. Extended formats encode explicit zeros for categories absent from an employee-only allocation; positive employer amounts still require reviewed employer timing.

The retained file summary includes the receipt contract identity. Existing bank dispatch re-prepares the file and compares its substantive evidence and decrypted bytes before claiming payment, so this new identity participates in that comparison.

## Verification

Seven focused API/ledger/allocation tests passed with no failures or skips in 5.88 seconds (`/tmp/payroll-employer-public-file-tests.log`). The isolated approved employer fixture now exercises public file preparation and authorization, verifies ten columns and $24 combined funding, decrypts the retained CSV and verifies $10 pretax, $4 Roth, $6 matching and $4 nonelective. Concurrent identical API requests return one authorization; changed amounts and duplicate reservations fail. Receipt revision changes invalidate the old file fingerprint, and receipt suspension blocks a fresh file.

The broader regression run initially exceeded the local database connection limit (PostgreSQL 53300). That specific runner and its children were stopped, and the same coverage was restarted with two concurrent files. The bounded run passed all 53 tests with zero failures or skips in 50.73 seconds (`/tmp/payroll-employer-public-file-regression-bounded.log`), covering allocation delivery/recovery, receipt transport/intake/reconciliation, remittance dispatch and the employer fixture. Whitespace checks passed.

## Remaining integration

This verifies public preparation and reservation after an isolated fixture creates approved employer payroll. Public employer payroll approval is still unfinished. Combined provider delivery/receipt/settlement needs its own full synthetic journey; no live provider writes occurred. The allocation/receipt admin UI still needs employer column controls. Production deployment is not verified for this increment. The broader goal remains active.
