import { z } from "zod";

// Dispatch log validation
export const dispatchSchema = z.object({
  driver_id: z.string().uuid("Invalid driver ID"),
  launch_count: z
    .number()
    .int("Launch count must be a whole number")
    .positive("Launch count must be greater than zero")
    .max(999, "Launch count cannot exceed 999"),
  route: z.string().max(50, "Route name cannot exceed 50 characters").optional(),
});

export type DispatchInput = z.infer<typeof dispatchSchema>;

// Driver registration validation
export const driverRegistrationSchema = z.object({
  body_number: z
    .string()
    .min(1, "Body number is required")
    .max(20, "Body number cannot exceed 20 characters")
    .regex(/^[A-Za-z0-9\-]+$/, "Body number can only contain letters, numbers, and hyphens"),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  middle_initial: z.string().max(10).optional().or(z.literal("")),
  nickname: z.string().max(50).optional().or(z.literal("")),
  full_name: z
    .string()
    .max(250, "Full name cannot exceed 250 characters")
    .optional(),
  contact_number: z
    .string()
    .max(30, "Contact number too long")
    .optional()
    .or(z.literal("")),
});

export type DriverRegistrationInput = z.infer<typeof driverRegistrationSchema>;

// Route validation
export const routeSchema = z.object({
  name: z.string().min(1, "Route name is required").max(50, "Route name cannot exceed 50 characters"),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export type RouteInput = z.infer<typeof routeSchema>;

export const driverUpdateSchema = z.object({
  driver_id: z.string().uuid("Invalid driver ID"),
  first_name: z
    .string()
    .min(1, "First name is required")
    .max(100, "First name cannot exceed 100 characters")
    .optional(),
  last_name: z
    .string()
    .min(1, "Last name is required")
    .max(100, "Last name cannot exceed 100 characters")
    .optional(),
  middle_initial: z
    .string()
    .max(10, "M.I. too long")
    .optional(),
  nickname: z
    .string()
    .max(50, "Nickname too long")
    .optional(),
  full_name: z
    .string()
    .max(150, "Full name cannot exceed 150 characters")
    .optional(),
  contact_number: z
    .string()
    .max(30, "Contact number too long")
    .optional()
    .or(z.literal("")),
  change_reason: z
    .string()
    .min(1, "Change reason is required")
    .max(500, "Reason cannot exceed 500 characters"),
});

export type DriverUpdateInput = z.infer<typeof driverUpdateSchema>;

// Void reason validation
export const voidReasonSchema = z.object({
  dispatch_id: z.number().int().positive(),
  void_reason: z
    .string()
    .min(1, "Please provide a reason for voiding this entry")
    .max(500, "Reason cannot exceed 500 characters"),
});

export type VoidReasonInput = z.infer<typeof voidReasonSchema>;

// Audit adjustment validation
export const auditAdjustmentSchema = z.object({
  dispatch_id: z.number().int().positive(),
  adjustment_type: z.enum([
    "manual_credit_void",
    "duplicate_correction",
    "cash_discrepancy",
    "system_error",
    "other",
  ]),
  notes: z
    .string()
    .min(5, "Please provide detailed notes for the adjustment")
    .max(1000, "Notes cannot exceed 1000 characters"),
});

export type AuditAdjustmentInput = z.infer<typeof auditAdjustmentSchema>;

// System settings validation
export const systemSettingSchema = z.object({
  key: z.string().min(1),
  value: z.record(z.string(), z.unknown()),
});

export type SystemSettingInput = z.infer<typeof systemSettingSchema>;

// Login validation
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Driver status change validation
export const statusChangeSchema = z.object({
  driver_id: z.string().uuid("Invalid driver ID"),
  status: z.enum(["active", "suspended", "inactive"]),
  reason: z
    .string()
    .min(5, "Please provide a reason for this status change")
    .max(500, "Reason cannot exceed 500 characters"),
});

export type StatusChangeInput = z.infer<typeof statusChangeSchema>;
