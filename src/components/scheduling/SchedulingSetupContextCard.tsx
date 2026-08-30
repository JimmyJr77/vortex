interface Props {
  primary: string
  secondary?: string | null
  className?: string
}

const SchedulingSetupContextCard = ({ primary, secondary, className = '' }: Props) => (
  <div className={`rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 ${className}`.trim()}>
    <p className="font-semibold text-black">{primary}</p>
    {secondary?.trim() ? (
      <p className="text-sm text-gray-600 mt-1">{secondary.trim()}</p>
    ) : (
      <p className="text-sm text-gray-400 mt-1 italic">No label</p>
    )}
  </div>
)

export default SchedulingSetupContextCard
