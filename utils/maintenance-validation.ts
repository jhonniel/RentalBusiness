import { z } from 'zod'

export const maintenanceInputSchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(1, 'Add a maintenance title.').max(120),
  message: z.string().trim().min(1, 'Add a short explanation.').max(2000),
}).strict()

export type MaintenanceInput = z.infer<typeof maintenanceInputSchema>
