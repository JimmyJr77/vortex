import DisciplineTagPicker from '../programs/DisciplineTagPicker'

interface Props {
  programId: number
  programDisplayName?: string | null
}

/** @deprecated Sport tags moved to Class edit modal. Kept as thin wrapper if referenced. */
const AdminSchedulingDisciplineTags = ({ programId, programDisplayName }: Props) => (
  <DisciplineTagPicker programId={programId} programDisplayName={programDisplayName} />
)

export default AdminSchedulingDisciplineTags
