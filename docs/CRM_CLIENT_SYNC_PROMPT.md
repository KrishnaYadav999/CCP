# CRM implementation prompt: synchronize all live clients to CCP

Implement the CRM side of the CRM → CCP Client Master synchronization. The CRM currently shows 265 Live Applications but only the 218 Annual Return Applicable subset reached CCP. Fix the source selection and synchronization so all 265 live applications are present in CCP without duplicates.

## Source selection

- Build the sync source from the exact same canonical query used by CRM's **Live Applications** card and customer table.
- Include every client whose visibility is live/active.
- Exclude only discontinued and suspended clients, matching the CRM card rule.
- Do not filter by annual-return applicability, first annual-return year, CPCB status, approval status, or completed application status.
- Before sending, log and return these separate counts:
  - `liveApplicationsCount` — expected 265
  - `annualReturnApplicableCount` — currently 218
  - `syncSourceCount` — must equal `liveApplicationsCount`
- Abort with a clear error if `syncSourceCount !== liveApplicationsCount`. Never silently sync a partial subset.

## CCP API contract

- Endpoint: `POST {CCP_API_BASE_URL}/api/ccp/clients/bulk`
- Authenticate using the existing CCP shared-key header (`x-ccp-api-key` or the currently configured compatible shared-secret header). Never expose this value in the browser.
- Send from the CRM backend only.
- Chunk requests into 10 clients each to avoid hosted-request timeouts.
- Payload per chunk:

```json
{
  "clients": ["mapped canonical client objects"],
  "includeRecords": false,
  "expectedTotal": 265,
  "syncRunId": "stable UUID for this full sync"
}
```

- Continue through row-level validation failures, aggregate failures with original CRM client identity, and do not retry an ambiguous timed-out chunk unless every row has a stable idempotency identity.
- A client must carry stable identity values in `data.importMeta`, preferably:
  - `uniqueId` (for example `ATPL-0286`)
  - `ccpClientId` when already mapped
  - `leadNumber` when available
  - source CRM client ID
- Persist CCP's returned client ID/mapping in CRM when available.

## Mapping and data preservation

- Send all Client Master sections, including basic information, addresses, documents, CTE/CTO/CCA, CPCB credentials allowed for integration, CPCB screenshots, authorized contacts, annual-return year fields, assignment, visibility, and approval data.
- Preserve arrays and Cloudinary file metadata (`url`, `secureUrl`, `publicId`/`storageKey`, `resourceType`, `type`, `size`, original `name`).
- Do not send base64 media.
- Do not overwrite an existing CCP section with empty values when CRM lacks that section.
- Use upsert semantics based on stable client identity. Re-running the complete sync must still leave one CCP record per CRM client.

## Reconciliation

- After all chunks complete, call `GET {CCP_API_BASE_URL}/api/ccp/clients/reconciliation` with the shared key.
- Compare CRM live unique IDs against returned CCP identities.
- Display and return:
  - expected live count
  - successfully synced/upserted count
  - CCP stored count
  - missing CRM IDs
  - unexpected CCP IDs
  - row-level failures
- Mark the run successful only when all expected live CRM IDs exist in CCP. For the current dataset, CRM Live Applications and CCP Client Master must both show 265.

## UI and operations

- Add an admin-only **Sync all live clients to CCP** action with progress (`batch X of Y`).
- Show a final reconciliation modal; do not show success merely because HTTP requests completed.
- Keep the existing annual-return-applicable count as a separate metric. It may remain 218 and must not be used as the total Client Master sync count.
- Add structured server logs using `syncRunId`, chunk number, input count, upsert count, failure count, and duration.

## Required tests

1. Live query returns 265 while annual-return query returns 218.
2. Sync source uses the live query and sends all 265.
3. Requests are chunked into groups of 10.
4. Annual-return applicability does not filter the full client sync.
5. Re-running sync creates no duplicate CCP clients.
6. Missing IDs cause reconciliation failure with an explicit list.
7. Shared secret remains backend-only.
8. Cloudinary metadata remains intact and base64 is rejected.
9. Production build and CRM backend tests pass.
