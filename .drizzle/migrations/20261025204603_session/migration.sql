CREATE TABLE `loggedSet` (
	`id` text PRIMARY KEY,
	`sessionId` text NOT NULL,
	`exerciseEntryId` text NOT NULL,
	`exerciseId` text NOT NULL,
	`round` integer NOT NULL,
	`reps` integer NOT NULL,
	`weight` real NOT NULL,
	`completedAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer,
	CONSTRAINT `fk_loggedSet_sessionId_session_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `session`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_loggedSet_exerciseEntryId_exerciseEntry_id_fk` FOREIGN KEY (`exerciseEntryId`) REFERENCES `exerciseEntry`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `fk_loggedSet_exerciseId_exercise_id_fk` FOREIGN KEY (`exerciseId`) REFERENCES `exercise`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`workoutId` text NOT NULL,
	`status` text NOT NULL,
	`blocks` text NOT NULL,
	`startedAt` integer NOT NULL,
	`finishedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer,
	CONSTRAINT `fk_session_workoutId_workout_id_fk` FOREIGN KEY (`workoutId`) REFERENCES `workout`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT
);
--> statement-breakpoint
ALTER TABLE `plan` ADD `nextWorkoutId` text;