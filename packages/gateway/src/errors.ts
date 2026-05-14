export class GatewayError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

export class AnthropicCallError extends GatewayError {
  constructor(message: string, details?: unknown) {
    super("ANTHROPIC_CALL_FAILED", message, details);
    this.name = "AnthropicCallError";
  }
}

export class SchemaValidationError extends GatewayError {
  constructor(message: string, details?: unknown) {
    super("SCHEMA_VALIDATION_FAILED", message, details);
    this.name = "SchemaValidationError";
  }
}

export class ContextLoadError extends GatewayError {
  constructor(message: string, details?: unknown) {
    super("CONTEXT_LOAD_FAILED", message, details);
    this.name = "ContextLoadError";
  }
}

export class VoyageCallError extends GatewayError {
  constructor(message: string, details?: unknown) {
    super("VOYAGE_CALL_FAILED", message, details);
    this.name = "VoyageCallError";
  }
}
