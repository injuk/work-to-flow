export class Exception extends Error {
	readonly statusCode: number;

	constructor(message: string, statusCode: number) {
		super(message);
		this.name = this.constructor.name;
		this.statusCode = statusCode;
	}
}

export class BadRequestException extends Exception {
	constructor(message: string) {
		super(message, 400);
	}
}

export class InvalidArgumentException extends Exception {
	constructor(message: string) {
		super(message, 400);
	}
}

export class UnauthorizedException extends Exception {
	constructor(message: string) {
		super(message, 401);
	}
}

export class AccessDeniedException extends Exception {
	constructor(message: string) {
		super(message, 403);
	}
}

export class ResourceNotFoundException extends Exception {
	constructor(message: string) {
		super(message, 404);
	}
}

export class DuplicateProcessingException extends Exception {
	constructor(message: string) {
		super(message, 409);
	}
}

export class GoneException extends Exception {
	constructor(message: string) {
		super(message, 410);
	}
}

export class UncaughtException extends Exception {
	constructor(message: string) {
		super(message, 500);
	}
}

export class NotImplementedException extends Exception {
	constructor(message: string) {
		super(message, 501);
	}
}
