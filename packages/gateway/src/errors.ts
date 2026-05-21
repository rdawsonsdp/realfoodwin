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

export class ModelNotFoundError extends GatewayError {
  constructor(model: string, details?: unknown) {
    super(
      "MODEL_NOT_FOUND",
      `Anthropic model "${model}" was not found. An admin must pick a valid model at /admin/models.`,
      { model, ...(details && typeof details === "object" ? details : {}) },
    );
    this.name = "ModelNotFoundError";
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

// Thrown when the user explicitly asked for a real-food PRODUCT and the
// curated brand catalog has no match. The product-only goal must not fall
// through to a fresh LLM generation, since the LLM would invent product
// names that don't exist in the Real Food Win brand list.
export class NoLibraryProductsError extends GatewayError {
  constructor(query: string) {
    super(
      "NO_LIBRARY_PRODUCTS",
      `We don't carry a real-food product that matches "${query}" yet.`,
      { query },
    );
    this.name = "NoLibraryProductsError";
  }
}
