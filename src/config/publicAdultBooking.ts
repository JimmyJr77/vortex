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
  } | null
}

declare const __PUBLIC_ADULT_BOOKING__: PublicAdultBooking | null

export const publicAdultBooking = __PUBLIC_ADULT_BOOKING__
