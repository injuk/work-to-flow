import { z } from 'zod';
import { InvalidArgumentException } from '../../domain/exception';

const schemas: Record<string, z.ZodTypeAny> = {};

export default class Validator {
  private readonly functionName: string;
  private readonly event: unknown;

  constructor(functionName: string, event: unknown) {
    this.functionName = functionName;
    this.event = event;
  }

  validate(): void {
    const schema = schemas[this.functionName];
    if (!schema) {
      return;
    }

    const result = schema.safeParse(this.event);
    if (!result.success) {
      throw new InvalidArgumentException(
        `validation failed for ${this.functionName}: ${result.error.message}`,
      );
    }
  }
}
