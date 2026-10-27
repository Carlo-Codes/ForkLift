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

## Update: start date and weeks

In the app a lifter picks a start date (today by default) and a length in weeks (8 by default)
rather than two dates, because training plans are counted in weeks. They are still stored as From
and To: To is From + weeks × 7 − 1 days. A To set otherwise (by the AI, or before this change)
reads as the weeks it covers, rounded up. Weeks count from From as Plan Weeks, so the app can show
how far through a Plan the lifter is ("Week 3 of 6") and a Plan Calendar of its Sessions. Progress
is shown only; it still doesn't choose or end the Active Plan.
