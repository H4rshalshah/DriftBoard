import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuthStore, useNotificationStore, useProjectStore } from '@/store';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Badge } from '@/components/common/Badge';
import { Tabs, TabList, Tab, TabPanel } from '@/components/common/Tabs';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import { Dropdown } from '@/components/common/Dropdown';
import {
  User,
  Users,
  Bell,
  Plus,
  Trash2,
  Camera,
  ChevronDown,
  Copy,
  Link2,
  KeyRound,
  Share2,
  Mail,
  MessageCircle,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import type { ProjectRole } from '@/utils/permissions';
import { hasProjectPermission } from '@/utils/permissions';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface TeamMember {
  id: string;
  userId?: string;
  projectId?: string;
  name?: string;
  userEmail: string;
  role: ProjectRole;
  status?: 'pending' | 'active' | 'removed' | 'invited' | 'joined';
  avatar?: string;
  inviteLink?: string;
  invitePassword?: string;
  inviteExpiresAt?: string;
}

interface TeamInvite {
  id: string;
  token: string;
  projectId: string;
  userEmail: string;
  invitedByName: string;
  invitedByEmail: string;
  role: Exclude<ProjectRole, 'owner'>;
  inviteLink: string;
  invitePassword: string;
  expiresAt: string;
  emailDelivery?: AlertDelivery;
}

const roleColors = {
  owner: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  admin: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
  member: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
  viewer: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

type NotificationChannels = {
  discord: { enabled: boolean; webhookUrl: string };
  email: { enabled: boolean; address: string };
  emailConfig?: {
    configured: boolean;
    mockMode: boolean;
    provider?: string | null;
    missing: string[];
    message: string;
  };
};

type AlertDelivery = {
  channel: 'discord' | 'email';
  status: string;
  provider?: string;
  message?: string;
};

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function DiscordLogo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M19.54 5.34A16.7 16.7 0 0 0 15.4 4c-.18.32-.39.75-.53 1.09a15.5 15.5 0 0 0-4.73 0c-.14-.34-.36-.77-.54-1.09a16.6 16.6 0 0 0-4.15 1.34C2.82 9.27 2.1 13.1 2.46 16.88A16.9 16.9 0 0 0 7.55 19.5c.41-.57.78-1.17 1.09-1.8-.6-.23-1.17-.51-1.71-.85.14-.11.28-.22.42-.34a11.9 11.9 0 0 0 10.3 0l.42.34c-.54.34-1.11.62-1.72.85.32.63.68 1.23 1.1 1.8a16.8 16.8 0 0 0 5.09-2.62c.43-4.38-.74-8.17-3-11.54ZM8.72 14.56c-.99 0-1.8-.92-1.8-2.04s.8-2.04 1.8-2.04c1.01 0 1.82.92 1.8 2.04 0 1.12-.8 2.04-1.8 2.04Zm6.56 0c-.99 0-1.8-.92-1.8-2.04s.79-2.04 1.8-2.04 1.81.92 1.8 2.04c0 1.12-.79 2.04-1.8 2.04Z"
      />
    </svg>
  );
}

const defaultNotificationChannels: NotificationChannels = {
  discord: { enabled: false, webhookUrl: '' },
  email: { enabled: false, address: '' },
};

function withAccountEmailFallback(channels: NotificationChannels, accountEmail?: string): NotificationChannels {
  const fallbackEmail = accountEmail || '';
  return {
    ...channels,
    discord: { ...defaultNotificationChannels.discord, ...channels.discord },
    email: {
      ...defaultNotificationChannels.email,
      ...channels.email,
      address: channels.email.address || fallbackEmail,
    },
  };
}

const teamRoles: Exclude<ProjectRole, 'owner'>[] = ['admin', 'member', 'viewer'];

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message || fallback);
  }
  return fallback;
}

function isLocalInviteLink(link?: string) {
  if (!link) return false;
  try {
    const hostname = new URL(link).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

function inviteEmailWasSent(invite: TeamInvite | null) {
  const delivery = invite?.emailDelivery;
  return delivery?.channel === 'email' && delivery.status === 'sent' && delivery.provider !== 'mock';
}

function inviteEmailWasQueued(invite: TeamInvite | null) {
  const delivery = invite?.emailDelivery;
  return delivery?.channel === 'email' && delivery.status === 'queued';
}

function inviteEmailFailureMessage(invite: TeamInvite | null) {
  const delivery = invite?.emailDelivery;
  if (delivery?.channel === 'email' && delivery.status === 'failed') {
    return delivery.message || 'Email delivery failed.';
  }
  return '';
}

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const { currentProject, fetchCurrentProject } = useProjectStore();
  const { preferences, updatePreferences } = useNotificationStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<ProjectRole, 'owner'>>('member');
  const [invitePassword, setInvitePassword] = useState('');
  const [generatedInvite, setGeneratedInvite] = useState<TeamInvite | null>(null);
  const [isSavingTeam, setIsSavingTeam] = useState(false);
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannels>(defaultNotificationChannels);
  const [isSavingChannels, setIsSavingChannels] = useState(false);
  const [isSendingAlert, setIsSendingAlert] = useState(false);

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    username: user?.username || '',
    avatar: user?.avatar || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const currentMember = teamMembers.find((member) => member.userEmail.toLowerCase() === user?.email?.toLowerCase());
  const currentProjectRole = currentProject?.currentUserRole || (currentProject?.ownerId === user?.id || (!currentProject && user?.role === 'owner') ? 'owner' : currentMember?.role) || null;
  const canManageTeam = hasProjectPermission(currentProjectRole, 'team:invite');
  const canUpdateNotificationSettings = hasProjectPermission(currentProjectRole, 'notification:update');
  const canSendTestAlert = hasProjectPermission(currentProjectRole, 'scan:run');
  const adminCount = teamMembers.filter((member) => member.role === 'owner' || member.role === 'admin').length;

  useEffect(() => {
    setProfileForm((current) => ({
      ...current,
      name: user?.name || '',
      email: user?.email || '',
      username: user?.username || '',
      avatar: user?.avatar || '',
    }));
  }, [user?.avatar, user?.email, user?.name, user?.username]);

  useEffect(() => {
    if (!currentProject?.id) {
      void fetchCurrentProject();
    }
  }, [currentProject?.id, fetchCurrentProject]);

  useEffect(() => {
    if (!currentProject?.id) return;
    setIsLoadingTeam(true);
    api.get<TeamMember[]>(`/team/${currentProject.id}`)
      .then((members) => setTeamMembers(members))
      .catch((error) => toast.error(getErrorMessage(error, 'Could not load team members.')))
      .finally(() => setIsLoadingTeam(false));

  }, [currentProject?.id]);

  useEffect(() => {
    api.get<NotificationChannels>('/settings/notification-channels')
      .then((channels) => setNotificationChannels(withAccountEmailFallback(channels, user?.email)))
      .catch(() => undefined);
  }, [user?.email]);

  const saveNotificationChannels = async () => {
    if (!canUpdateNotificationSettings) {
      toast.error('You do not have permission to perform this action.');
      return;
    }
    const emailAddress = notificationChannels.email.address.trim() || user?.email || '';
    if (notificationChannels.email.enabled && !isValidEmailAddress(emailAddress)) {
      toast.error('Enter a valid alert email address.');
      return;
    }
    setIsSavingChannels(true);
    try {
      const saved = await api.put<NotificationChannels>('/settings/notification-channels', {
        ...notificationChannels,
        email: {
          ...notificationChannels.email,
          address: emailAddress,
        },
        projectId: currentProject?.id,
      });
      setNotificationChannels(withAccountEmailFallback(saved, user?.email));
      await updatePreferences({ email: saved.email.enabled });
      toast.success('Notification channels saved.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save notification channels.'));
    } finally {
      setIsSavingChannels(false);
    }
  };

  const sendTestAlert = async () => {
    if (!canSendTestAlert) {
      toast.error('You do not have permission to perform this action.');
      return;
    }
    if (!notificationChannels.discord.enabled && !notificationChannels.email.enabled) {
      toast.error('Enable Discord or Email before sending a test alert.');
      return;
    }
    if (notificationChannels.discord.enabled && !notificationChannels.discord.webhookUrl.trim()) {
      toast.error('Discord webhook URL is required.');
      return;
    }
    const emailAddress = notificationChannels.email.address.trim() || user?.email || '';
    if (notificationChannels.email.enabled && !emailAddress) {
      toast.error('Email address is required.');
      return;
    }
    if (notificationChannels.email.enabled && !isValidEmailAddress(emailAddress)) {
      toast.error('Enter a valid alert email address.');
      return;
    }
    setIsSendingAlert(true);
    try {
      const result = await api.post<{ delivered: AlertDelivery[]; message: string }>('/settings/test-alert', {
        projectId: currentProject?.id,
        discord: notificationChannels.discord,
        email: { ...notificationChannels.email, address: emailAddress },
      });
      const emailDelivery = result.delivered.find((delivery) => delivery.channel === 'email');
      const discordDelivery = result.delivered.find((delivery) => delivery.channel === 'discord');
      if (emailDelivery?.status === 'mock_sent') {
        const mockMessage = notificationChannels.emailConfig?.message || emailDelivery.message || 'Email is in mock mode until SMTP or Resend is configured.';
        toast.success(discordDelivery ? `Discord sent. ${mockMessage}` : mockMessage);
      } else {
        toast.success(result.delivered.length > 1 ? 'Discord and email test alerts sent.' : 'Test alert sent.');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Test alert failed.'));
    } finally {
      setIsSendingAlert(false);
    }
  };

  const inviteMember = async () => {
    if (!canManageTeam) {
      toast.error('You do not have permission to perform this action.');
      return;
    }
    if (!currentProject?.id) {
      toast.error('Connect a project before inviting team members.');
      return;
    }
    if (!inviteEmail.trim()) {
      toast.error('Email is required.');
      return;
    }
    if (!isValidEmailAddress(inviteEmail)) {
      toast.error('Enter a valid invite email address.');
      return;
    }

    setIsSavingTeam(true);
    try {
      const invited = await api.post<TeamInvite>(`/team/${currentProject.id}/invite`, {
        email: inviteEmail.trim(),
        role: inviteRole,
        invitePassword: invitePassword.trim() || undefined,
      });
      setGeneratedInvite(invited);
      const members = await api.get<TeamMember[]>(`/team/${currentProject.id}`);
      setTeamMembers(members);
      await fetchCurrentProject();
      setInviteRole('member');
      setInvitePassword('');
      if (inviteEmailWasSent(invited)) {
        toast.success(`Invite email sent to ${invited.userEmail}.`);
      } else if (inviteEmailWasQueued(invited)) {
        toast.success('Invite link generated.');
      } else if (inviteEmailFailureMessage(invited)) {
        toast.error(`Invite link created, but email failed: ${inviteEmailFailureMessage(invited)}`);
      } else {
        toast.success('Invite created. Copy or share the link and invite password.');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not invite team member.'));
    } finally {
      setIsSavingTeam(false);
    }
  };

  const copyInviteDetail = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}.`);
    }
  };

  const shareInvite = async () => {
    if (!generatedInvite) return;
    const subject = `DriftBoard invite: ${currentProject?.name || 'Project access'}`;
    const shareText = [
      `${generatedInvite.invitedByName || user?.name || 'A DriftBoard admin'} invited you to join ${currentProject?.name || 'a DriftBoard project'}.`,
      generatedInvite.invitedByEmail ? `Sent by: ${generatedInvite.invitedByName} <${generatedInvite.invitedByEmail}>` : '',
      '',
      '*Invite link:*',
      generatedInvite.inviteLink,
      '',
      `*Login code:* ${generatedInvite.invitePassword}`,
      '',
      'After opening the link, choose whether you have an account, then enter the invite password to get access.',
    ].filter((line) => line !== '').join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: subject,
          text: shareText,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText)}`;
  };

  const updateMemberRole = async (member: TeamMember, role: Exclude<ProjectRole, 'owner'>) => {
    if (member.role === role) return;
    if (!canManageTeam || member.role === 'owner') {
      toast.error('You do not have permission to perform this action.');
      return;
    }
    if (member.role === 'admin' && role !== 'admin' && adminCount <= 1) {
      toast.error('Make another member admin before changing this admin role.');
      return;
    }

    setIsSavingTeam(true);
    try {
      const updated = await api.put<TeamMember>(`/team/member/${member.id}`, { role });
      setTeamMembers((current) => current.map((item) => (item.id === member.id ? updated : item)));
      await fetchCurrentProject();
      toast.success('Member role updated.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update role.'));
    } finally {
      setIsSavingTeam(false);
    }
  };

  const removeMember = async (member: TeamMember) => {
    const isCurrentUser = member.userEmail.toLowerCase() === user?.email?.toLowerCase();
    if (!canManageTeam || member.role === 'owner') {
      toast.error('You do not have permission to perform this action.');
      return;
    }
    if (member.role === 'admin' && adminCount <= 1) {
      toast.error('Make another member admin before removing this admin.');
      return;
    }
    if (currentProject?.ownerId && member.userEmail.toLowerCase() === user?.email?.toLowerCase() && currentProjectRole === 'owner') {
      toast.error('Project owner cannot be removed from their project.');
      return;
    }
    if (!window.confirm(isCurrentUser ? 'Leave this team?' : 'Remove this member?')) return;

    try {
      await api.delete(`/team/member/${member.id}`);
      setTeamMembers((current) => current.filter((item) => item.id !== member.id));
      await fetchCurrentProject();
      toast.success(isCurrentUser ? 'You left the team.' : 'Member removed.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not remove member.'));
    }
  };

  const saveProfile = async () => {
    const name = profileForm.name.trim();
    const email = profileForm.email.trim();
    const username = profileForm.username.trim();
    if (!name) {
      toast.error('Full name is required.');
      return;
    }
    if (!email) {
      toast.error('Email is required.');
      return;
    }
    if (!username) {
      toast.error('Username is required.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const updatedUser = await api.put<typeof user>('/user/profile', {
        name,
        email,
        username,
        avatar: profileForm.avatar || undefined,
      });
      if (updatedUser) {
        setUser(updatedUser);
      }
      toast.success('Profile updated.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update profile.'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!profileForm.currentPassword || !profileForm.newPassword) {
      toast.error('Enter your current and new password.');
      return;
    }
    if (profileForm.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (profileForm.newPassword !== profileForm.confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await api.put('/user/password', {
        currentPassword: profileForm.currentPassword,
        newPassword: profileForm.newPassword,
      });
      setProfileForm((current) => ({
        ...current,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      toast.success('Password updated.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update password.'));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const uploadAvatar = async (avatar: string) => {
    setIsUploadingAvatar(true);
    try {
      const updatedUser = await api.post<typeof user>('/user/avatar', { avatar });
      if (updatedUser) {
        setUser(updatedUser);
      }
      setProfileForm((current) => ({ ...current, avatar }));
      toast.success('Avatar updated.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update avatar.'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file for your avatar.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Avatar must be smaller than 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        void uploadAvatar(reader.result);
      }
    };
    reader.onerror = () => toast.error('Could not read that image.');
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Settings</h1>
        <p className="text-neutral-500 dark:text-white/60">Manage your account and preferences</p>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Tabs defaultValue="profile">
          <TabList className="mb-6">
            <Tab value="profile">
              <User className="w-4 h-4 mr-2 inline" />
              Profile
            </Tab>
            <Tab value="team">
              <Users className="w-4 h-4 mr-2 inline" />
              Team
            </Tab>
            <Tab value="notifications">
              <Bell className="w-4 h-4 mr-2 inline" />
              Notifications
            </Tab>
          </TabList>

          <TabPanel value="profile">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-20 h-20 overflow-hidden rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-2xl font-bold text-neutral-900 dark:text-white">
                      {profileForm.avatar ? (
                        <img src={profileForm.avatar} alt={profileForm.name || 'User avatar'} className="h-full w-full object-cover" />
                      ) : (
                        profileForm.name?.charAt(0) || 'U'
                      )}
                    </div>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={isUploadingAvatar}
                        leftIcon={<Camera className="w-4 h-4" />}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Change Avatar
                      </Button>
                      <p className="mt-2 text-xs text-neutral-500 dark:text-white/40">PNG, JPG, or WebP under 2 MB.</p>
                    </div>
                  </div>
                  <Input
                    label="Full Name"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  />
                  <Input
                    label="Username"
                    value={profileForm.username}
                    onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                  />
                  <p className="-mt-2 text-xs text-neutral-500 dark:text-white/40">You can sign in with either your email or username.</p>
                  <Button loading={isSavingProfile} onClick={() => void saveProfile()}>Save Changes</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    label="Current Password"
                    type="password"
                    value={profileForm.currentPassword}
                    onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })}
                  />
                  <Input
                    label="New Password"
                    type="password"
                    value={profileForm.newPassword}
                    onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                    value={profileForm.confirmPassword}
                    onChange={(e) => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                    error={profileForm.newPassword !== profileForm.confirmPassword && profileForm.confirmPassword ? 'Passwords do not match' : undefined}
                  />
                  <Button
                    loading={isUpdatingPassword}
                    disabled={Boolean(profileForm.confirmPassword && profileForm.newPassword !== profileForm.confirmPassword)}
                    onClick={() => void changePassword()}
                  >
                    Update Password
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabPanel>

          <TabPanel value="team">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Team Members</CardTitle>
                {canManageTeam && (
                  <Button
                    size="sm"
                    leftIcon={<Plus className="w-4 h-4" />}
                    disabled={!currentProject?.id}
                    onClick={() => {
      setGeneratedInvite(null);
      setInviteEmail('');
      setInviteRole('member');
      setInvitePassword('');
                      setInviteModalOpen(true);
                    }}
                  >
                    Invite Member
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {isLoadingTeam && <p className="text-sm text-neutral-500 dark:text-white/50">Loading team members...</p>}
                  {!isLoadingTeam && teamMembers.length === 0 && (
                    <p className="text-sm text-neutral-500 dark:text-white/50">No team members yet.</p>
                  )}
                  {teamMembers.map((member) => {
                    const displayName = member.name || member.userEmail.split('@')[0];
                    const isCurrentUser = member.userEmail.toLowerCase() === user?.email?.toLowerCase();
                    const isCurrentProjectOwner = member.role === 'owner' || (isCurrentUser && currentProjectRole === 'owner');
                    const roleLabel = isCurrentProjectOwner ? 'owner' : member.role;
                    return (
                    <div
                      key={member.id}
                      className="flex flex-col gap-3 rounded-lg bg-white dark:bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-medium">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-medium">{displayName}</p>
                          <p className="text-sm text-neutral-500 dark:text-white/50">{member.userEmail}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge className={isCurrentProjectOwner ? roleColors.admin : roleColors[member.role]}>{roleLabel}</Badge>
                        {canManageTeam ? (
                          <>
                            <Dropdown
                              trigger={
                                <button
                                  type="button"
                                  disabled={isSavingTeam || isCurrentProjectOwner}
                                  className="inline-flex h-10 min-w-[132px] items-center justify-between gap-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <span className="capitalize">{member.role}</span>
                                  <ChevronDown className="h-4 w-4 text-neutral-500 dark:text-white/60" />
                                </button>
                              }
                              items={teamRoles.map((role) => ({
                                label: role.charAt(0).toUpperCase() + role.slice(1),
                                value: role,
                                disabled: isCurrentProjectOwner || member.role === role || (member.role === 'admin' && role !== 'admin' && adminCount <= 1),
                                onClick: () => void updateMemberRole(member, role),
                              }))}
                              align="end"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<Trash2 className="w-4 h-4" />}
                              disabled={isCurrentProjectOwner || (member.role === 'admin' && adminCount <= 1)}
                              onClick={() => void removeMember(member)}
                            >
                              {member.userEmail === user?.email ? 'Leave' : 'Remove'}
                            </Button>
                          </>
                        ) : (
                          <span className="text-sm text-neutral-500 dark:text-white/40">No access</span>
                        )}
                      </div>
                    </div>
                  );
                  })}
                </div>
              </CardContent>
            </Card>

          </TabPanel>

          <TabPanel value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Channels</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className={`rounded-xl border p-4 transition-colors ${
                    notificationChannels.discord.enabled
                      ? 'border-primary-300/35 bg-primary-500/12 shadow-lg shadow-primary-500/10'
                      : 'border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5'
                  }`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 gap-3">
                        <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl bg-[#5865F2]/20 text-[#AEB7FF] ring-1 ring-[#5865F2]/30">
                          <DiscordLogo className="h-7 w-7" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-white">Discord</p>
                            <Badge className="border-primary-400/30 bg-primary-500/15 text-primary-200">
                              Team channel
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-white/55">
                            Sends rich drift embeds with project, endpoint, severity, drift type, changed fields, and a DriftBoard link.
                          </p>
                        </div>
                      </div>
                      <button
                        disabled={!canUpdateNotificationSettings}
                        onClick={() => setNotificationChannels((current) => ({ ...current, discord: { ...current.discord, enabled: !current.discord.enabled } }))}
                        className={`h-7 w-14 flex-shrink-0 rounded-full p-1 transition-colors ${
                          notificationChannels.discord.enabled ? 'bg-primary-500' : 'bg-white/10'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                        aria-label="Toggle Discord notifications"
                      >
                        <div className={`h-5 w-5 rounded-full bg-white transition-transform ${
                          notificationChannels.discord.enabled ? 'translate-x-7' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                    <div className="mt-4 grid gap-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-black/15 p-3 text-xs text-neutral-500 dark:text-white/60 sm:grid-cols-3">
                      <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Severity badge</span>
                      <span className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-primary-300" /> Field details</span>
                      <span className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5 text-sky-300" /> Dashboard link</span>
                    </div>
                    {notificationChannels.discord.enabled && (
                      <div className="mt-4">
                        <Input
                          label="Discord webhook URL"
                          placeholder="https://discord.com/api/webhooks/..."
                          value={notificationChannels.discord.webhookUrl}
                          disabled={!canUpdateNotificationSettings}
                          onChange={(event) => setNotificationChannels((current) => ({ ...current, discord: { ...current.discord, webhookUrl: event.target.value } }))}
                        />
                      </div>
                    )}
                  </div>

                  <div className={`rounded-xl border p-4 transition-colors ${
                    notificationChannels.email.enabled
                      ? 'border-emerald-300/35 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                      : 'border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5'
                  }`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 gap-3">
                        <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/25">
                          <Mail className="h-7 w-7" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-white">Email</p>
                            <Badge className={
                              notificationChannels.emailConfig?.configured
                                ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200'
                                : 'border-amber-400/30 bg-amber-500/15 text-amber-200'
                            }>
                              {notificationChannels.emailConfig?.provider === 'mock'
                                ? 'Mock email only'
                                : notificationChannels.emailConfig?.configured
                                ? 'Email notifications active'
                                : 'Email not configured'}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-white/55">
                            Sends a polished HTML and plain-text incident email to the alert address you enter below.
                          </p>
                        </div>
                      </div>
                      <button
                        disabled={!canUpdateNotificationSettings}
                        onClick={() => {
                          const email = !notificationChannels.email.enabled;
                          setNotificationChannels((current) => ({ ...current, email: { ...current.email, enabled: email, address: current.email.address || user?.email || '' } }));
                          void updatePreferences({ email });
                        }}
                        className={`h-7 w-14 flex-shrink-0 rounded-full p-1 transition-colors ${
                          notificationChannels.email.enabled ? 'bg-emerald-500' : 'bg-white/10'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                        aria-label="Toggle email notifications"
                      >
                        <div className={`h-5 w-5 rounded-full bg-white transition-transform ${
                          notificationChannels.email.enabled ? 'translate-x-7' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                    <div className="mt-4 grid gap-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-black/15 p-3 text-xs text-neutral-500 dark:text-white/60 sm:grid-cols-3">
                      <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> HTML summary</span>
                      <span className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5 text-amber-300" /> Drift context</span>
                      <span className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5 text-sky-300" /> Action button</span>
                    </div>
                    {notificationChannels.email.enabled && (
                      <div className="mt-4">
                        <Input
                          label="Alert email address"
                          type="email"
                          placeholder={user?.email || 'alerts@example.com'}
                          value={notificationChannels.email.address || user?.email || ''}
                          disabled={!canUpdateNotificationSettings}
                          onChange={(event) => setNotificationChannels((current) => ({ ...current, email: { ...current.email, address: event.target.value } }))}
                        />
                      </div>
                    )}
                    {notificationChannels.emailConfig?.provider === 'mock' ? (
                      <div className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm leading-6 text-amber-100">
                        {notificationChannels.emailConfig.message || 'Email is in mock mode. Add real SMTP credentials or Resend credentials on Render to deliver to inboxes.'}
                      </div>
                    ) : !notificationChannels.emailConfig?.configured && (
                      <div className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm leading-6 text-amber-100">
                        {notificationChannels.emailConfig?.message || 'Email notifications are not configured. Add SMTP or Resend credentials on the server.'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button loading={isSavingChannels} disabled={!canUpdateNotificationSettings} onClick={() => void saveNotificationChannels()}>
                    Save Notification Settings
                  </Button>
                  <Button variant="secondary" loading={isSendingAlert} disabled={!canSendTestAlert} onClick={() => void sendTestAlert()}>
                    Send Test Alert
                  </Button>
                </div>
                <p className="text-sm text-neutral-500 dark:text-white/50">
                  Discord sends immediately through your webhook. Email sends server-side through SMTP or Resend to the saved alert address.
                </p>
              </CardContent>
            </Card>
          </TabPanel>

        </Tabs>
      </motion.div>

      <Modal
        isOpen={inviteModalOpen}
        onClose={() => {
          setInviteModalOpen(false);
          setGeneratedInvite(null);
          setInviteEmail('');
          setInviteRole('member');
        }}
        size="md"
      >
        <ModalHeader>
          <h2 className="text-xl font-semibold text-white">Invite Member</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-white/50">
            Generate a project invite link and login password for this team member.
          </p>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="teammate@example.com"
            disabled={Boolean(generatedInvite)}
          />
          <div>
            <p className="mb-2 text-sm font-medium text-neutral-600 dark:text-white/70">Role</p>
            <div className="grid grid-cols-3 gap-2">
              {teamRoles.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setInviteRole(role)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    inviteRole === role
                      ? 'border-primary-400/60 bg-primary-500/20 text-white'
                      : 'border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-neutral-600 dark:text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
          <Input
            label="Invite password (optional)"
            type="password"
            value={invitePassword}
            onChange={(event) => setInvitePassword(event.target.value)}
            placeholder="Leave blank to auto-generate"
            disabled={Boolean(generatedInvite)}
          />
          {generatedInvite?.inviteLink && (
            <div className="space-y-4 rounded-lg border border-primary-400/25 bg-primary-500/10 p-4">
              {inviteEmailWasSent(generatedInvite) || inviteEmailWasQueued(generatedInvite) ? (
                <div className="flex gap-3 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm leading-6 text-emerald-100">
                  <Mail className="mt-0.5 h-4 w-4 flex-none" />
                  <span>
                    {inviteEmailWasQueued(generatedInvite)
                      ? `Invite link generated for ${generatedInvite.userEmail}.`
                      : `Invite email was sent to ${generatedInvite.userEmail}. Share the password separately if needed.`}
                  </span>
                </div>
              ) : (
                <div className="flex gap-3 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm leading-6 text-amber-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                  <span>
                    {inviteEmailFailureMessage(generatedInvite)
                      ? `Invite email failed: ${inviteEmailFailureMessage(generatedInvite)} This invite is valid, but you must copy or share the link and password manually.`
                      : 'Invite email was not delivered. This invite is valid, but you must copy or share the link and password manually.'}
                  </span>
                </div>
              )}
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-normal text-primary-200">
                  Sent by
                </p>
                <code className="block rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm text-neutral-800 dark:text-white/80">
                  {generatedInvite.invitedByName} ({generatedInvite.invitedByEmail})
                </code>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-normal text-primary-200">
                  Invited email
                </p>
                <code className="block rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm text-neutral-800 dark:text-white/80">
                  {generatedInvite.userEmail}
                </code>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-normal text-primary-200">
                  <Link2 className="h-3.5 w-3.5" />
                  Invite link
                </p>
                <div className="flex gap-2">
                  <code className="min-w-0 flex-1 rounded-lg border border-sky-300/40 bg-sky-400/10 px-3 py-2 text-sm font-semibold leading-6 text-sky-100 shadow-inner shadow-sky-500/10">
                    <span className="break-all">{generatedInvite.inviteLink}</span>
                  </code>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-auto min-w-[82px]"
                    leftIcon={<Copy className="h-4 w-4" />}
                    onClick={() => void copyInviteDetail(generatedInvite.inviteLink, 'Invite link')}
                  >
                    Copy
                  </Button>
                </div>
                <p className="mt-2 text-xs leading-5 text-white/45">
                  Do not open this link from the admin browser while you are logged in. Send it to the invited person; their screen will ask whether they have an account or need to create one.
                </p>
                {isLocalInviteLink(generatedInvite.inviteLink) && (
                  <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100/80">
                    WhatsApp does not make localhost links clickable. Use a public app URL in `PUBLIC_APP_URL` for clickable invite links outside this machine.
                  </p>
                )}
              </div>
              <div>
                <p className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-normal text-primary-200">
                  <KeyRound className="h-3.5 w-3.5" />
                  Login password
                </p>
                <div className="flex gap-2">
                  <code className="min-w-0 flex-1 rounded-lg border border-emerald-300/40 bg-emerald-400/10 px-3 py-2 text-base font-bold tracking-[0.18em] text-emerald-100 shadow-inner shadow-emerald-500/10">
                    {generatedInvite.invitePassword}
                  </code>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="min-w-[82px]"
                    leftIcon={<Copy className="h-4 w-4" />}
                    onClick={() => void copyInviteDetail(generatedInvite.invitePassword, 'Login password')}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-neutral-500 dark:text-white/50">Share both details. Access activates only after the member opens the invite, chooses an account option, and enters this password.</p>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Share2 className="h-4 w-4" />}
                  onClick={() => void shareInvite()}
                >
                  Share
                </Button>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => {
            setInviteModalOpen(false);
            setGeneratedInvite(null);
            setInviteEmail('');
            setInviteRole('member');
            setInvitePassword('');
          }}>
            {generatedInvite ? 'Done' : 'Cancel'}
          </Button>
          {!generatedInvite && (
            <Button loading={isSavingTeam} onClick={() => void inviteMember()}>
              Generate Invite
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </motion.div>
  );
}
