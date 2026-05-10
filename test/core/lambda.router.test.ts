import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import Validator from '../../src/controller/validator';
import { apiRouterBase, type BaseEvent, type Routes } from '../../src/core/lambda.router';
import { UncaughtException } from '../../src/domain/exception';

describe('apiRouterBase', () => {
	beforeEach(() => {
		jest.spyOn(console, 'debug').mockImplementation(() => {});
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('event.function에 매칭되는 핸들러를 호출하고 결과를 그대로 반환한다', async () => {
		// Arrange
		const event: BaseEvent = { function: 'getWorkflow', id: 1 };
		const context = { requestId: 'req-1' };
		const expected = { ok: true };
		const handler = jest
			.fn<(e: BaseEvent, c: unknown) => Promise<unknown>>()
			.mockResolvedValue(expected);
		const routes: Routes = { getWorkflow: handler };

		// Act
		const result = await apiRouterBase(event, context, routes);

		// Assert
		expect(result).toBe(expected);
		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith(event, context);
	});

	it('options.Validator가 주어지면 핸들러 호출 전에 validate()를 호출한다', async () => {
		// Arrange
		const event: BaseEvent = { function: 'createWorkflow' };
		const calls: string[] = [];
		const validateMock = jest.fn(() => {
			calls.push('validate');
		});
		class StubValidator {
			constructor(_fn: string, _ev: unknown) {}
			validate = validateMock;
		}
		const handler = jest.fn(async () => {
			calls.push('handler');
			return 'done';
		});
		const routes: Routes = { createWorkflow: handler as never };

		// Act
		const result = await apiRouterBase(event, null, routes, {
			Validator: StubValidator as unknown as typeof Validator,
		});

		// Assert
		expect(result).toBe('done');
		expect(validateMock).toHaveBeenCalledTimes(1);
		expect(calls).toEqual(['validate', 'handler']);
	});

	it('options.Validator가 없으면 검증을 생략하고 핸들러를 호출한다', async () => {
		// Arrange
		const event: BaseEvent = { function: 'getWorkflow' };
		const handler = jest
			.fn<(e: BaseEvent, c: unknown) => Promise<string>>()
			.mockResolvedValue('ok');
		const routes: Routes = { getWorkflow: handler };

		// Act
		const result = await apiRouterBase(event, null, routes);

		// Assert
		expect(result).toBe('ok');
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('event.function이 빈 문자열이면 UncaughtException을 throw한다', async () => {
		// Arrange
		const event: BaseEvent = { function: '   ' };
		const handler = jest.fn();
		const routes: Routes = { foo: handler as never };

		// Act & Assert
		await expect(apiRouterBase(event, null, routes)).rejects.toBeInstanceOf(UncaughtException);
		expect(handler).not.toHaveBeenCalled();
	});

	it('event.function이 문자열이 아니면 UncaughtException을 throw한다', async () => {
		// Arrange
		const event = { function: 123 } as unknown as BaseEvent;
		const routes: Routes = {};

		// Act & Assert
		await expect(apiRouterBase(event, null, routes)).rejects.toBeInstanceOf(UncaughtException);
	});

	it('routes에 매칭되는 함수가 없으면 UncaughtException을 throw한다', async () => {
		// Arrange
		const event: BaseEvent = { function: 'unknownFunction' };
		const routes: Routes = { otherFunction: jest.fn() as never };

		// Act & Assert
		await expect(apiRouterBase(event, null, routes)).rejects.toBeInstanceOf(UncaughtException);
		await expect(apiRouterBase(event, null, routes)).rejects.toThrow(
			'there is no route for function(unknownFunction)',
		);
	});

	it('핸들러가 throw하면 그대로 다시 throw하고 에러 로그를 남긴다', async () => {
		// Arrange
		const event: BaseEvent = { function: 'getWorkflow' };
		const error = new Error('handler failed');
		const handler = jest.fn<() => Promise<never>>().mockRejectedValue(error);
		const routes: Routes = { getWorkflow: handler };
		const errorSpy = jest.spyOn(console, 'error');

		// Act & Assert
		await expect(apiRouterBase(event, null, routes)).rejects.toBe(error);
		expect(errorSpy).toHaveBeenCalled();
	});

	it('Validator.validate()가 throw하면 핸들러를 호출하지 않고 그 에러를 다시 throw한다', async () => {
		// Arrange
		const event: BaseEvent = { function: 'createWorkflow' };
		const validationError = new Error('invalid argument');
		class StubValidator {
			constructor(_fn: string, _ev: unknown) {}
			validate(): void {
				throw validationError;
			}
		}
		const handler = jest.fn();
		const routes: Routes = { createWorkflow: handler as never };

		// Act & Assert
		await expect(
			apiRouterBase(event, null, routes, {
				Validator: StubValidator as unknown as typeof Validator,
			}),
		).rejects.toBe(validationError);
		expect(handler).not.toHaveBeenCalled();
	});

	it('Validator는 functionName과 event 전체를 인자로 받아 인스턴스화된다', async () => {
		// Arrange
		const event: BaseEvent = { function: 'createWorkflow', payload: { name: 'wf' } };
		const ctorSpy = jest.fn();
		class StubValidator {
			constructor(fn: string, ev: unknown) {
				ctorSpy(fn, ev);
			}
			validate(): void {}
		}
		const handler = jest.fn<() => Promise<string>>().mockResolvedValue('ok');
		const routes: Routes = { createWorkflow: handler };

		// Act
		await apiRouterBase(event, null, routes, {
			Validator: StubValidator as unknown as typeof Validator,
		});

		// Assert
		expect(ctorSpy).toHaveBeenCalledWith('createWorkflow', event);
	});

	it('성공/실패 모두에서 finally의 종료 로그가 호출된다', async () => {
		// Arrange
		const debugSpy = jest.spyOn(console, 'debug');
		const okHandler = jest.fn<() => Promise<string>>().mockResolvedValue('ok');
		const failHandler = jest.fn<() => Promise<never>>().mockRejectedValue(new Error('boom'));
		const routes: Routes = { ok: okHandler, fail: failHandler };

		// Act
		await apiRouterBase({ function: 'ok' }, null, routes);
		await expect(apiRouterBase({ function: 'fail' }, null, routes)).rejects.toThrow('boom');

		// Assert: 두 호출 모두 종료 로그를 남긴다
		const endLogs = debugSpy.mock.calls.filter(([msg]) => msg === '[apiRouterBase] end');
		expect(endLogs).toHaveLength(2);
	});
});
