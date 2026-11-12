'use client';

import AnnouncementFeed, { Announcement } from './AnnouncementFeed';
import { AnnouncementAttachment } from './AnnouncementAttachments';

export type ActivityFeedItem = {
  id: string;
  category: string;
  title: string;
  date: string;
  submittedAt?: string;
  note: string;
  attachments?: AnnouncementAttachment[];
  images?: string[];
  grade?: number;
  section?: string;
  subject?: string;
  author: string;
};

function createdAt(item: ActivityFeedItem) {
  if (item.submittedAt) return item.submittedAt;
  const date = new Date(`${item.date}T00:00:00`);
  return Number.isNaN(date.getTime()) ? item.date : date.toISOString();
}

function toAnnouncement(item: ActivityFeedItem): Announcement {
  const classDetails = item.grade
    ? [`${item.grade}-р анги`, item.section ? `${item.section} бүлэг` : '', item.subject ?? ''].filter(Boolean).join(' · ')
    : '';
  const attachments = [
    ...(item.attachments ?? []),
    ...(item.images ?? []).map((url, index) => ({ name: `Зураг ${index + 1}`, url, file_type: 'image' as const })),
  ];

  return {
    id: item.id,
    type: 'achievement',
    kind: 'Мэдээлэл',
    info_type: 'Оролцоо',
    title: item.category ? `${item.category}: ${item.title}` : item.title,
    body: [item.note, classDetails].filter(Boolean).join('\n'),
    createdAt: createdAt(item),
    author: item.author || 'Багш',
    attachments: [...new Map(attachments.map((attachment) => [attachment.url, attachment])).values()],
  };
}

export default function ActivityFeed({ activities }: { activities: ActivityFeedItem[] }) {
  const announcements = activities.map(toAnnouncement);
  return <AnnouncementFeed announcements={announcements} />;
}
