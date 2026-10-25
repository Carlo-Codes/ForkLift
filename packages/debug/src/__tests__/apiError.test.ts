import { ApiError } from "../apiError";

describe("ApiError", () => {
  it("sets statusCode, message, name and a default type", () => {
    const error = new ApiError(404, "not found");

    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("not found");
    expect(error.name).toBe("ApiError");
    expect(error.type).toBe("ApiError");
    expect(error).toBeInstanceOf(Error);
  });

  it("accepts a custom type", () => {
    const error = new ApiError(400, "bad input", "ValidationError");

    expect(error.type).toBe("ValidationError");
  });
});
