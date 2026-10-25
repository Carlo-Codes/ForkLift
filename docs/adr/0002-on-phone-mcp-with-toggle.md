# The MCP server runs on the phone, behind an AI Access switch

The lifter's AI assistant reaches their data through an MCP server inside the app. It's started from
Settings → AI Access, serves Streamable HTTP on the local Wi-Fi, needs a pairing token, is off by
default and switches itself off when idle. We chose this because it's the only v1 option that lets
the AI write without an account: changes land straight in the phone's database. The cost is that it
only works on the same network, only while the app is open on iOS (Android can use a background
service), and needs a native HTTP server module, so the app needs an Expo dev build rather than Expo
Go.

The AI can read everything, and can create Plans or edit future Workouts. It can never change
Sessions or Logged Sets. Everything it does is recorded in Changes by AI with Undo. A change to the
Workout of an in-progress Session takes effect from the next Session.

## Considered Options

- **MCP on a computer, reading an exported backup file**: rejected. It's read-only in practice,
  because AI edits to the copy would clash with the phone's data on re-import.
- **MCP on a computer, using the sync code**: the best option long-term (works anywhere, phone not
  needed), but it depends on sync ([ADR-0003](./0003-sync-ready-schema.md)). Planned for after
  sync. Its tool definitions should be shared with the phone server.
- **Hosted MCP**: rejected. It would need an account.
