# ForkLift

A free, open-source app for planning and running set-based weight-training workouts, with no
account and no tracking.

## Planning

**Plan**:
A named collection of Workouts that the lifter cycles through in order (e.g. "Push / Pull / Legs").
_Avoid_: Program, routine, split

**Active Plan**:
The one Plan whose next Workout is offered on the home screen. Only one Plan is active at a time.
_Avoid_: Current plan, selected plan

**Workout**:
A planned training day within a Plan, made of an ordered list of Blocks (e.g. "Push day").
_Avoid_: Routine, day, template

**Block**:
One step of a Workout: either a single Exercise Entry (straight sets) or a Superset.
_Avoid_: Group, section, circuit

**Superset**:
A Block of two or more Exercise Entries performed alternately, one set of each per round, with rest
only after each round.
_Avoid_: Circuit, giant set, combo

**Exercise**:
A movement in the Exercise Library, such as "Bench Press". Built-in and user-added Exercises are
treated the same way.
_Avoid_: Movement, lift

**Exercise Library**:
All Exercises available to the lifter: the ones ForkLift ships with plus any the lifter adds, all
editable.
_Avoid_: Exercise database, catalogue

**Exercise Entry**:
An Exercise placed in a Block with its targets: number of sets, reps, weight and rest time.
_Avoid_: Workout exercise, slot, item

**Weight Step**:
How much an Exercise Entry's target weight rises when Increase Next Time is applied (default 2.5kg
or 5lb).
_Avoid_: Increment, progression amount

## Training

**Session**:
One performance of a Workout, from Start to finish, together with its Logged Sets. Sessions are
history and are never edited by the AI.
_Avoid_: Workout (for a performed workout), log, training

**Logged Set**:
A set actually performed in a Session, recording the reps and weight really done.
_Avoid_: Set record, entry

**Workout Mode**:
The full-screen experience during a Session that shows the current set, what comes next and the
rest countdown.
_Avoid_: Gym mode, active view, player

**Increase Next Time**:
A per-Exercise-Entry toggle in Workout Mode. When the Session ends, it raises that entry's target
weight by its Weight Step.
_Avoid_: Progress, level up, auto-progression

## AI

**AI Access**:
The lifter-controlled switch that lets an AI assistant on the same network read their data and
change future Plans and Workouts.
_Avoid_: MCP mode, AI sync, integration

**Changes by AI**:
The list of every change an AI made through AI Access, each one undoable.
_Avoid_: AI log, audit trail, history
