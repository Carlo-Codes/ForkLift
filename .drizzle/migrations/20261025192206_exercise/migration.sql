CREATE TABLE `exercise` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`muscleGroups` text NOT NULL,
	`equipment` text,
	`notes` text,
	`isBuiltIn` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer
);
