/**
 * Per-agent I/O schemas for the six agents defined in spec 5.3.
 *
 * Only the Phase-1 agents that need shared input/output contracts are exported
 * here. Recipe Builder (spec Phase-2 mobile), Recommender (Haiku, internal),
 * and Classifier (Haiku, internal) are intentionally omitted from the shared
 * types package for Phase 1 — their schemas live alongside the agent
 * implementations until they become part of the public API surface.
 */

export * from './swap-generator.js';
export * from './recipe-iterator.js';
export * from './quiz-summary.js';
export * from './embedder.js';
