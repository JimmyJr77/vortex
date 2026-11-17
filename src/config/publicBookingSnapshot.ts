export type PublicAdultBooking = {
  checkedOn: string
  monthlyTuitionCents: number | null
  dropIn: {
    firstDate: string
    lastDate: string
    startTime: string
    endTime: string
    priceCents: number
    freeTrial: boolean
    maxParticipants: number | null
  } | null
}

export type PublicYouthBooking = {
  checkedOn: string
  classes: {
    formId: number
    name: string
    times: { days: string; startTime: string; endTime: string }[]
    monthlyTuition: [number, number] | null
    dropIn: [number, number] | null
    dropInDays: string[]
    dropInExcluded: boolean
  }[]
}

export type PublicBookingSnapshot = {
  '/adult-gymnastics': PublicAdultBooking | null
  '/gymnastics': PublicYouthBooking | null
  '/fit-and-flip': PublicYouthBooking | null
}

declare const __PUBLIC_BOOKING_SNAPSHOT__: PublicBookingSnapshot | null

export const publicBookingSnapshot = __PUBLIC_BOOKING_SNAPSHOT__
