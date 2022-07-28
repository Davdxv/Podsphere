export class ImplementationError extends Error {
  public static readonly PREFIX = 'Unexpected ImplementationError. ';

  constructor(message: string = '') {
    super();
    this.message = `${ImplementationError.PREFIX}${message}`;
    this.stack = new Error().stack;
    this.name = this.constructor.name;
  }
}

export function throwImplementationError(errorMessage: string) : never {
  throw new ImplementationError(errorMessage);
}

/**
 * Throws a new unexpected `ImplementationError` indicating a development/refactoring issue.
 * @alias throwImplementationError
 * @param errorMessage
 */
export function throwDevError(errorMessage: string) : never {
  throw new ImplementationError(errorMessage);
}
