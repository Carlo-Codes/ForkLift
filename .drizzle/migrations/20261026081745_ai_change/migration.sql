CREATE TABLE `aiChange` (
	`id` text PRIMARY KEY,
	`summary` text NOT NULL,
	`rows` text NOT NULL,
	`undoneAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer
);
