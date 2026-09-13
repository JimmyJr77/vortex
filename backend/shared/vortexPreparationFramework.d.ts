export const VORTEX_PREPARATION_FRAMEWORK_VERSION: '1.0.0'
export type VortexPreparationPurpose = 'raise' | 'mobilize' | 'activate' | 'integrate' | 'potentiate_bridge'
export const VORTEX_PREPARATION_PURPOSES: readonly VortexPreparationPurpose[]
export const VORTEX_PREPARATION_SECTION: {
  readonly id: string; readonly title: string; readonly intro: string; readonly points: readonly string[];
  readonly table: { readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[] }
}
