export class ImplementationError extends Error {
  public static readonly PREFIX = 'Unexpected ImplementationError. ';

  constructor(message: string = '') {
    super();
    this.message = `${ImplementationError.PREFIX}${message}`;
    this.stack = new Error().stack;
    this.name = this.constructor.name;
  }
}

/**
 * Throws a new unexpected `ImplementationError` indicating a development/refactoring issue.
 * @param errorMessage
 * @param debug send this object to console.error
 */
export function throwDevError(errorMessage: string, debug: any = 'myObject') : never {
  if (debug !== 'myObject') console.error(`${ImplementationError.PREFIX}${errorMessage}`, debug);
  throw new ImplementationError(errorMessage);
}
