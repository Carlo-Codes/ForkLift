CREATE TABLE `block` (
	`id` text PRIMARY KEY,
	`workoutId` text NOT NULL,
	`position` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer,
	CONSTRAINT `fk_block_workoutId_workout_id_fk` FOREIGN KEY (`workoutId`) REFERENCES `workout`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `exerciseEntry` (
	`id` text PRIMARY KEY,
	`blockId` text NOT NULL,
	`exerciseId` text NOT NULL,
	`position` integer NOT NULL,
	`targetSets` integer NOT NULL,
	`targetReps` integer NOT NULL,
	`targetWeight` real NOT NULL,
	`restSeconds` integer NOT NULL,
	`weightStep` real NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer,
	CONSTRAINT `fk_exerciseEntry_blockId_block_id_fk` FOREIGN KEY (`blockId`) REFERENCES `block`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_exerciseEntry_exerciseId_exercise_id_fk` FOREIGN KEY (`exerciseId`) REFERENCES `exercise`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `plan` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`isActive` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer
);
--> statement-breakpoint
CREATE TABLE `workout` (
	`id` text PRIMARY KEY,
	`planId` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer,
	CONSTRAINT `fk_workout_planId_plan_id_fk` FOREIGN KEY (`planId`) REFERENCES `plan`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
