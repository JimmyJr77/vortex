export default function ParticipantAgeField({ value, onChange }: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex min-w-[10rem] flex-1 flex-col gap-1 sm:max-w-[14rem]">
      <span className="text-xs font-semibold text-gray-600">Age on class date</span>
      <input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        placeholder="Any age"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
      />
    </label>
  )
}
