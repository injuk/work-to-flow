export type Nullable<T> = T | null;

export type Nullish<T> = T | null | undefined;

export type DateLike = Date | string | number;

export interface Project {
	id: string;
}

export interface By {
	id: string;
	name: string;
	username: string;
}

export interface Actioned {
	at: DateLike;
	by: By;
}

export interface SimpleActioned {
	at: DateLike;
}

export type PublicModel<T extends { id: number }> = Omit<T, 'id'> & { id: string };
