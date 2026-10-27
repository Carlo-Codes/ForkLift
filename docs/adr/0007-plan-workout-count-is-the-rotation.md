# A new Plan's number of Workouts is its rotation, not a weekly schedule

Creating a Plan in the app asks how many Workouts it has (3 by default) and names them after a
common split: 1 Full Body; 2 Upper, Lower; 3 Push, Pull, Legs; 4 Upper, Lower, Upper, Lower;
5 Push, Pull, Legs, Upper, Lower; 6 Push, Pull, Legs, Push, Pull, Legs. They start empty and can
be renamed.

The number is the Workouts the lifter cycles through, not Sessions per week. A per-week schedule
would put training days on the calendar and make a missed day something to catch up, which the
order-based rotation avoids: the next Workout is simply the one after the last done. For the same
reason progress is shown by Plan Week and Sessions done ("Week 3 of 6 · 7 sessions done"), never as
Sessions out of a planned total.

The AI's create_plan still makes an empty Plan; the defaults are only for the in-app form.
