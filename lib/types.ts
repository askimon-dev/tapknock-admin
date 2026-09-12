export interface Account {
  id: string;
  email: string | null;
  display_name: string | null;
  photo_path: string | null;
  quekey_id: string | null;
  address_line: string | null;
  address_area: string | null;
  postcode: string | null;
  state: string | null;
  created_at: string;
  deleted_at: string | null;
  door_count?: number;
  ring_count?: number;
  active_sessions_count?: number;
}

export interface Door {
  id: string;
  owner_id: string;
  label: string;
  display_name: string | null;
  address_line: string | null;
  lat: number | null;
  lng: number | null;
  radius_m: number;
  standing_note: string | null;
  auto_reply: string | null;
  quiet_start: string | null;
  quiet_end: string | null;
  ring_seconds: number;
  is_active: number;
  pin_hash: string | null;
  print_kit: string | null;
  created_at: string;
  public_code?: string;
  owner_email?: string;
  owner_name?: string;
}

export interface Ring {
  id: string;
  door_id: string;
  code_id: string;
  visitor_id: string;
  visitor_name: string | null;
  reason: string;
  lat: number | null;
  lng: number | null;
  distance_m: number | null;
  ip_city: string | null;
  ip_country: string | null;
  ip_mismatch: number;
  trust_badge: string;
  fingerprint: string | null;
  status: string;
  answered_by: string | null;
  answered_at: string | null;
  ended_at: string | null;
  connection_type: string | null;
  duration_s: number | null;
  message_type: string | null;
  media_path: string | null;
  media_mime: string | null;
  media_size: number | null;
  message_text: string | null;
  message_sent_at: string | null;
  message_read_at: string | null;
  message_deleted_at: string | null;
  photo_at: string | null;
  created_at: string;
  door_name?: string;
  door_label?: string;
}

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  target_type: 'all' | 'targeted';
  target_account_ids: string | null;
  target_label: string | null;
  priority: 'normal' | 'high' | 'urgent';
  category: 'announcement' | 'alert' | 'maintenance' | 'update';
  action_url: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  status: 'draft' | 'scheduled' | 'sent' | 'failed' | 'cancelled';
  recipients_count: number;
  delivered_count: number;
  created_at: string;
  created_by: string | null;
}

export interface AdminAuditLog {
  id: string;
  actor: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: string | null;
  created_at: string;
}

export interface BlocklistEntry {
  id: string;
  door_id: string;
  door_name?: string;
  fingerprint: string;
  ring_id: string | null;
  reason: string | null;
  created_at: string;
}

export interface DashboardMetrics {
  totalAccounts: number;
  totalDoors: number;
  totalRings: number;
  ringsToday: number;
  answerRate: number;
  activeOnlineDevices: number;
  notificationsCount: number;
  recentRings: Ring[];
  recentNotifications: PushNotification[];
  ringActivity: { date: string; rings: number; answered: number }[];
  outcomesBreakdown: { name: string; count: number; color: string }[];
  hourlyActivity: { hour: string; count: number }[];
}

export interface AppRelease {
  id: string;
  version_name: string;
  version_code: number;
  platform: 'android' | 'ios' | 'all';
  release_type: 'playstore' | 'drive' | 'apk' | 'direct_link' | 'other';
  download_url: string;
  title: string;
  release_notes: string | null;
  is_mandatory: number;
  min_supported_version_code: number;
  is_active: number;
  download_count: number;
  created_at: string;
  published_at: string | null;
}
