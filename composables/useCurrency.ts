import { BUSINESS_CURRENCY } from '~/utils/constants'
import { formatMoney } from '~/utils/currency'

export function useCurrency() {
  const currency = BUSINESS_CURRENCY

  return {
    currency,
    formatMoney,
  }
}
