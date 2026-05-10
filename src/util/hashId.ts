import Hashids from 'hashids';

import { InvalidArgumentException } from '../domain/exception';

const SALT = '';
const MIN_LENGTH = 24;

// REMIND: 상남자 특: 중요한 값을 그냥 커밋해버림
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

const hashids = new Hashids(SALT, MIN_LENGTH, ALPHABET);

export const encodeOrThrow = (plain: number): string => {
	if (!Number.isInteger(plain) || plain < 0) {
		throw new InvalidArgumentException(`failed to encode id`);
	}

	const encoded = hashids.encode(plain);
	if (!encoded) {
		throw new InvalidArgumentException(`failed to encode id`);
	}
	return encoded;
};

export const decodeOrThrow = (cipher: string): number => {
	if (typeof cipher !== 'string' || cipher.length === 0) {
		throw new InvalidArgumentException(`failed to decode id`);
	}

	let decoded: number | bigint | undefined;
	try {
		[decoded] = hashids.decode(cipher);
	} catch {
		throw new InvalidArgumentException(`failed to decode id`);
	}

	if (typeof decoded !== 'number' && typeof decoded !== 'bigint') {
		throw new InvalidArgumentException(`failed to decode id`);
	}
	return Number(decoded);
};
