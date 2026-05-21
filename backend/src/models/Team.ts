import mongoose, { Schema, type Document, type Model } from 'mongoose';
import {
  PlanType,
  type ITeamSettings,
  type ICreateTeamDto,
  type IUpdateTeamDto,
} from '../types/index.js';

export interface ITeamDocument extends Document {
  name: string;
  slug: string;
  description?: string;
  ownerId: mongoose.Types.ObjectId;
  memberIds: mongoose.Types.ObjectId[];
  settings: ITeamSettings;
  plan: PlanType;
  addMember(userId: string | mongoose.Types.ObjectId): Promise<void>;
  removeMember(userId: string | mongoose.Types.ObjectId): Promise<void>;
  toPublicObject(): Record<string, unknown>;
}

interface ITeamModel extends Model<ITeamDocument> {
  findBySlug(slug: string): Promise<ITeamDocument | null>;
  build(dto: ICreateTeamDto): Promise<ITeamDocument>;
}

const teamSettingsSchema = new Schema<ITeamSettings>(
  {
    logo: { type: String, default: null },
    primaryColor: { type: String, default: '#3B82F6' },
    secondaryColor: { type: String, default: '#1E40AF' },
  },
  { _id: false },
);

const teamSchema = new Schema<ITeamDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    memberIds: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    settings: {
      type: teamSettingsSchema,
      default: () => ({}),
    },
    plan: {
      type: String,
      enum: Object.values(PlanType),
      default: PlanType.FREE,
    },
  },
  {
    timestamps: true,
  },
);

teamSchema.index({ slug: 1 }, { unique: true });

teamSchema.virtual('memberCount').get(function () {
  return this.memberIds.length + 1;
});

teamSchema.virtual('isEnterprise').get(function () {
  return this.plan === PlanType.ENTERPRISE;
});

teamSchema.methods.addMember = async function (
  userId: string | mongoose.Types.ObjectId,
): Promise<void> {
  const objectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
  if (!this.memberIds.some((id) => id.equals(objectId))) {
    this.memberIds.push(objectId);
    await this.save();
  }
};

teamSchema.methods.removeMember = async function (
  userId: string | mongoose.Types.ObjectId,
): Promise<void> {
  const objectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
  this.memberIds = this.memberIds.filter((id) => !id.equals(objectId));
  await this.save();
};

teamSchema.methods.toPublicObject = function (): Record<string, unknown> {
  return {
    id: this._id,
    name: this.name,
    slug: this.slug,
    description: this.description,
    ownerId: this.ownerId,
    memberIds: this.memberIds,
    settings: this.settings,
    plan: this.plan,
    memberCount: this.memberCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

teamSchema.statics.findBySlug = async function (
  slug: string,
): Promise<ITeamDocument | null> {
  return this.findOne({ slug: slug.toLowerCase() });
};

teamSchema.statics.build = async function (dto: ICreateTeamDto): Promise<ITeamDocument> {
  const team = new this({
    name: dto.name,
    slug: dto.slug,
    description: dto.description,
    ownerId: new mongoose.Types.ObjectId(dto.ownerId),
  });

  return team.save();
};

export const TeamModel = mongoose.model<ITeamDocument, ITeamModel>('Team', teamSchema);