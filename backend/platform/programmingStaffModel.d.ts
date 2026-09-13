import type { LanguageModel } from 'ai'
import type { ProgrammingCapability, ProgrammingSourceReference } from './programmingStaffRuntime.js'
export type ProgrammingModelRole = 'director' | 'athlete_development' | 'methodology_consultant' | 'session_builder' | 'prepare_access' | 'programming_critic'
export const PROGRAMMING_ROLE_INSTRUCTIONS: Readonly<Record<ProgrammingModelRole, string>>
export function createProgrammingStaffModelInvoker(options: { readonly model: LanguageModel; readonly role: ProgrammingModelRole;
  readonly modelVersion?: string | null; readonly sourceReferences?: readonly ProgrammingSourceReference[] }): ProgrammingCapability['invoke']
