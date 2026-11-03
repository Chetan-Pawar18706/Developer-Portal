import bcrypt from 'bcryptjs';
import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export const USER_ROLES = ['admin', 'pm', 'developer', 'client'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface NotificationPreferences {
  emailOnAssignment: boolean;
  emailOnMention: boolean;
  emailOnStatusChange: boolean;
  emailOnReminder: boolean;
}

export interface UserAttributes {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  avatar: string | null;
  isActive: boolean;
  notificationPrefs: NotificationPreferences;
  resetTokenHash: string | null;
  resetTokenExpires: Date | null;
  refreshTokenHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export type UserDocument = HydratedDocument<UserAttributes, UserMethods>;
export type UserModel = Model<UserAttributes, Record<string, never>, UserMethods>;

const notificationPreferencesSchema = new Schema<NotificationPreferences>(
  {
    emailOnAssignment: { type: Boolean, default: true },
    emailOnMention: { type: Boolean, default: true },
    emailOnStatusChange: { type: Boolean, default: true },
    emailOnReminder: { type: Boolean, default: true },
  },
  { _id: false },
);

const userSchema = new Schema<UserAttributes, UserModel, UserMethods>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'client',
      required: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notificationPrefs: {
      type: notificationPreferencesSchema,
      default: () => ({
        emailOnAssignment: true,
        emailOnMention: true,
        emailOnStatusChange: true,
        emailOnReminder: true,
      }),
    },
    resetTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    resetTokenExpires: {
      type: Date,
      default: null,
      select: false,
    },
    refreshTokenHash: {
      type: String,
      default: null,
      select: false,
    },
  },
  { timestamps: true },
);

userSchema.methods.comparePassword = function comparePassword(
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export const User = model<UserAttributes, UserModel>('User', userSchema);
