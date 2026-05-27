import mongoose, { Schema, type Document, type Model } from 'mongoose';
import bcrypt from 'bcrypt';
import {
  UserRole,
  type ICreateUserDto,
} from '../types/index.js';

export interface IUserDocument extends Document {
  email: string;
  passwordHash: string;
  name: string;
  avatar?: string;
  role: UserRole;
  teamIds: mongoose.Types.ObjectId[];
  refreshToken?: string;
  emailVerified: boolean;
  lastLogin?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  addTeam(teamId: string | mongoose.Types.ObjectId): Promise<void>;
  removeTeam(teamId: string | mongoose.Types.ObjectId): Promise<void>;
  toSafeObject(): Record<string, unknown>;
}

interface IUserModel extends Model<IUserDocument> {
  build(dto: ICreateUserDto): Promise<IUserDocument>;
  findByEmail(email: string): Promise<IUserDocument | null>;
}

const userSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    avatar: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.MEMBER,
    },
    teamIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Team',
      default: [],
    },
    refreshToken: {
      type: String,
      select: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      select: false,
      default: undefined,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
      default: undefined,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index({ createdAt: -1 });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ teamIds: 1 });

userSchema.virtual('isAdmin').get(function () {
  return this.role === UserRole.ADMIN;
});

userSchema.virtual('isOwner').get(function () {
  return this.role === UserRole.OWNER;
});

userSchema.pre('save', async function (next) {
  if (this.isModified('passwordHash') && !this.passwordHash.startsWith('$2')) {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  }

  next();
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.methods.addTeam = async function (
  teamId: string | mongoose.Types.ObjectId,
): Promise<void> {
  const objectId = typeof teamId === 'string' ? new mongoose.Types.ObjectId(teamId) : teamId;

  if (!this.teamIds.some((id: mongoose.Types.ObjectId) => id.equals(objectId))) {
    this.teamIds.push(objectId);
    await this.save();
  }
};

userSchema.methods.removeTeam = async function (
  teamId: string | mongoose.Types.ObjectId,
): Promise<void> {
  const objectId = typeof teamId === 'string' ? new mongoose.Types.ObjectId(teamId) : teamId;

  this.teamIds = this.teamIds.filter(
    (id: mongoose.Types.ObjectId) => !id.equals(objectId),
  );

  await this.save();
};

userSchema.methods.toSafeObject = function (): Record<string, unknown> {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    avatar: this.avatar,
    role: this.role,
    teamIds: this.teamIds,
    emailVerified: this.emailVerified,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

userSchema.statics.build = async function (
  dto: ICreateUserDto,
): Promise<IUserDocument> {
  const user = new this({
    email: dto.email,
    passwordHash: dto.password,
    name: dto.name,
    role: UserRole.MEMBER,
    teamIds: [],
  });

  return user.save();
};

userSchema.statics.findByEmail = async function (
  email: string,
): Promise<IUserDocument | null> {
  return this.findOne({ email: email.toLowerCase() }).select('+passwordHash +refreshToken');
};

export const UserModel = mongoose.model<IUserDocument, IUserModel>('User', userSchema);