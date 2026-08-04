const UNAVAILABLE_DATABASE_ERROR_CODES = new Set([
  'CONNECTION_CLOSED',
  'CONNECTION_DESTROYED',
  'CONNECTION_ENDED',
  'CONNECT_TIMEOUT',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'ETIMEDOUT',
  '57P01',
  '57P02',
  '57P03',
  '53300',
]);

type ErrorWithCode = {
  code?: unknown;
};

export class DatabaseUnavailableError extends Error {
  readonly code = 'DATABASE_UNAVAILABLE';

  constructor() {
    super('Database is temporarily unavailable. Please try again later.');
    this.name = 'DatabaseUnavailableError';
  }
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const code = (error as ErrorWithCode).code;
  return typeof code === 'string' ? code : undefined;
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  const code = getErrorCode(error);
  return code !== undefined && (code.startsWith('08') || UNAVAILABLE_DATABASE_ERROR_CODES.has(code));
}

export function toDatabaseUnavailableError(error: unknown): DatabaseUnavailableError {
  if (error instanceof DatabaseUnavailableError) {
    return error;
  }

  return new DatabaseUnavailableError();
}
