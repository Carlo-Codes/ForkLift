CREATE TABLE `sessionIncrease` (
	`id` text PRIMARY KEY,
	`sessionId` text NOT NULL,
	`exerciseEntryId` text NOT NULL,
	`on` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer,
	CONSTRAINT `fk_sessionIncrease_sessionId_session_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `session`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_sessionIncrease_exerciseEntryId_exerciseEntry_id_fk` FOREIGN KEY (`exerciseEntryId`) REFERENCES `exerciseEntry`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessionIncrease_session_entry_idx` ON `sessionIncrease` (`sessionId`,`exerciseEntryId`);