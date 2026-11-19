import { APP_NAME } from './constants'

export const HOW_IT_WORKS_INTRO = 'Browse the catalog, lock your dates, and send a rental request. After you book, message us so we can confirm it and answer anything else you need.'

export const HOW_IT_WORKS_STEPS = [
  {
    title: 'Choose your gear',
    copy: 'Open Equipment and pick the equipment you need. Each listing shows the daily rate and what is included.',
    image: '/how-it-works/choose-gear.png',
    imageAlt: 'Equipment catalog showing Starlink Mini, DJI Air 3, and DJI OSMO 360 with daily rates',
    imageWide: true,
  },
  {
    title: 'Check your dates',
    copy: 'On the kit page, choose a pickup date, a pickup time, and a return date. Crossed-out days are fully booked. Check the dates, then continue when a unit is available. Return is the same time on the last day.',
    image: '/how-it-works/check-dates.png',
    imageAlt: 'Check availability form with pickup date, pickup time, return date, and Sign in to rent',
  },
  {
    title: 'Sign in and send the request',
    copy: 'Sign in or create an account. Confirm your name and mobile number, add a note if you want pickup, meetup, or delivery, then submit the rental request.',
  },
  {
    title: 'Sign the waiver and upload your ID',
    copy: 'Finish the rental agreement and upload your ID photos. The shop reviews these with the request before the booking is confirmed.',
  },
  {
    title: 'Pay the amount on the booking',
    copy: 'Open the booking, choose a payment method, and scan the QR code shown there. Pay the rent plus the deposit for that booking.',
  },
  {
    title: 'Message us to confirm',
    copy: 'After the booking is sent, message the JRY Rentals Facebook page or Instagram. Send your booking code so we can confirm it, and ask anything else you need to know about pickup, delivery, or the kit.',
    contact: true,
  },
  {
    title: 'Pick up and return',
    copy: 'Collect the gear by pickup, meetup, or delivery. Bring everything back at the same time on the return date.',
  },
]

export const ABOUT_TAGLINE = 'Rent. Create. Explore.'
export const ABOUT_INTRO = 'is a modern rental service designed to make renting simple, convenient, and accessible.'

export const ABOUT_WHO_WE_ARE = {
  title: 'Get what you need, without the cost of buying it.',
  body: 'We believe customers should be able to get what they need without the commitment and cost of purchasing. Our goal is to provide a smooth rental experience—from browsing and booking to payment and return.',
}

export const ABOUT_JOURNEY = [
  { title: 'Browse', copy: 'Find the equipment you need and check live availability.', icon: 'i-lucide-search' },
  { title: 'Book', copy: 'Pick your dates, sign the rental agreement, and verify your ID online.', icon: 'i-lucide-calendar-plus' },
  { title: 'Pay', copy: 'Pay securely through the payment methods listed at checkout.', icon: 'i-lucide-wallet' },
  { title: 'Return', copy: 'Use the equipment, then return it on the agreed date and time.', icon: 'i-lucide-rotate-ccw' },
]

export const ABOUT_VALUES = [
  { title: 'Simple', icon: 'i-lucide-sparkles', copy: 'A straightforward rental process without unnecessary complications.' },
  { title: 'Reliable', icon: 'i-lucide-badge-check', copy: 'We focus on providing a dependable experience and properly maintained rental equipment.' },
  { title: 'Convenient', icon: 'i-lucide-calendar-check', copy: 'Browse, book, manage your rental, and make payments with ease.' },
  { title: 'Secure', icon: 'i-lucide-shield-check', copy: 'We prioritize secure bookings, payments, and responsible handling of customer information.' },
]

export const ABOUT_MISSION = {
  statement: 'To make renting easier, more accessible, and more convenient for everyone.',
  body: 'Whether you\'re preparing for an adventure, working on a project, creating content, or simply need something for a short period,',
  closing: `${APP_NAME} is here to make the process easier.`,
}
