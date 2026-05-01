import { z } from 'zod'

const optionalTrimmedString = z.preprocess(
  value => (value === null ? undefined : value),
  z
    .string()
    .trim()
    .optional()
    .transform(value => value || undefined)
)

export const councilOnboardingSchema = z
  .object({
    name: z.string().trim().min(1, 'Council name is required.'),

    addressLine1: optionalTrimmedString,
    addressLine2: optionalTrimmedString,
    town: optionalTrimmedString,
    county: optionalTrimmedString,
    postcode: optionalTrimmedString,
    telephone: optionalTrimmedString,

    email: optionalTrimmedString.refine(
      value => !value || z.email().safeParse(value).success,
      {
        message: 'Enter a valid email address.'
      }
    ),

    website: optionalTrimmedString.refine(
      value => !value || z.url().safeParse(value).success,
      {
        message: 'Enter a valid website URL.'
      }
    ),

    canRecoverVat: z.enum(['on', 'off']).default('on'),

    vatStatus: z
      .enum(['NOT_REGISTERED', 'REGISTERED'])
      .default('NOT_REGISTERED'),

    vatRegistrationNumber: optionalTrimmedString,

    vatClaimFrequency: z
      .enum(['ANNUAL', 'QUARTERLY', 'MONTHLY'])
      .default('ANNUAL')
  })
  .superRefine((data, ctx) => {
    if (
      data.canRecoverVat === 'on' &&
      data.vatStatus === 'REGISTERED' &&
      !data.vatRegistrationNumber
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['vatRegistrationNumber'],
        message: 'VAT registration number is required for registered councils.'
      })
    }
  })

export type CouncilOnboardingInput = z.infer<typeof councilOnboardingSchema>
