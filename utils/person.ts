/** Display label for a person when first/last name may be empty (e.g. Google OAuth). */
export function personDisplayName(person: {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  walkIn?: boolean
}, fallback = 'No name yet') {
  const name = `${person.firstName || ''} ${person.lastName || ''}`.trim()
  if (name) {
    return name
  }
  if (person.walkIn) {
    return 'Walk-in customer'
  }
  return person.email?.trim() || fallback
}
