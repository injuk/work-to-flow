import { describe, expect, it } from '@jest/globals';

import { decodeOrThrow, encodeOrThrow } from '../../src/util/hashId';
import { InvalidArgumentException } from '../../src/domain/exception';

describe('hashId', () => {
	describe('encodeOrThrow', () => {
		it('정수 id를 24자 이상의 영숫자 문자열로 인코딩한다', () => {
			// Arrange
			const id = 1;

			// Act
			const encoded = encodeOrThrow(id);

			// Assert
			expect(typeof encoded).toBe('string');
			expect(encoded.length).toBeGreaterThanOrEqual(24);
			expect(encoded).toMatch(/^[a-z0-9]+$/);
		});

		it('서로 다른 id는 서로 다른 결과로 인코딩된다', () => {
			// Arrange & Act
			const a = encodeOrThrow(1);
			const b = encodeOrThrow(2);

			// Assert
			expect(a).not.toBe(b);
		});

		it('음수 id는 InvalidArgumentException으로 거부된다', () => {
			// Act & Assert
			expect(() => encodeOrThrow(-1)).toThrow(InvalidArgumentException);
		});

		it('정수가 아닌 id는 InvalidArgumentException으로 거부된다', () => {
			// Act & Assert
			expect(() => encodeOrThrow(1.5)).toThrow(InvalidArgumentException);
		});
	});

	describe('decodeOrThrow', () => {
		it.each([1, 42, 12345, 99999999])('encode→decode 왕복은 항상 원래 값을 보존한다 (%i)', (id) => {
			// Arrange
			const encoded = encodeOrThrow(id);

			// Act
			const decoded = decodeOrThrow(encoded);

			// Assert
			expect(decoded).toBe(id);
		});

		it('빈 문자열은 InvalidArgumentException으로 거부된다', () => {
			// Act & Assert
			expect(() => decodeOrThrow('')).toThrow(InvalidArgumentException);
		});

		it('alphabet에 없는 문자가 섞이면 InvalidArgumentException으로 거부된다', () => {
			// Act & Assert
			expect(() => decodeOrThrow('!!!INVALID!!!')).toThrow(InvalidArgumentException);
		});

		it('알파벳에는 속하지만 디코드 불가능한 문자열은 거부된다', () => {
			// Arrange — 너무 짧아서 디코드되지 않는 입력
			// Act & Assert
			expect(() => decodeOrThrow('a')).toThrow(InvalidArgumentException);
		});
	});
});
