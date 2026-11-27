# CronoSheet Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every document under `/users/{userId}` and its subcollections (`security`, `goals`, `tips`, `roadmap`) belongs exclusively to `userId` (`ownerId == userId == request.auth.uid`). No cross-user read, list, create, update, or delete is ever permitted.
2. **Verified Identity Gate**: All write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Path Variable Hardening**: Every single-document operation (`get`, `create`, `update`, `delete`) validates `isValidId(userId)` and `isValidId(docId)` (`<= 128` chars matching `^[a-zA-Z0-9_\-]+$`). Under `/security/{securityDocId}`, only `'mfa'` and `'encryption'` are allowed.
4. **Relational Integrity**: Tips (`tips/{tipId}`) reference a valid `goalId` existing under `/users/{userId}/goals/{goalId}` on creation and whenever `goalId` changes on update.
5. **Immutable Audit & Temporal Integrity**: `ownerId` and `createdAt` are immutable after creation; `createdAt == request.time` on create and `updatedAt == request.time` on create/update.
6. **Strict Schema & Encryption Quota Enforcement**: Every write passes a dedicated `isValid[Entity]()` validator enforcing `hasAll`, `hasOnly`, exact types, regex patterns, and `.size()` caps synced verbatim with `firebase-blueprint.json` (including AES-256-GCM envelope headroom). `security/encryption` strictly caps `switchesThisMonth` in `[0, 2]` with monotonic month/counter checks so clients cannot bypass the 2-switches/month limit.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Read/Write**: `auth = null` attempting `get /users/u1/goals/g1` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: `auth = { uid: 'u1', token: { email_verified: false } }` creating a goal -> `PERMISSION_DENIED`.
3. **Cross-User Read (PII/MFA/Encryption Leak)**: `auth.uid = 'u2'` attempting `get /users/u1/security/mfa` or `/users/u1/security/encryption` -> `PERMISSION_DENIED`.
4. **Cross-User List Scraping**: `auth.uid = 'u2'` attempting `list /users/u1/goals` -> `PERMISSION_DENIED`.
5. **OwnerId Spoofing on Create**: `auth.uid = 'u1'` creating `/users/u1/goals/g1` with `ownerId: 'u2'` -> `PERMISSION_DENIED`.
6. **Shadow Field Injection**: `auth.uid = 'u1'` creating a goal or encryption doc with extra field `isAdmin: true` -> `PERMISSION_DENIED`.
7. **ID Poisoning**: `auth.uid = 'u1'` creating `/users/u1/goals/<200-char-invalid-id!@#>` or `/users/u1/security/arbitrary` -> `PERMISSION_DENIED`.
8. **Payload Size Exhaustion (DoW)**: `auth.uid = 'u1'` creating a goal with `notes` > 4096 characters -> `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: `auth.uid = 'u1'` creating a goal with forged `createdAt` != `request.time` -> `PERMISSION_DENIED`.
10. **Immutable Field Tampering**: `auth.uid = 'u1'` updating `createdAt` or `ownerId` on an existing goal -> `PERMISSION_DENIED`.
11. **Encryption Quota Bypass**: `auth.uid = 'u1'` writing `switchesThisMonth: 3`, resetting `switchesThisMonth` downward within the same `switchesMonth`, or rewinding `switchesMonth` -> `PERMISSION_DENIED`.
12. **Orphaned Tip & Unbounded Array**: `auth.uid = 'u1'` creating a tip referencing a non-existent `goalId`, or writing > 10 items to `backupCodeHashes` -> `PERMISSION_DENIED`.
