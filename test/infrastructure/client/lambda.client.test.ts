import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { Exception, UncaughtException } from '../../../src/domain/exception';

const sendMock = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const InvokeCommandMock = jest.fn((input: unknown) => ({ input }));

jest.unstable_mockModule('@aws-sdk/client-lambda', () => ({
	LambdaClient: jest.fn(() => ({ send: sendMock })),
	InvokeCommand: InvokeCommandMock,
}));

const { invoke, invokeEvent } = await import('../../../src/infrastructure/client/lambda.client');

const encode = (value: unknown): Uint8Array =>
	new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));

describe('lambda.client', () => {
	beforeEach(() => {
		jest.spyOn(console, 'debug').mockImplementation(() => {});
		sendMock.mockReset();
		InvokeCommandMock.mockClear();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('invoke', () => {
		it('응답 Payload(JSON)를 파싱해 제네릭 타입으로 반환한다', async () => {
			// given
			interface Workflow {
				id: number;
				name: string;
			}
			sendMock.mockResolvedValue({ Payload: encode({ id: 7, name: 'wf' }) });

			// when
			const result = await invoke<Workflow>('fn-name', { foo: 1 });

			// then
			expect(result).toEqual({ id: 7, name: 'wf' });
			expect(InvokeCommandMock).toHaveBeenCalledWith(
				expect.objectContaining({
					FunctionName: 'fn-name',
					Payload: JSON.stringify({ foo: 1 }),
				}),
			);
		});

		it('invokeOptions를 InvokeCommand 입력에 병합한다', async () => {
			// given
			sendMock.mockResolvedValue({ Payload: encode({}) });

			// when
			await invoke('fn', null, { Qualifier: '$LATEST' });

			// then
			expect(InvokeCommandMock).toHaveBeenCalledWith(
				expect.objectContaining({ Qualifier: '$LATEST' }),
			);
		});

		it('Payload가 비어 있으면 빈 객체를 반환한다', async () => {
			// given
			sendMock.mockResolvedValue({ Payload: undefined });

			// when
			const result = await invoke('fn', null);

			// then
			expect(result).toEqual({});
		});

		it('Payload가 JSON 파싱 불가하면 원본 문자열을 그대로 반환한다', async () => {
			// given
			sendMock.mockResolvedValue({ Payload: encode('not-json-just-text') });

			// when
			const result = await invoke<string>('fn', null);

			// then
			expect(result).toBe('not-json-just-text');
		});

		it('응답에 errorMessage가 있으면 UncaughtException을 throw한다', async () => {
			// given
			sendMock.mockResolvedValue({
				Payload: encode({ errorMessage: 'lambda failure' }),
			});

			// when & then
			await expect(invoke('fn', null)).rejects.toBeInstanceOf(UncaughtException);
			await expect(invoke('fn', null)).rejects.toThrow('lambda failure');
		});

		it('SDK가 일반 Error를 throw하면 UncaughtException으로 래핑한다', async () => {
			// given
			sendMock.mockRejectedValue(new Error('network down'));

			// when & then
			await expect(invoke('fn', null)).rejects.toBeInstanceOf(UncaughtException);
			await expect(invoke('fn', null)).rejects.toThrow('network down');
		});

		it('SDK가 Exception 계열을 throw하면 그대로 다시 throw한다', async () => {
			// given
			class TeapotException extends Exception {
				constructor() {
					super('teapot', 418);
				}
			}
			const original = new TeapotException();
			sendMock.mockRejectedValue(original);

			// when & then
			await expect(invoke('fn', null)).rejects.toBe(original);
		});
	});

	describe('invokeEvent', () => {
		it('성공 시 null을 반환한다', async () => {
			// given
			sendMock.mockResolvedValue({ Payload: encode({ ignored: true }) });

			// when
			const result = await invokeEvent('fn', { msg: 'hi' });

			// then
			expect(result).toBeNull();
		});

		it('InvocationType을 항상 Event로 강제한다', async () => {
			// given
			sendMock.mockResolvedValue({ Payload: undefined });

			// when
			await invokeEvent('fn', { msg: 'hi' });

			// then
			expect(InvokeCommandMock).toHaveBeenCalledWith(
				expect.objectContaining({
					FunctionName: 'fn',
					Payload: JSON.stringify({ msg: 'hi' }),
					InvocationType: 'Event',
				}),
			);
		});

		it('SDK 에러는 UncaughtException으로 래핑한다', async () => {
			// given
			sendMock.mockRejectedValue(new Error('sdk error'));

			// when & then
			await expect(invokeEvent('fn', null)).rejects.toBeInstanceOf(UncaughtException);
			await expect(invokeEvent('fn', null)).rejects.toThrow('sdk error');
		});

		it('Exception 계열은 그대로 다시 throw한다', async () => {
			// given
			class CustomEx extends Exception {
				constructor() {
					super('custom', 500);
				}
			}
			const original = new CustomEx();
			sendMock.mockRejectedValue(original);

			// when & then
			await expect(invokeEvent('fn', null)).rejects.toBe(original);
		});
	});
});
