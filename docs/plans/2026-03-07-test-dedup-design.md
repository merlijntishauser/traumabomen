# Test Deduplication: useTreeMutations Linked Entity Tests

## Problem

`useTreeMutations.test.tsx` is 2,237 lines. Five linked-entity test groups
(events, life events, turning points, classifications, patterns) each have
11 near-identical tests. That is ~1,300 lines of copy-paste code differing
only in entity names, API mocks, test data shapes, and assertion fields.

## Scope

Only the 5 linked-entity groups. Persons, relationships, batch updates, and
journal entries have unique shapes and stay as-is.

## Approach: Test Factory Function

A `describeLinkedEntityMutations(config)` function generates a full
`describe` block with all 11 tests. Each entity becomes a single call.

### Config interface

```typescript
interface LinkedEntityTestConfig {
  name: string;                // "event", "life event", etc.
  idPrefix: string;            // "e", "le", "tp", "c", "pat"
  hookAccessor: (result: HookResult) => MutationGroup;
  queryKeySegment: string;     // "events", "lifeEvents", etc.
  apiCreate: () => MockFn;
  apiUpdate: () => MockFn;
  apiDelete: () => MockFn;
  testData: Record<string, unknown>;
  existingEntry: Record<string, unknown>;
  optimisticChecks: (entry: Record<string, unknown>) => void;
  rollbackChecks: (entry: Record<string, unknown>) => void;
}
```

### 11 generated tests per entity

1. create encrypts then calls API
2. create invalidates query key
3. update encrypts then calls API
4. optimistic update applies to cache
5. empty cache handled gracefully
6. unknown entity ID skipped
7. rollback on error
8. no-context error is no-op
9. invalidate on settled
10. delete calls API without encryption
11. delete invalidates query key

### API mock references use thunks

`() => mockedApi.createEvent` instead of `mockedApi.createEvent` because
the mock instances need to be accessed at test runtime, not config time.

### Factory injects common fields

The factory adds `id` and `person_ids` to `existingEntry` using the
`idPrefix`, so configs only specify domain-specific fields.

## Estimated result

- Factory function: ~200 lines
- 5 entity configs: ~150 lines total (~30 each)
- Untouched tests (persons, relationships, batch, journal): ~450 lines
- Total: ~800 lines (down from 2,237)

## Files changed

- `frontend/src/hooks/useTreeMutations.test.tsx` (rewrite linked-entity sections)
