import { describe, expect, it } from '@jest/globals';

import type { BaseEvent } from '../../src/core/lambda.router';
import { requireProjectId } from '../../src/core/request';
import { InvalidArgumentException } from '../../src/domain/exception';

describe('requireProjectId', () => {
	it('headers.projectId(camelCase)에서 값을 읽는다', () => {
		// Arrange
		const event: BaseEvent = { function: 'x', headers: { projectId: 'proj-1' } };

		// Act
		const result = requireProjectId(event);

		// Assert
		expect(result).toBe('proj-1');
	});

	it('headers.projectid(소문자)에서도 값을 읽는다', () => {
		// Arrange
		const event: BaseEvent = { function: 'x', headers: { projectid: 'proj-2' } };

		// Act
		const result = requireProjectId(event);

		// Assert
		expect(result).toBe('proj-2');
	});

	it('headers가 없으면 InvalidArgumentException을 throw한다', () => {
		// Arrange
		const event: BaseEvent = { function: 'x' };

		// Act & Assert
		expect(() => requireProjectId(event)).toThrow(InvalidArgumentException);
	});

	it('projectId 값이 빈 문자열이면 InvalidArgumentException을 throw한다', () => {
		// Arrange
		const event: BaseEvent = { function: 'x', headers: { projectId: '' } };

		// Act & Assert
		expect(() => requireProjectId(event)).toThrow(InvalidArgumentException);
	});

	it('projectId 값이 공백만 있으면 InvalidArgumentException을 throw한다', () => {
		// Arrange
		const event: BaseEvent = { function: 'x', headers: { projectId: '   ' } };

		// Act & Assert
		expect(() => requireProjectId(event)).toThrow(InvalidArgumentException);
	});

	it('camelCase와 소문자가 모두 있으면 camelCase 우선', () => {
		// Arrange
		const event: BaseEvent = {
			function: 'x',
			headers: { projectId: 'camel', projectid: 'lower' },
		};

		// Act
		const result = requireProjectId(event);

		// Assert
		expect(result).toBe('camel');
	});
});
