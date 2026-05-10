import uniqueId from '../../src/core/unique-id';

describe('unique-id', () => {
	describe('create', () => {
		it('기본 길이 24의 문자열을 생성한다', () => {
			// Arrange — no setup

			// Act
			const result = uniqueId.create();

			// Assert
			expect(typeof result).toBe('string');
			expect(result).toHaveLength(24);
		});

		it('호출할 때마다 서로 다른 값을 반환한다', () => {
			// Arrange
			const iterations = 1000;

			// Act
			const ids = new Set<string>();
			for (let i = 0; i < iterations; i++) {
				ids.add(uniqueId.create());
			}

			// Assert
			expect(ids.size).toBe(iterations);
		});
	});

	describe('from', () => {
		it.each([1, 8, 16, 32, 64])('전달한 길이(%i)만큼의 문자열을 생성한다', (length) => {
			// Arrange — length 파라미터로 전달됨

			// Act
			const result = uniqueId.from(length);

			// Assert
			expect(typeof result).toBe('string');
			expect(result).toHaveLength(length);
		});
	});
});
