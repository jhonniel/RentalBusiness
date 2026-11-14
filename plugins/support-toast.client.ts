import { FACEBOOK_MESSENGER_URL } from '~/utils/constants'
import { mentionsSupportContact, SUPPORT_CONTACT_LABEL } from '~/utils/errors'

export default defineNuxtPlugin(() => {
  const toast = useToast()

  watch(toast.toasts, (list) => {
    for (const item of list) {
      const text = [item.title, item.description].filter(value => typeof value === 'string').join(' ')
      if (item.actions?.length || !mentionsSupportContact(text)) {
        continue
      }

      toast.update(item.id, {
        duration: 10_000,
        actions: [{
          label: SUPPORT_CONTACT_LABEL,
          icon: 'i-lucide-facebook',
          to: FACEBOOK_MESSENGER_URL,
          target: '_blank',
          color: 'neutral',
          variant: 'outline',
        }],
      })
    }
  })
})
