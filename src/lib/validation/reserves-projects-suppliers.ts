// src/lib/validation/reserves-projects-suppliers.ts

import { z } from 'zod'

const optionalId = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform(value => {
    if (!value) return null
    return value
  })

const requiredId = z.string().trim().min(1, 'Reserve is required.')

const checkboxBoolean = z
  .union([z.literal('on'), z.literal('true'), z.literal(true)])
  .optional()
  .transform(value => Boolean(value))

const nullableText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .nullable()
    .transform(value => {
      if (!value) return null
      return value
    })

export const createReserveSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Reserve code is required.')
    .max(30, 'Reserve code must be 30 characters or fewer.')
    .transform(value => value.toUpperCase()),

  name: z
    .string()
    .trim()
    .min(1, 'Reserve name is required.')
    .max(120, 'Reserve name must be 120 characters or fewer.')
})

export const updateReserveSchema = createReserveSchema.extend({
  id: z.string().trim().min(1, 'Reserve id is required.'),
  isActive: checkboxBoolean
})

export const createProjectSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Project code is required.')
    .max(30, 'Project code must be 30 characters or fewer.')
    .transform(value => value.toUpperCase()),

  name: z
    .string()
    .trim()
    .min(1, 'Project name is required.')
    .max(120, 'Project name must be 120 characters or fewer.'),

  reserveId: requiredId,

  description: nullableText(500, 'Description must be 500 characters or fewer.')
})

export const updateProjectSchema = createProjectSchema.extend({
  id: z.string().trim().min(1, 'Project id is required.'),
  isActive: checkboxBoolean
})

export const createSupplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Supplier name is required.')
    .max(160, 'Supplier name must be 160 characters or fewer.'),

  vatNumber: nullableText(20, 'VAT number must be 20 characters or fewer.'),

  defaultGoodsSupplied: nullableText(
    500,
    'Default goods supplied must be 500 characters or fewer.'
  ),

  defaultNominalCodeId: optionalId,
  defaultReserveId: optionalId,
  defaultProjectId: optionalId
})

export const updateSupplierSchema = createSupplierSchema.extend({
  id: z.string().trim().min(1, 'Supplier id is required.'),
  isActive: checkboxBoolean
})

export type CreateReserveInput = z.infer<typeof createReserveSchema>
export type UpdateReserveInput = z.infer<typeof updateReserveSchema>

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>
