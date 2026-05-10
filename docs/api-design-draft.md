### 공통 모델
```typescript
type Nullable<T> = T | null;
type Nullish<T> = T | null | undefined;
type DateLike = Date | string | number;

interface Project {
	id: string;
}

interface Actioned {
	at: DateLike;
	by: By;
}

interface SimpleActioned {
	at: DateLike;
}

interface By {
	id: string;
	name: string;
	username: string;
}
```
---
### Workflow
#### 모델
```typescript
type WorkflowStatus = 'INACTIVE' | 'ACTIVE' | 'DRAFT';

interface Workflow {
	id: string; // hashid 라이브러리를 활용하여 number -> string 인코딩
	project: Project;
	name: string;
	description: Nullable<string>;
	status: WorkflowStatus;
	stepTree: WorkflowStep; // 하단의 ### WorkflowStep의 모델 섹션을 참고할 것
	created: Actioned;
	updated: SimpleActioned;
}

type WorkflowSummary = Omit<Workflow, 'description' | 'stepTree'>;
```
#### 생성
> `[POST] /workflows`
```typescript
interface Request {
	name: string;
	description?: string | null;
}

interface Response {
	id: string;
}
```
#### 목록 조회
>`[GET] /workflows`
```typescript
interface Request {
	limit?: number;
	status?: WorkflowStatus;
	nextToken?: string | null;
}

interface Response {
	results: WorkflowSummary[];
	nextToken: string | null;
}
```
#### 상세 조회
>`[GET] /workflows/{workflowId}`
```typescript
interface Request {
	id: string;
}

type Response = Workflow;
```
#### 수정
>`[PATCH] /workflows/{workflowId}`
```typescript
interface Request {
	id: string;
	data: {
		name?: string;
		description?: Nullable<string>;
		status?: 'ACTIVE' | 'INACTIVE'; // DRAFT는 초기 상태이므로, 해당 상태로 전이는 허용하지 않음
	};
}

type Response = null; // 204 No Response
```
#### 삭제
>`[DELETE] /workflows/{workflowId}`
```typescript
interface Request {
	id: string;
}

type Response = null; // 204 No Response
```
---
### WorkflowStepSchema
#### 모델
```typescript
type WorkflowStepSchemaType = 'START' | 'TRIGGER' | 'CHOICE' | 'SYNC_TASK' | 'ASYNC_TASK' | 'END';
interface WorkflowStepSchema {
	id: string; // hashid 라이브러리를 활용하여 number -> string 인코딩
	name: string;
	type: WorkflowStepSchemaType;
	condition: Record<string, unknown>;
	isHidden: boolean; // true인 경우 UI 상에서 보여지지 않아야 한다.
}
```
#### 목록 조회
>`[GET] /workflow-step-schemas`
- FE에서는 최초에 `?type=TRIGGER`로 조회한다. 이를 통해 첫 Step을 모두 조회할 수 있다.
- 사용자가 `TRIGGER` 타입 하나를 선택했을 경우, 해당 Step의 Id를 통해 `?frontSchemaId=stepId`로 검색한다. 이를 통해 해당 Step의 후속 Step들을 알 수 있다.
- 최종적으로 `END` 타입의 Step이 조회되며, 이게 조회되면 더 이상 Step을 이어갈 수 없는 종단 연산이 된다.
```typescript
interface Request {
	limit?: number;
	type?: WorkflowStepSchemaType; // TRIGGER로 조회하면 트리를 순회할 수 있다.
	frontSchemaId?: string;
	nextToken?: string | null;
}

interface Response {
	results: WorkflowStepSchema[];
	nextToken: string | null;
}
```
##### 참고 쿼리
- 대강 이렇게 하면 순회가 가능하지 않을까 하는 아이디어...
```sql
select FRONT_WSS.Name, FRONT_WSS.Type, REAR_WSS.Name, REAR_WSS.Type, REAR_WSS.`Condition` from WorkflowStepSchemas FRONT_WSS  
inner join StepSchemaRelations SSR on SSR.FrontSchemaId = FRONT_WSS.Id  
inner join WorkflowStepSchemas REAR_WSS on REAR_WSS.Id = SSR.RearSchemaId  
WHERE FRONT_WSS.Name = 'START'; -- START부터 END가 나올 때까지 Name을 바꿔가며 조회
```
---
### WorkflowStep
- Workflow에 Step 목록 PUT
- Workflow Step 목록 조회
#### 모델
```typescript
interface WorkflowStepSchemaSummary {
	id: string; // hashid 라이브러리를 활용하여 number -> string 인코딩
	name: string;
	type: WorkflowStepSchemaType;
	isHidden: boolean; // true인 경우 UI 상에서 보여지지 않아야 한다.
}

interface WorkflowStep {
	id: string; // 원래가 VARCHAR이므로 hashid를 사용할 필요가 없다.
	schema: WorkflowStepSchemaSummary;
	condition: Record<string, unknown>;
	children: WorkflowStep[];
}
```
#### 덮어쓰기
>`[PUT] /workflows/{workflowId}/steps`
- `PUT` 메소드를 사용하므로, `WorkflowStep` 트리 수정은 일부 수정을 지원하지 않는다. 오로지 덮어쓰기 방식만!
- 즉, DB에서는 임의의 `Workflow`에 묶인 모든 `WorkflowStep`을 제거한 후, 사용자가 요청한 트리 형태로 재생성한다.
```typescript
interface RequestedStepTree {
	schema: WorkflowStepSchemaSummary;
	condition: Record<string, unknown>;
	children: Omit<WorkflowStep, "id">[];
}

interface Request {
	stepTree: RequestedStepTree;
}

type Response = null; // 204 No Response
```
---
### WorkflowExecution
- `WorkflowExecution`은 `TRIGGER`에 의해 자동 실행되므로 생성 API를 제공하지 않는다.
#### 모델
```typescript
type WorkflowStepExecutionStatus = "READY" | "RUNNING" | "SUSPENDED" | "CANCELED" | "FAILED" | "COMPLETED" | "SKIPPED";

interface WorkflowStepExecution {
	id: string; // hashid 라이브러리를 활용하여 number -> string 인코딩
	schema: WorkflowStepSchemaSummary;
	status: WorkflowStepExecutionStatus;
	children: WorkflowStepExecution[];
	started: Nullable<SimpleActioned>;
	updated: Nullable<SimpleActioned>;
	ended: Nullable<SimpleActioned>;
}

type WorkflowExecutionStatus = "RUNNING" | "PARTIAL_FAILED" | "FAILED" | "COMPLETED" | "CANCELED" | "EXPIRED";

interface WorkflowExecution {
	id: string; // UUID v7
	workflow: {
		id: string; // hashid 라이브러리를 활용하여 number -> string 인코딩
	};
	status: WorkflowExecutionStatus;
	summary: {
		totalStepCount: number;
		successCount: number;
		canceledCount: number;
		skippedCount: number;
		failureCount: number;
	};
	stepExecutionTree: WorkflowStepExecution;
	started: SimpleActioned;
	updated: SimpleActioned;
	canceled: Nullable<SimpleActioned>;
	ended: Nullable<SimpleActioned>;
}

type WorkflowExecutionSummary = Omit<WorkflowExecution, "summary">;
```
#### 목록 조회
>`[GET] /workflows/{workflowId}/executions`
```typescript
interface Request {
	limit?: number;
	statuses?: WorkflowExecutionStatus[];
	nextToken?: string | null;
}

interface Response {
	results: WorkflowExecutionSummary[];
	nextToken: string | null;
}
```

#### 상세 조회
>`[GET] /workflows/{workflowId}/executions/{executionId}`
```typescript
interface Request {
	id: string;
}

type Response = WorkflowExecution;
```

#### 삭제 (진짜 지원해야 할까...)
>`[DELETE] /workflows/{workflowId}/executions/{executionId}`
```typescript
interface Request {
	id: string;
}

type Response = null; // 204 No Response
```

---
### WorkflowStepExecution
- `WorkflowStepExecution`은 백엔드에서 자동으로 생성되고, 자동으로 상태가 변화하므로 별도의 API를 제공하지 않는다.