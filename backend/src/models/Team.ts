import mongoose, { Schema, type Document, type Model } from 'mongoose';
import {
  PlanType,
  type ITeamSettings,
  type ICreateTeamDto,
} from '../types/index.js';

export enum TeamMemberRole {
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

export interface ITeamMember {
  userId: mongoose.Types.ObjectId;
  role: TeamMemberRole;
  joinedAt: Date;
}

export interface ITeamDocument extends Document {
  name: string;
  slug: string;
  description?: string;
  ownerId: mongoose.Types.ObjectId;
  members: ITeamMember[];
  settings: ITeamSettings;
  plan: PlanType;
  addMember(userId: string | mongoose.Types.ObjectId, role?: TeamMemberRole): Promise<void>;
  removeMember(userId: string | mongoose.Types.ObjectId): Promise<void>;
  updateMemberRole(userId: string | mongoose.Types.ObjectId, role: TeamMemberRole): Promise<void>;
  getMemberRole(userId: string | mongoose.Types.ObjectId): TeamMemberRole | 'owner' | null;
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

const teamMemberSchema = new Schema<ITeamMember>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(TeamMemberRole),
      default: TeamMemberRole.MEMBER,
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
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
    members: {
      type: [teamMemberSchema],
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
teamSchema.index({ ownerId: 1 });
teamSchema.index({ 'members.userId': 1 });

teamSchema.virtual('memberCount').get(function () {
  return this.members.length + 1;
});

teamSchema.virtual('isEnterprise').get(function () {
  return this.plan === PlanType.ENTERPRISE;
});

teamSchema.methods.addMember = async function (
  userId: string | mongoose.Types.ObjectId,
  role: TeamMemberRole = TeamMemberRole.MEMBER,
): Promise<void> {
  const objectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

  if (this.ownerId.equals(objectId)) {
    return;
  }

  const existingMember = this.members.find((member: ITeamMember) =>
    member.userId.equals(objectId),
  );

  if (existingMember) {
    existingMember.role = role;
  } else {
    this.members.push({
      userId: objectId,
      role,
      joinedAt: new Date(),
    });
  }

  await this.save();
};

teamSchema.methods.removeMember = async function (
  userId: string | mongoose.Types.ObjectId,
): Promise<void> {
  const objectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

  this.members = this.members.filter(
    (member: ITeamMember) => !member.userId.equals(objectId),
  );

  await this.save();
};

teamSchema.methods.updateMemberRole = async function (
  userId: string | mongoose.Types.ObjectId,
  role: TeamMemberRole,
): Promise<void> {
  const objectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

  const member = this.members.find((item: ITeamMember) =>
    item.userId.equals(objectId),
  );

  if (!member) {
    throw new Error('Member not found in team');
  }

  member.role = role;
  await this.save();
};

teamSchema.methods.getMemberRole = function (
  userId: string | mongoose.Types.ObjectId,
): TeamMemberRole | 'owner' | null {
  const objectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

  if (this.ownerId.equals(objectId)) {
    return 'owner';
  }

  const member = this.members.find((item: ITeamMember) =>
    item.userId.equals(objectId),
  );

  return member ? member.role : null;
};

teamSchema.methods.toPublicObject = function (): Record<string, unknown> {
  return {
    id: this._id,
    name: this.name,
    slug: this.slug,
    description: this.description,
    ownerId: this.ownerId,
    members: this.members,
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

teamSchema.statics.build = async function (
  dto: ICreateTeamDto,
): Promise<ITeamDocument> {
  const team = new this({
    name: dto.name,
    slug: dto.slug,
    description: dto.description,
    ownerId: new mongoose.Types.ObjectId(dto.ownerId),
    members: [],
  });

  return team.save();
};

export const TeamModel = mongoose.model<ITeamDocument, ITeamModel>('Team', teamSchema);