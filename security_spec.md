# Security Specification for AegisHelmet AI

## Data Invariants
1. A violation record must contain a valid vehicle registration number.
2. An alert must be linked to a valid user ID.
3. Only authorized users (RTO, Police) can modify the status of a violation.
4. User roles (Driver, RTO, Police) are immutable once assigned, except by manual administrative intervention.
5. All timestamps must be server-generated.

## The Dirty Dozen Payloads (Rejection Tests)
1. **Identity Spoofing**: Attempt to create a user profile with a different `userId` than the authenticated user.
2. **Privilege Escalation**: Attempt to set `role: "RTO"` during driver registration.
3. **Shadow Update**: Attempt to add a `isVerified: true` field to a user profile update.
4. **ID Poisoning**: Attempt to create a violation with a 1MB string as the document ID.
5. **State Shortcutting**: Attempt to update a violation status directly from "Pending" to "Closed" without proper authorization.
6. **Relational Sync Failure**: Attempt to create a violation for a non-existent vehicle registration (if strictly enforced).
7. **Timestamp Spoofing**: Attempt to provide a client-side `createdAt` timestamp.
8. **PII Leak**: Attempt to read another user's `guardianContact` without being RTO/Police.
9. **Resource Exhaustion**: Attempt to write a violation with a 1MB description string.
10. **Immutable Field Change**: Attempt to change the `vehicleNumber` of an existing violation.
11. **Type Mismatch**: Attempt to write `timestamp: 123` (number instead of string/timestamp).
12. **Orphaned Writes**: Attempt to create an alert without a corresponding user document exists.

## Test Runner (Logic Verification)
The `firestore.rules` will be validated against these scenarios.
