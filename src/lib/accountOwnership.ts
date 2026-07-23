// src/lib/accountOwnership.ts
//
// Shared classification logic for the "who does this account belong to"
// grouping used by both AccountSelect (transaction forms) and
// AccountsHierarchyTable (Accounts page). Pure — no hooks — so it can be
// called from render without worrying about hook-order rules.

export type OwnerBucket = 'mine' | 'common' | 'spouse'

export function bucketOf(ownerId: string | null, myId: string | null): OwnerBucket {
  if (ownerId == null) return 'common'
  if (myId && ownerId === myId) return 'mine'
  return 'spouse'
}