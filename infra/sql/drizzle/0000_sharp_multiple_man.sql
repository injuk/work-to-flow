CREATE TABLE `StepSchemaRelations` (
	`Id` int unsigned AUTO_INCREMENT NOT NULL,
	`FrontSchemaId` int unsigned NOT NULL,
	`RearSchemaId` int unsigned NOT NULL,
	`Label` varchar(100) NOT NULL,
	CONSTRAINT `StepSchemaRelations_Id` PRIMARY KEY(`Id`),
	CONSTRAINT `StepSchemaRelations_uq_1` UNIQUE(`FrontSchemaId`,`RearSchemaId`)
);
--> statement-breakpoint
CREATE TABLE `WorkflowExecutions` (
	`Id` varchar(36) NOT NULL,
	`IdempotencyKey` varchar(64) NOT NULL,
	`WorkflowId` int unsigned NOT NULL,
	`Status` varchar(50) NOT NULL DEFAULT 'RUNNING',
	`TotalStepCount` int unsigned NOT NULL,
	`SuccessCount` int unsigned NOT NULL DEFAULT 0,
	`CanceledCount` int unsigned NOT NULL DEFAULT 0,
	`SkippedCount` int unsigned NOT NULL DEFAULT 0,
	`FailureCount` int unsigned NOT NULL DEFAULT 0,
	`StartedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`UpdatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`CanceledAt` datetime,
	`EndedAt` datetime,
	CONSTRAINT `WorkflowExecutions_Id` PRIMARY KEY(`Id`),
	CONSTRAINT `WorkflowExecutions_uq_1` UNIQUE(`IdempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `WorkflowResumeTriggers` (
	`Id` int unsigned AUTO_INCREMENT NOT NULL,
	`StepExecutionId` int unsigned NOT NULL,
	`Key` varchar(100) NOT NULL,
	CONSTRAINT `WorkflowResumeTriggers_Id` PRIMARY KEY(`Id`),
	CONSTRAINT `WorkflowResumeTriggers_uq_1` UNIQUE(`StepExecutionId`)
);
--> statement-breakpoint
CREATE TABLE `WorkflowStartTriggers` (
	`Id` int unsigned AUTO_INCREMENT NOT NULL,
	`WorkflowId` int unsigned NOT NULL,
	`Key` varchar(100) NOT NULL,
	CONSTRAINT `WorkflowStartTriggers_Id` PRIMARY KEY(`Id`),
	CONSTRAINT `WorkflowStartTriggers_uq_1` UNIQUE(`WorkflowId`)
);
--> statement-breakpoint
CREATE TABLE `WorkflowStepExecutions` (
	`Id` int unsigned AUTO_INCREMENT NOT NULL,
	`ExecutionId` varchar(36) NOT NULL,
	`StepId` varchar(24) NOT NULL,
	`Status` varchar(50) NOT NULL DEFAULT 'READY',
	`Input` text NOT NULL,
	`Output` text NOT NULL,
	`StartedAt` datetime,
	`UpdatedAt` datetime,
	`EndedAt` datetime,
	CONSTRAINT `WorkflowStepExecutions_Id` PRIMARY KEY(`Id`),
	CONSTRAINT `WorkflowStepExecutions_uq_1` UNIQUE(`ExecutionId`,`StepId`)
);
--> statement-breakpoint
CREATE TABLE `WorkflowStepSchemas` (
	`Id` int unsigned AUTO_INCREMENT NOT NULL,
	`Name` varchar(100) NOT NULL,
	`Type` varchar(20) NOT NULL,
	`Condition` text NOT NULL,
	`IsHidden` boolean NOT NULL DEFAULT false,
	CONSTRAINT `WorkflowStepSchemas_Id` PRIMARY KEY(`Id`),
	CONSTRAINT `WorkflowStepSchemas_uq_1` UNIQUE(`Name`)
);
--> statement-breakpoint
CREATE TABLE `WorkflowSteps` (
	`Id` varchar(24) NOT NULL,
	`WorkflowId` int unsigned NOT NULL,
	`SchemaId` int unsigned NOT NULL,
	`Condition` text NOT NULL,
	`ParentId` varchar(24),
	`Position` int unsigned NOT NULL DEFAULT 0,
	CONSTRAINT `WorkflowSteps_Id` PRIMARY KEY(`Id`),
	CONSTRAINT `WorkflowSteps_uq_1` UNIQUE(`WorkflowId`,`ParentId`,`Position`)
);
--> statement-breakpoint
CREATE TABLE `Workflows` (
	`Id` int unsigned AUTO_INCREMENT NOT NULL,
	`ProjectId` varchar(50) NOT NULL,
	`Name` varchar(100) NOT NULL,
	`Description` varchar(1024),
	`Status` varchar(20) NOT NULL DEFAULT 'DRAFT',
	`CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`UpdatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`CreatedById` varchar(100) NOT NULL,
	CONSTRAINT `Workflows_Id` PRIMARY KEY(`Id`)
);
--> statement-breakpoint
ALTER TABLE `StepSchemaRelations` ADD CONSTRAINT `StepSchemaRelations_fk_1` FOREIGN KEY (`FrontSchemaId`) REFERENCES `WorkflowStepSchemas`(`Id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `StepSchemaRelations` ADD CONSTRAINT `StepSchemaRelations_fk_2` FOREIGN KEY (`RearSchemaId`) REFERENCES `WorkflowStepSchemas`(`Id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `WorkflowExecutions` ADD CONSTRAINT `WorkflowExecutions_fk_1` FOREIGN KEY (`WorkflowId`) REFERENCES `Workflows`(`Id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `WorkflowResumeTriggers` ADD CONSTRAINT `WorkflowResumeTriggers_fk_1` FOREIGN KEY (`StepExecutionId`) REFERENCES `WorkflowStepExecutions`(`Id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `WorkflowStartTriggers` ADD CONSTRAINT `WorkflowStartTriggers_fk_1` FOREIGN KEY (`WorkflowId`) REFERENCES `Workflows`(`Id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `WorkflowStepExecutions` ADD CONSTRAINT `WorkflowStepExecutions_fk_1` FOREIGN KEY (`ExecutionId`) REFERENCES `WorkflowExecutions`(`Id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `WorkflowSteps_idx_1` ON `WorkflowSteps` (`WorkflowId`,`Id`);--> statement-breakpoint
ALTER TABLE `WorkflowSteps` ADD CONSTRAINT `WorkflowSteps_fk_1` FOREIGN KEY (`WorkflowId`) REFERENCES `Workflows`(`Id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `WorkflowSteps` ADD CONSTRAINT `WorkflowSteps_fk_2` FOREIGN KEY (`SchemaId`) REFERENCES `WorkflowStepSchemas`(`Id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `WorkflowSteps` ADD CONSTRAINT `WorkflowSteps_fk_3` FOREIGN KEY (`WorkflowId`,`ParentId`) REFERENCES `WorkflowSteps`(`WorkflowId`,`Id`) ON DELETE cascade ON UPDATE no action;
