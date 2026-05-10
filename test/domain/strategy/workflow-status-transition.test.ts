import { describe, expect, it } from '@jest/globals';

import { InvalidArgumentException } from '../../../src/domain/exception';
import { assertStatusTransitionAllowed } from '../../../src/domain/strategy/workflow-status-transition';

describe('assertStatusTransitionAllowed', () => {
	it.each(['DRAFT', 'ACTIVE', 'INACTIVE'] as const)(
		'%s → %s 같은 status로의 전이는 통과한다',
		(s) => {
			expect(() => assertStatusTransitionAllowed(s, s)).not.toThrow();
		},
	);

	it('DRAFT → ACTIVE 전이는 통과한다', () => {
		expect(() => assertStatusTransitionAllowed('DRAFT', 'ACTIVE')).not.toThrow();
	});

	it('DRAFT → INACTIVE 전이는 통과한다', () => {
		expect(() => assertStatusTransitionAllowed('DRAFT', 'INACTIVE')).not.toThrow();
	});

	it('ACTIVE → INACTIVE 전이는 통과한다', () => {
		expect(() => assertStatusTransitionAllowed('ACTIVE', 'INACTIVE')).not.toThrow();
	});

	it('INACTIVE → ACTIVE 전이는 통과한다', () => {
		expect(() => assertStatusTransitionAllowed('INACTIVE', 'ACTIVE')).not.toThrow();
	});

	it('ACTIVE → DRAFT 전이는 InvalidArgumentException을 throw한다', () => {
		expect(() => assertStatusTransitionAllowed('ACTIVE', 'DRAFT')).toThrow(
			InvalidArgumentException,
		);
	});

	it('INACTIVE → DRAFT 전이는 InvalidArgumentException을 throw한다', () => {
		expect(() => assertStatusTransitionAllowed('INACTIVE', 'DRAFT')).toThrow(
			InvalidArgumentException,
		);
	});
});
