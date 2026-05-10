import { nanoid } from 'nanoid';

const DEFAULT_LENGTH = 24;

export default {
	create(): string {
		return nanoid(DEFAULT_LENGTH);
	},

	from(length: number): string {
		return nanoid(length);
	},
};
