### 전제조건
- 아래 모든 API는 `projectId` 헤더를 필수로 요구한다.

### 공통 모델
```typescript
type Nullable<T> = T | null;
type Nullish<T> = T | null | undefined;
type DateLike = Date | string | number;

interface Project {
	id: string;
}

interface Actioned {
	at: string; // 내부에서는 DateLike이지만, HTTP 응답에서는 ISO 표준에 맞는 문자열로 변환할 것
	by: By;
}

interface SimpleActioned {
	at: string; // 내부에서는 DateLike이지만, HTTP 응답에서는 ISO 표준에 맞는 문자열로 변환할 것
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
- `projectId`는 헤더에서 전달 받는다.
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
- 항상 `created.at` 기준 내림차순 정렬한다.
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
- `DRAFT` -> `ACTIVE` / `INACTIVE`로의 전환은 `stepTree`가 온전히 생성된 경우에만 가능하다.
  수정 API에서 내부적으로 `stepTree`의 무결성을 반드시 검증한다.
- **중요**: 초기 구현에서는 `stepTree`가 항상 맞다고 가정하되, 추후 검증 로직을 작성할 수 있도록 검증하는 부분은 반드시 별도 모듈로 추출해야 한다.
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
- `WorkflowStepSchemaType`에는 `START`와 `TRIGGER`가 존재한다. 두 의미가 모호할 수 있으나, 언제나 실제 시작점은 `START`가 된다. 두 타입의 차이점은, `START`(및 `END`)는 `isHidden`이 항상 `true`이므로 사용자에게 보여지지 않는다.
  (`START`와 `END` 두 타입은 사용자에게 보여지지 않는다. 해당 타입들은 오로지 `StepSchemaRelations`에서 사용되기 위해 추가된 값이며, 사용자는 두 타입을 인지할 수 없어야 한다.)
- 각 Step에서 무엇을 할 수 있는지는 `condition`에 정의한다. 예를 들어, `CHOICE` Step에서 어떤 선택지를 고를 수 있는지는 `condition`에 명시된다.
- `condition`은 Step의 종류에 따라 모두 다르지만, 공통적으로 `json schema validator` 문법을 따르는 JSON 문서가 저장된다. 검증할 것이 없는 경우, 빈 객체 문자열(`'{}'`)을 저장한다.
```typescript
type WorkflowStepSchemaType = 'START' | 'TRIGGER' | 'CHOICE' | 'SYNC_TASK' | 'ASYNC_TASK' | 'END';
interface WorkflowStepSchema {
	id: string; // hashid 라이브러리를 활용하여 number -> string 인코딩
	name: string;
	type: WorkflowStepSchemaType;
	condition: Record<string, unknown>;
	isHidden: boolean; // true인 경우 UI 상에서 보여지지 않아야 한다.
	// label: string; // REMIND: label은 개발자들의 운영 편의성을 위해 도입된 값이므로, 외부에 노출하지 않는다.
}
```
#### 목록 조회
>`[GET] /workflow-step-schemas`
- 항상 `id` 기준 오름차순 정렬한다.
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
- `condition`은 `WorkflowStepSchema.condition`이 제시하는 조건에 맞는 값이 저장된다.
  물론, 각 `WorkflowStep`이 참조하는 `WorkflowStepSchema`의 종류에 따라 `condition`의 형태가 달라진다.
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
- **중요**: 초기 구현에서는 `stepTree`가 항상 맞다고 가정하되, 추후 검증 로직을 작성할 수 있도록 검증하는 부분은 반드시 별도 모듈로 추출해야 한다.
- 초기 버전에서는 `RequestedStep`의 가장 깊은 흐름을 따라갔을 때, 깊이가 20을 넘지 않도록 제한한다.
```typescript
interface RequestedStep {
	schemaId: string;
	condition: Record<string, unknown>;
	children: RequestedStep[];
}

interface Request {
	stepTree: RequestedStep;
}

type Response = null; // 204 No Response
```
---
### WorkflowExecution
- `WorkflowExecution`은 `TRIGGER`에 의해 자동 실행되므로 생성 API를 제공하지 않는다.
- 정책상 `CANCELED` 상태가 존재하지만, 명시적인 '취소' 요청은 개발 팀 내 논의 후 도입을 결정한다.
    - 즉, 현재로서는 해당 상태로 전이하는 동작을 의도적으로 제공하지 않는다.
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

type WorkflowExecutionSummary = Omit<WorkflowExecution, "summary" | "stepExecutionTree">;
```
#### 목록 조회
>`[GET] /workflows/{workflowId}/executions`
- 항상 `id` 기준 내림차순 정렬한다.
  (이는 UUID v7이 생성일자를 반영하는 점을 이용한다.)
```typescript
interface Request {
	limit?: number;
	statuses?: WorkflowExecutionStatus[]; // RUNNING,PARTIAL_FAILED와 같이 쉼표로 구분
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
- 정책상 `SUSPENDED` 상태가 존재하지만, 이는 실행 엔진에 의해서만 전이될 수 있는 상태값이다.
    - 즉, 해당 상태로 전이하는 동작은 의도적으로 제공하지 않는다. `resume`도 마찬가지.
- 정책상 `CANCELED` 상태가 존재하지만, 명시적인 '취소' 요청은 개발 팀 내 논의 후 도입을 결정한다.
    - 즉, 현재로서는 해당 상태로 전이하는 동작을 의도적으로 제공하지 않는다.