import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import type { InvokeCommandInput } from '@aws-sdk/client-lambda';

import { Exception, UncaughtException } from '../../domain/exception';

const LOG_PREFIX = '[lambda.client]';

const lambda = new LambdaClient({ region: process.env.AWS_REGION });

type ExtraInvokeOptions = Partial<Omit<InvokeCommandInput, 'FunctionName' | 'Payload'>>;

export const invoke = async <T>(
	functionName: string,
	payload: unknown,
	invokeOptions?: ExtraInvokeOptions,
): Promise<T> => {
	console.debug(`${LOG_PREFIX} invoke: ${functionName}`);
	try {
		const response = await lambda.send(
			new InvokeCommand({
				FunctionName: functionName,
				Payload: JSON.stringify(payload),
				...invokeOptions,
			}),
		);

		const raw = response.Payload ? Buffer.from(response.Payload).toString('utf-8') : '';
		if (!raw) {
			return {} as T;
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return raw as T;
		}

		if (parsed && typeof parsed === 'object' && 'errorMessage' in parsed) {
			throw new UncaughtException(String((parsed as { errorMessage: unknown }).errorMessage));
		}

		return parsed as T;
	} catch (e) {
		if (e instanceof Exception) {
			throw e;
		}
		throw new UncaughtException(e instanceof Error ? e.message : String(e));
	}
};

export const invokeEvent = async (
	functionName: string,
	payload: unknown,
	invokeOptions?: Omit<ExtraInvokeOptions, 'InvocationType'>,
): Promise<null> => {
	console.debug(`${LOG_PREFIX} invokeEvent: ${functionName}`);
	try {
		await lambda.send(
			new InvokeCommand({
				FunctionName: functionName,
				Payload: JSON.stringify(payload),
				...invokeOptions,
				InvocationType: 'Event',
			}),
		);
		return null;
	} catch (e) {
		if (e instanceof Exception) {
			throw e;
		}
		throw new UncaughtException(e instanceof Error ? e.message : String(e));
	}
};
