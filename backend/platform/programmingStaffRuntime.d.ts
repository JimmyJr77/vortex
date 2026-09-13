export class ProgrammingStaffError extends Error { readonly code: string; constructor(code: string, message: string) }
export interface ProgrammingSourceReference { readonly id: string; readonly title: string; readonly url: string }
export interface ProgrammingCapabilityResponse { readonly output: unknown; readonly modelVersion?: string | null;
  readonly usage?: { readonly inputTokens: number; readonly outputTokens: number } | null }
export interface ProgrammingCapabilityContext { readonly signal: AbortSignal; readonly maxOutputTokens: number; readonly outputSchema: object }
export interface ProgrammingCapability {
  readonly id: string
  readonly role: string
  readonly version: string
  readonly sourceReferences?: readonly ProgrammingSourceReference[]
  readonly invoke: (input: unknown, context: ProgrammingCapabilityContext) => Promise<ProgrammingCapabilityResponse>
}
export interface ProgrammingStaffRegistry {
  register(capability: ProgrammingCapability): void
  get(id: string, expectedRole: string): ProgrammingCapability & { readonly sourceReferences: readonly ProgrammingSourceReference[] }
  list(): { readonly id: string; readonly role: string; readonly version: string }[]
}
export interface ProgrammingStaffRunOptions {
  readonly maxCalls?: number
  readonly timeoutMs?: number
  readonly perCallTimeoutMs?: number
  readonly maxOutputTokens?: number
  readonly perCallOutputTokens?: number
  readonly maxInputCharacters?: number
  readonly signal?: AbortSignal
}
export interface ProgrammingStaffTrace {
  readonly calls: readonly { readonly capabilityId: string; readonly role: string; readonly capabilityVersion: string;
    readonly status: 'running' | 'validated' | 'failed'; readonly startedAt: string; readonly latencyMs: number;
    readonly modelVersion: string | null; readonly usage: { readonly inputTokens: number; readonly outputTokens: number } | null; readonly errorCode: string | null }[]
  readonly elapsedMs: number
  readonly outputTokensReserved: number
}
export interface ProgrammingStaffRun {
  /** Enforces cancellation and the shared deadline at deterministic stage boundaries. */
  assertActive(): void
  call<T>(args: { readonly capabilityId: string; readonly role: string; readonly input: unknown; readonly outputSchema: object;
    readonly parseOutput: (raw: unknown) => T }): Promise<Readonly<T>>
  telemetry(): ProgrammingStaffTrace
}
export function createProgrammingStaffRegistry(definitions?: readonly ProgrammingCapability[]): ProgrammingStaffRegistry
export function createProgrammingStaffRun(registry: ProgrammingStaffRegistry, options?: ProgrammingStaffRunOptions): ProgrammingStaffRun
