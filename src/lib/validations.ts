import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const signUpSchema = z
  .object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: passwordSchema,
    confirmPassword: z.string(),
    phone: z.string().min(9).max(15).optional().or(z.literal('')),
    dateOfBirth: z.string().optional(),
    acceptTerms: z.boolean().refine((v) => v === true, 'You must accept the terms'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const connectionSchema = z.discriminatedUnion('platform', [
  z.object({
    platform: z.literal('WHATSAPP'),
    name: z.string().min(1).max(100),
    businessName: z.string().max(100).optional(),
    botName: z.string().min(1).max(50).default('Assistant'),
    twilioWhatsAppNumber: z.string().min(5).max(20),
  }),
  z.object({
    platform: z.literal('TELEGRAM'),
    name: z.string().min(1).max(100),
    businessName: z.string().max(100).optional(),
    botName: z.string().min(1).max(50).default('Assistant'),
    telegramBotToken: z.string().min(20),
  }),
]);

export const predefinedMessageSchema = z.object({
  keywords: z.array(z.string()).min(1),
  response: z.string().min(1).max(2000),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).default(0),
});

export const twoFactorSchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
});
