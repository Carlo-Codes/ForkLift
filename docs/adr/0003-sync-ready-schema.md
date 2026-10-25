# The schema is sync-ready from day one

Sync isn't in v1, but it's planned Brave-style: the phone generates a sync code, and a relay stores
only end-to-end-encrypted data it can't read. Adding that to a schema with auto-increment numbers
and real deletes would mean a painful migration, so every synced table uses client-generated UUID
primary keys, an `updatedAt` timestamp and soft deletes (`deletedAt`) from the start. That's the
whole cost now. Merging changes from two devices is designed when sync is built.
