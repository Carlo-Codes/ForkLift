# UI/UX redesign and the unified Plan editor

The decisions from the design session (2026-10-27). The work is split into issues 1–9 below, done
in order. Terms are as in `GLOSSARY.md`; plan dates are in ADR-0006.

## Look

- Every screen except Settings is redesigned. Settings is out of scope for the redesign, but it
  picks up the new theme tokens so it doesn't stand out.
- Light and dark themes follow the system setting. Tokens for both live in the shared Tailwind
  config.
- Cards with rounded corners and soft surfaces replace bordered outline buttons. Brand orange is
  an accent only, and the orange header bar goes.
- Large titles. Touch targets are compact, at least 44pt and no bigger.
- Icons come from `@expo/vector-icons`.
- Every screen respects safe-area insets, so nothing sits under the phone's system bar or home
  indicator (Expo SDK 58 is edge-to-edge).

## Navigation and Home

- A bottom tab bar (Home, Plans, History, Library, Settings), inset for the safe area. Workout
  Mode is full screen, with no tab bar. It keeps its small header with Back.
- The tab bar shows only on each tab's root screen. Screens opened from a tab (Plan, Workout,
  Exercise, Session detail) are pushed over it on the root stack.
- Home shows one card: the next Workout's name, its Plan, and a compact list of its Exercise
  Entries (e.g. "Bench 3×8 · Row 3×10 · …"). Below that are a normal-height **Start** button and a
  "Choose another" text link.
- If a Session is in progress, the card becomes **Resume**. With no Active Plan, it says
  "Create a plan" and links to the Plans tab.

## Plans list

- A large **Create plan** button is pinned at the bottom, above the tab bar.
- Each Plan is a card showing its name, its dates (or "No dates"), its Workout names, and an
  **Active** badge.
- A Plan whose To date has passed shows a grey **Ended** label and keeps its place in the list.
- The list is newest first. Plans can no longer be reordered by hand.
- Long-press a card to make it the Active Plan or to delete it.

## Plan editor (creating and editing use the same page)

- **Create plan** opens the editor with the name field focused. The Plan is saved as soon as it
  has a name, and every change after that saves straight away. There is no Save button.
- A new Plan starts with three empty Workouts: **Push**, **Pull** and **Legs**.
- The name is a large title you edit in place.
- **From** and **To** date chips open the native date picker, and each has a "×" to clear it. If
  both are set, To must be on or after From; otherwise an error shows inline.
- An **Active Plan** toggle row.
- **Delete plan** is in the header's ⋯ menu and asks for confirmation.
- **Workout tabs**: a tab row that scrolls sideways when there are many Workouts.
  - Tap a tab to switch to it.
  - Drag a tab to reorder it.
  - Long-press a tab for Rename or Delete (Delete asks for confirmation).
  - "+" at the end adds "Day N".
- Below the tabs is the selected Workout's list of Exercise Entries. The Workout editor screen
  goes; editing it happens here.

### Exercise list

- **Add exercise** opens a searchable picker of the Exercise Library, with **New exercise** at
  the top. The chosen Exercise is added with the default targets (3×10, 90s rest).
- **Touch and drag** a row to reorder it straight away. Dragging a Superset moves the whole
  group, and the Exercise Entries inside a Superset can be reordered too.
- **Long-press** a row to open its editor in place: sets, reps, weight and rest steppers, plus
  **Remove**. Tapping anywhere else closes it. A tap without moving does nothing.
- A Superset shows as a bordered group labelled "Superset". Its header shows the **Round Rest**
  (the longest rest among its Exercise Entries). Editing it sets the rest of every Exercise Entry
  in the group, and an Exercise Entry added to the group takes that rest. The rest field on each
  row still works.
- Removing an Exercise Entry doesn't ask for confirmation. An **Undo** snackbar shows for a few
  seconds instead.

### Select mode

- **Select** puts a tick box on each row. A bottom bar then offers:
  - **Create Superset**, with two or more ticked. The ticked rows become one Superset at the
    position of the top-most ticked row, keeping their order, even if they weren't next to each
    other. Ticking an existing Superset as well adds the other rows to it.
  - **Ungroup**, when the ticked rows include part of a Superset.
  - **Remove**, for any ticked rows, with Undo.

## Data changes

- `plan` gets nullable `startDate` and `endDate` columns, stored as `YYYY-MM-DD` text (ADR-0006).
  This needs a migration and the on-device bootstrap SQL.
- The Plan service validates the dates. Backups include them, and older backups without them
  still import.
- AI Access tools read and set Plan dates, and Changes by AI records those edits.
- `core` needs a call that groups any set of Blocks or Exercise Entries into one Superset, not
  only neighbouring ones, and a call that sets the Round Rest.
- Creating a Plan seeds its Push, Pull and Legs Workouts in the same transaction.
- Manual Plan ordering goes from `core` and AI Access too: `reorderPlans` and the `reorder_plans`
  tool are removed. `position` only breaks ties between Plans created in the same millisecond.

## Issues

1. **Theme foundation**: light/dark tokens, card and button components, icons, safe-area insets
   on every screen, header restyle.
2. **Bottom tab navigation and the new Home.**
3. **Plan dates**: schema, migration, core service, backups, AI Access tools.
4. **Plans list**: cards, pinned Create button, newest-first order, long-press actions.
5. **Unified Plan editor**: title, dates, Active toggle, Workout tabs (Push/Pull/Legs by
   default), Add exercise picker. This replaces the Workout editor.
6. **Inline exercise editing**: long-press to open a row's editor, Round Rest on the Superset
   header, Remove with Undo.
7. **Select mode**: Create Superset across rows that aren't neighbours, Ungroup, Remove several
   at once.
8. **Drag to reorder**: Exercise Entries, Supersets and Workout tabs.
9. **Restyle History, Exercise Library and Workout Mode** to the new theme.
