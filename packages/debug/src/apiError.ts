export class ApiError extends Error {
  readonly statusCode: number;
  readonly type: string;

  constructor(statusCode: number, message: string, type = "ApiError") {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.type = type;
  }
}
