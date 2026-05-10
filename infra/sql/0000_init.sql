CREATE TABLE IF NOT EXISTS Workflows (
    Id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    ProjectId    VARCHAR(50)   NOT NULL,
    Name         VARCHAR(100)  NOT NULL,
    Description  VARCHAR(1024) NULL,
    Status       VARCHAR(20)   NOT NULL DEFAULT 'DRAFT', -- DRAFT, ACTIVE, INACTIVE
    CreatedAt    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CreatedById  VARCHAR(100)  NOT NULL,
    PRIMARY KEY (Id)
) ENGINE = InnoDB
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS WorkflowStepSchemas (
    Id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    Name       VARCHAR(100) NOT NULL,
    Type       VARCHAR(20)  NOT NULL, -- TRIGGER, CHOICE, SYNC, ASYNC
    `Condition`  TEXT         NOT NULL,
    IsHidden   TINYINT(1)   NOT NULL DEFAULT b'0',
    PRIMARY KEY (Id),
    UNIQUE KEY WorkflowStepSchemas_uq_1 (Name)
) ENGINE = InnoDB
DEFAULT CHARSET = utf8;

CREATE TABLE IF NOT EXISTS StepSchemaRelations (
    Id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    FrontSchemaId    INT UNSIGNED NOT NULL, -- START Step이라면 NULL
    RearSchemaId     INT UNSIGNED NOT NULL, -- End Step이라면 NULL
    Label            VARCHAR(100) NOT NULL,
    PRIMARY KEY (Id),
    CONSTRAINT StepSchemaRelations_fk_1 FOREIGN KEY (FrontSchemaId) REFERENCES WorkflowStepSchemas (Id) ON DELETE CASCADE,
    CONSTRAINT StepSchemaRelations_fk_2 FOREIGN KEY (RearSchemaId) REFERENCES WorkflowStepSchemas (Id) ON DELETE CASCADE,
    UNIQUE KEY StepSchemaRelations_uq_1 (FrontSchemaId, RearSchemaId)
) ENGINE = InnoDB
DEFAULT CHARSET = utf8;

CREATE TABLE IF NOT EXISTS WorkflowSteps (
    Id          VARCHAR(24)  NOT NULL,
    WorkflowId  INT UNSIGNED NOT NULL,
    SchemaId    INT UNSIGNED NOT NULL,
    `Condition`   TEXT         NOT NULL,
    ParentId    VARCHAR(24)  NULL,
    Position    INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (Id),
    CONSTRAINT WorkflowSteps_fk_1 FOREIGN KEY (WorkflowId) REFERENCES Workflows (Id) ON DELETE CASCADE,
    CONSTRAINT WorkflowSteps_fk_2 FOREIGN KEY (SchemaId) REFERENCES WorkflowStepSchemas (Id), -- 이미 사용 중인 StepSchema 삭제시 에러를 던지기 위함
    CONSTRAINT WorkflowSteps_fk_3 FOREIGN KEY (WorkflowId, ParentId) REFERENCES WorkflowSteps (WorkflowId, Id) ON DELETE CASCADE,
    KEY WorkflowSteps_idx_1 (WorkflowId, Id), -- WorkflowSteps_fk_3가 참조하는 부모 컬럼 (WorkflowId, Id)에 대한 보조 인덱스
    UNIQUE KEY WorkflowSteps_uq_1 (WorkflowId, ParentId, Position)
) ENGINE = InnoDB
DEFAULT CHARSET = utf8;

CREATE TABLE IF NOT EXISTS WorkflowExecutions (
    Id              VARCHAR(36)  NOT NULL, -- UUID v7로 설정할 것
    IdempotencyKey  VARCHAR(64)  NOT NULL, -- 이벤트를 SHA256 인코딩한 값
    WorkflowId      INT UNSIGNED NOT NULL,
    Status          VARCHAR(50)  NOT NULL DEFAULT 'RUNNING', -- RUNNING, COMPLETED, PARTIAL_FAILED, CANCELED, FAILED, EXPIRED
    TotalStepCount  INT UNSIGNED NOT NULL,
    SuccessCount    INT UNSIGNED NOT NULL DEFAULT 0,
    CanceledCount   INT UNSIGNED NOT NULL DEFAULT 0,
    SkippedCount    INT UNSIGNED NOT NULL DEFAULT 0,
    FailureCount    INT UNSIGNED NOT NULL DEFAULT 0,
    StartedAt       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CanceledAt      DATETIME     NULL,
    EndedAt         DATETIME     NULL,
    PRIMARY KEY (Id),
    CONSTRAINT WorkflowExecutions_fk_1 FOREIGN KEY (WorkflowId) REFERENCES Workflows (Id) ON DELETE CASCADE,
    UNIQUE KEY WorkflowExecutions_uq_1 (IdempotencyKey)
) ENGINE = InnoDB
DEFAULT CHARSET = utf8;

CREATE TABLE IF NOT EXISTS WorkflowStepExecutions (
    Id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    ExecutionId     VARCHAR(36)  NOT NULL,
    StepId          VARCHAR(24)  NOT NULL,
    Status          VARCHAR(50)  NOT NULL DEFAULT 'READY', -- READY, RUNNING, SUSPENDED, CANCELED, FAILED, COMPLETED, SKIPPED
    Input           TEXT         NOT NULL,
    Output          TEXT         NOT NULL,
    StartedAt       DATETIME     NULL,
    UpdatedAt       DATETIME     NULL, -- 기본적으로 StartedAt, EndedAt과 동일. 다만 SUSPENDED / RESUME될 때도 업데이트 해줘야 한다!
    EndedAt         DATETIME     NULL,
    PRIMARY KEY (Id),
    CONSTRAINT WorkflowStepExecutions_fk_1 FOREIGN KEY (ExecutionId) REFERENCES WorkflowExecutions (Id) ON DELETE CASCADE,
    UNIQUE KEY WorkflowStepExecutions_uq_1 (ExecutionId, StepId)
) ENGINE = InnoDB
DEFAULT CHARSET = utf8;

CREATE TABLE IF NOT EXISTS WorkflowStartTriggers (
    Id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    WorkflowId  INT UNSIGNED NOT NULL,
    `Key`       VARCHAR(100) NOT NULL,
    PRIMARY KEY (Id),
    UNIQUE KEY WorkflowStartTriggers_uq_1 (WorkflowId), -- Workflow 당 시작 트리거는 1개
    CONSTRAINT WorkflowStartTriggers_fk_1 FOREIGN KEY (WorkflowId) REFERENCES Workflows (Id) ON DELETE CASCADE
) ENGINE = InnoDB
DEFAULT CHARSET = utf8;

CREATE TABLE IF NOT EXISTS WorkflowResumeTriggers (
    Id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    StepExecutionId  INT UNSIGNED NOT NULL,
    `Key`            VARCHAR(100) NOT NULL,
    PRIMARY KEY (Id),
    UNIQUE KEY WorkflowResumeTriggers_uq_1 (StepExecutionId), -- StepExecution 당 재개 트리거는 1개
    CONSTRAINT WorkflowResumeTriggers_fk_1 FOREIGN KEY (StepExecutionId) REFERENCES WorkflowStepExecutions (Id) ON DELETE CASCADE
) ENGINE = InnoDB
DEFAULT CHARSET = utf8;