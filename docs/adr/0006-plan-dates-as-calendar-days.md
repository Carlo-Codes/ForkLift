# Plan dates are optional calendar days and don't choose the Active Plan

A Plan gets optional From and To dates. They're stored as `YYYY-MM-DD` text, not timestamps,
because a lifter means a day on the calendar, not an instant: a timestamp can shift by a day when
the phone changes time zone, or when a synced device in another zone reads it. If both dates are
set, To must be on or after From.

The dates are only shown to the lifter (for example "ends in 3 weeks", or "Ended" once To has
passed). They don't choose the Active Plan, which stays a manual choice. Letting the calendar
switch Plans on its own would surprise a lifter who runs a Plan past its end date or overlaps two
Plans. We may revisit this if lifters ask for scheduled Plan changes.

Plan dates are Plan data, not Session data, so AI Access can read and set them, and Changes by AI
records those edits. Backups include them. Backups made before the dates existed still import,
with no dates.
