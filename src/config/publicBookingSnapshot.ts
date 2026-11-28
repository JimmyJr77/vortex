export type PublicWeeklyClassTime = { days: string; startTime: string; endTime: string }

export type PublicAdultBooking = {
  formId: number
  name: string
  checkedOn: string
  recurringTimes: PublicWeeklyClassTime[]
  monthlyTuitionCents: number | null
  dropInExcluded: boolean
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
    times: PublicWeeklyClassTime[]
    monthlyTuition: [number, number] | null
    dropIn: [number, number] | null
    dropInDays: string[]
    dropInCapacity: number | null
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
