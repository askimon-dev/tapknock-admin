'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  Send,
  Paperclip,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Phone,
  Smartphone,
  Battery,
  Wifi,
  HardDrive,
  Cpu,
  Shield,
  FileText,
  DoorClosed,
  ChevronRight,
  ExternalLink,
  Lock,
  CornerDownRight,
  Sparkles,
  Info,
  Radio,
  Image as ImageIcon,
  Video,
  File as FileIcon,
  X,
} from 'lucide-react';

interface Attachment {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  url: string;
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: 'user' | 'admin';
  sender_id: string;
  sender_name: string;
  message: string;
  attachments?: Attachment[];
  created_at: string;
}

interface SupportTicket {
  id: string;
  ticket_number: string;
  account_id: string;
  door_id?: string;
  door_name?: string;
  user_email?: string;
  user_name?: string;
  subject: string;
  status: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  device_info?: any;
  unread_user_count: number;
  unread_admin_count: number;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
  last_message_preview?: string;
}

interface SupportNote {
  id: string;
  ticket_id: string;
  author: string;
  note: string;
  created_at: string;
}

const cannedReplies = [
  'Hello! How can we assist you with your TapKnock doorbell today?',
  'Could you please share a quick photo or screenshot so we can investigate?',
  'Please ensure battery optimization is set to "Unrestricted" in your Android App Settings.',
  'We have verified this issue and deployed a fix on our servers. Could you test again?',
  'Your printed QR code looks slightly degraded. You can re-print a fresh copy from the Print Kit tab.',
  'Thank you for confirming! We are marking this ticket as resolved. Feel free to reply if you need further help.',
];

export default function SupportDashboardPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetails, setTicketDetails] = useState<{
    ticket: SupportTicket;
    messages: SupportMessage[];
    notes: SupportNote[];
  } | null>(null);

  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Active view tab in detail pane
  const [activeTab, setActiveTab] = useState<'chat' | 'diagnostics' | 'notes'>('chat');

  // Chat inputs
  const [replyMessage, setReplyMessage] = useState('');
  const [executiveName, setExecutiveName] = useState('Executive Sarah');
  const [updateStatusTo, setUpdateStatusTo] = useState<string>('');
  const [pendingFiles, setPendingFiles] = useState<{ base64: string; name: string; mime: string; previewUrl?: string }[]>([]);

  // Internal note input
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load tickets list
  const loadTickets = async () => {
    try {
      setLoadingList(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/support/tickets?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch (e) {
      console.error('Failed to load tickets', e);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [statusFilter, priorityFilter, searchQuery]);

  // Load ticket details when selected
  const loadTicketDetail = async (id: string) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/support/tickets/${id}`);
      if (res.ok) {
        const data = await res.json();
        setTicketDetails(data);
        // Refresh ticket in list to update unread count
        setTickets((prev) =>
          prev.map((t) => (t.id === id ? { ...t, unread_admin_count: 0 } : t))
        );
      }
    } catch (e) {
      console.error('Failed to load ticket details', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (selectedTicketId) {
      loadTicketDetail(selectedTicketId);
    } else {
      setTicketDetails(null);
    }
  }, [selectedTicketId]);

  useEffect(() => {
    if (activeTab === 'chat' && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ticketDetails?.messages, activeTab]);

  // Connect SSE for real-time ticket events
  useEffect(() => {
    let evtSource: EventSource | null = null;
    try {
      evtSource = new EventSource('/api/support/stream');
      evtSource.onopen = () => setSseConnected(true);
      evtSource.onerror = () => setSseConnected(false);

      evtSource.addEventListener('ticket_created', (e: any) => {
        try {
          const data = JSON.parse(e.data);
          setTickets((prev) => [data.ticket, ...prev.filter((t) => t.id !== data.ticket.id)]);
        } catch {}
      });

      evtSource.addEventListener('ticket_updated', (e: any) => {
        try {
          const data = JSON.parse(e.data);
          setTickets((prev) =>
            prev.map((t) => (t.id === data.ticket.id ? { ...t, ...data.ticket } : t))
          );
          if (selectedTicketId === data.ticket.id) {
            setTicketDetails((prev) => (prev ? { ...prev, ticket: { ...prev.ticket, ...data.ticket } } : null));
          }
        } catch {}
      });

      evtSource.addEventListener('new_message', (e: any) => {
        try {
          const data = JSON.parse(e.data);
          // If viewing this ticket, append message
          if (selectedTicketId === data.ticket_id) {
            setTicketDetails((prev) => {
              if (!prev) return null;
              const exists = prev.messages.some((m) => m.id === data.message.id);
              if (exists) return prev;
              return {
                ...prev,
                ticket: data.ticket || prev.ticket,
                messages: [...prev.messages, data.message],
              };
            });
          }
          // Refresh list to update previews and unread badges
          setTickets((prev) =>
            prev.map((t) =>
              t.id === data.ticket_id
                ? {
                    ...t,
                    last_message_preview: data.message.message,
                    last_message_at: data.message.created_at,
                    unread_admin_count:
                      data.message.sender_type === 'user' && selectedTicketId !== data.ticket_id
                        ? t.unread_admin_count + 1
                        : 0,
                  }
                : t
            )
          );
        } catch {}
      });
    } catch {}

    return () => {
      if (evtSource) evtSource.close();
    };
  }, [selectedTicketId]);

  // Send reply message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTicketId || (!replyMessage.trim() && pendingFiles.length === 0)) return;

    try {
      setSendingMessage(true);

      // Upload any attachments
      const uploadedAttachments: Attachment[] = [];
      for (const file of pendingFiles) {
        const upRes = await fetch('/api/support/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64: file.base64,
            file_name: file.name,
            mime_type: file.mime,
          }),
        });
        if (upRes.ok) {
          const upData = await upRes.json();
          uploadedAttachments.push(upData.attachment);
        }
      }

      const res = await fetch(`/api/support/tickets/${selectedTicketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_name: executiveName,
          message: replyMessage.trim(),
          attachments: uploadedAttachments,
          update_status: updateStatusTo || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTicketDetails((prev) =>
          prev
            ? {
                ...prev,
                ticket: data.ticket || prev.ticket,
                messages: [...prev.messages, data.message],
              }
            : null
        );
        setReplyMessage('');
        setPendingFiles([]);
        setUpdateStatusTo('');
      }
    } catch (e) {
      console.error('Failed to send support reply', e);
    } finally {
      setSendingMessage(false);
    }
  };

  // Update ticket status or priority
  const handleUpdateTicket = async (patch: Partial<SupportTicket>) => {
    if (!selectedTicketId) return;
    try {
      const res = await fetch(`/api/support/tickets/${selectedTicketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = await res.json();
        setTicketDetails((prev) => (prev ? { ...prev, ticket: data.ticket } : null));
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedTicketId ? { ...t, ...data.ticket } : t))
        );
      }
    } catch (e) {
      console.error('Failed to update ticket', e);
    }
  };

  // Add internal note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !newNote.trim()) return;

    try {
      setSavingNote(true);
      const res = await fetch(`/api/support/tickets/${selectedTicketId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: executiveName,
          note: newNote.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTicketDetails((prev) =>
          prev ? { ...prev, notes: [data.note, ...prev.notes] } : null
        );
        setNewNote('');
      }
    } catch (e) {
      console.error('Failed to save note', e);
    } finally {
      setSavingNote(false);
    }
  };

  // File selection for executive
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setPendingFiles((prev) => [
          ...prev,
          {
            base64,
            name: file.name,
            mime: file.type || 'application/octet-stream',
            previewUrl: file.type.startsWith('image/') ? (reader.result as string) : undefined,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // Helper styles
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'in_progress':
        return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'waiting_user':
        return 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'resolved':
        return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'closed':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-bold';
      case 'high':
        return 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 font-semibold';
      case 'medium':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
      default:
        return 'bg-slate-100 text-slate-500';
    }
  };

  // Metrics
  const totalCount = tickets.length;
  const openCount = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
  const urgentCount = tickets.filter((t) => t.priority === 'urgent' || t.priority === 'high').length;
  const unreadCount = tickets.filter((t) => t.unread_admin_count > 0).length;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Top Header & Metrics */}
      <div className="p-5 bg-surface-card border-b border-surface-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Live Support & Executive Chat
              </h1>
              <div
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  sseConnected
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                {sseConnected ? 'Realtime Connected' : 'Polling'}
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Live communication with TapKnock users, complete device diagnostics, and attachment inspection.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-surface-darkest border border-surface-border text-center">
              <span className="block text-xs text-slate-500 font-medium">Total Tickets</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{totalCount}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
              <span className="block text-xs text-blue-600 dark:text-blue-400 font-medium">Active</span>
              <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{openCount}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-center">
              <span className="block text-xs text-rose-600 dark:text-rose-400 font-medium">Urgent</span>
              <span className="text-sm font-bold text-rose-700 dark:text-rose-300">{urgentCount}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
              <span className="block text-xs text-amber-600 dark:text-amber-400 font-medium">Unread</span>
              <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{unreadCount}</span>
            </div>
            <button
              onClick={loadTickets}
              disabled={loadingList}
              className="p-2 rounded-lg border border-surface-border hover:bg-surface-darkest text-slate-600 dark:text-slate-300 transition-colors"
              title="Refresh tickets"
            >
              <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Split Layout: Left Queue, Right Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Ticket Queue */}
        <div className="w-full md:w-96 lg:w-[420px] flex flex-col border-r border-surface-border bg-surface-card shrink-0">
          {/* Filters Bar */}
          <div className="p-3 border-b border-surface-border space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket #, subject, email..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-surface-border bg-surface-darkest text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 py-1 px-2 text-xs rounded-md border border-surface-border bg-surface-darkest text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">Status: All</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_user">Waiting for User</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="flex-1 py-1 px-2 text-xs rounded-md border border-surface-border bg-surface-darkest text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">Priority: All</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Ticket Cards List */}
          <div className="flex-1 overflow-y-auto divide-y divide-surface-border/50">
            {loadingList && tickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading tickets...</div>
            ) : tickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No tickets found matching filters.</div>
            ) : (
              tickets.map((t) => {
                const isSelected = selectedTicketId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className={`p-3.5 cursor-pointer transition-colors border-l-4 ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-600'
                        : t.unread_admin_count > 0
                        ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-500 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                          {t.ticket_number}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStatusBadge(
                            t.status
                          )}`}
                        >
                          {t.status.replace('_', ' ').toUpperCase()}
                        </span>
                        {t.priority === 'urgent' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                            URGENT
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(t.last_message_at || t.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate mb-1">
                      {t.subject}
                    </h4>

                    {t.last_message_preview && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-1.5">
                        {t.last_message_preview}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span className="truncate max-w-[180px]">
                        {t.user_name || t.user_email || 'User'}
                      </span>
                      {t.unread_admin_count > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white font-bold text-[9px]">
                          {t.unread_admin_count} new
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Active Workspace */}
        <div className="flex-1 flex flex-col bg-surface-darkest overflow-hidden">
          {!selectedTicketId || !ticketDetails ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface-card border border-surface-border flex items-center justify-center text-slate-400 mb-3 shadow-sm">
                <MessageSquare className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                Select a support ticket
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Choose a conversation from the ticket queue on the left to review customer diagnostics, respond in real-time, and manage resolution.
              </p>
            </div>
          ) : (
            <>
              {/* Workspace Header */}
              <div className="p-4 bg-surface-card border-b border-surface-border shrink-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                        {ticketDetails.ticket.ticket_number}
                      </span>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                        {ticketDetails.ticket.subject}
                      </h2>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span>User: {ticketDetails.ticket.user_name || ticketDetails.ticket.user_email}</span>
                      {ticketDetails.ticket.door_name && (
                        <span>• Door: {ticketDetails.ticket.door_name}</span>
                      )}
                      <span>• Category: {ticketDetails.ticket.category}</span>
                    </div>
                  </div>

                  {/* Status & Priority Controls */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={ticketDetails.ticket.status}
                      onChange={(e) => handleUpdateTicket({ status: e.target.value as any })}
                      className="text-xs font-semibold py-1 px-2.5 rounded-lg border border-surface-border bg-surface-darkest text-slate-800 dark:text-slate-100"
                    >
                      <option value="open">Status: Open</option>
                      <option value="in_progress">Status: In Progress</option>
                      <option value="waiting_user">Status: Waiting for User</option>
                      <option value="resolved">Status: Resolved</option>
                      <option value="closed">Status: Closed</option>
                    </select>

                    <select
                      value={ticketDetails.ticket.priority}
                      onChange={(e) => handleUpdateTicket({ priority: e.target.value as any })}
                      className="text-xs font-semibold py-1 px-2.5 rounded-lg border border-surface-border bg-surface-darkest text-slate-800 dark:text-slate-100"
                    >
                      <option value="low">Priority: Low</option>
                      <option value="medium">Priority: Medium</option>
                      <option value="high">Priority: High</option>
                      <option value="urgent">Priority: Urgent</option>
                    </select>
                  </div>
                </div>

                {/* Workspace Navigation Tabs */}
                <div className="flex items-center gap-4 mt-4 border-b border-surface-border">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`pb-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                      activeTab === 'chat'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Live Chat ({ticketDetails.messages.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('diagnostics')}
                    className={`pb-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                      activeTab === 'diagnostics'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Device Diagnostics
                  </button>
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={`pb-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                      activeTab === 'notes'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Internal Notes ({ticketDetails.notes.length})
                  </button>
                </div>
              </div>

              {/* Tab 1: Live Chat */}
              {activeTab === 'chat' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Messages Scroll Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {ticketDetails.messages.map((m) => {
                      const isAdmin = m.sender_type === 'admin';
                      return (
                        <div
                          key={m.id}
                          className={`flex gap-3 ${isAdmin ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isAdmin && (
                            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs font-bold shrink-0">
                              {m.sender_name?.[0] || 'U'}
                            </div>
                          )}
                          <div
                            className={`max-w-[75%] rounded-2xl p-3 shadow-sm ${
                              isAdmin
                                ? 'bg-blue-600 text-white rounded-br-sm'
                                : 'bg-surface-card border border-surface-border text-slate-800 dark:text-slate-100 rounded-bl-sm'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 text-[10px] mb-1 opacity-75">
                              <span className="font-semibold">{m.sender_name}</span>
                              <span>
                                {new Date(m.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>

                            {m.message && (
                              <p className="text-xs leading-relaxed whitespace-pre-wrap">{m.message}</p>
                            )}

                            {/* Attachments rendering */}
                            {m.attachments && m.attachments.length > 0 && (
                              <div className="mt-2 space-y-1.5 pt-1.5 border-t border-white/20 dark:border-slate-700/50">
                                {m.attachments.map((att) => {
                                  const fullUrl = att.url.startsWith('http')
                                    ? att.url
                                    : `https://tapknock.generalquery.xyz${att.url}`;
                                  const isImg = att.mime_type.startsWith('image/');
                                  const isVid = att.mime_type.startsWith('video/');

                                  return (
                                    <div key={att.id}>
                                      {isImg ? (
                                        <a
                                          href={fullUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="block rounded-lg overflow-hidden max-h-48 border border-white/20 hover:opacity-90 transition-opacity"
                                        >
                                          <img
                                            src={fullUrl}
                                            alt={att.original_name}
                                            className="w-full h-auto object-cover max-h-48"
                                          />
                                        </a>
                                      ) : isVid ? (
                                        <video
                                          src={fullUrl}
                                          controls
                                          className="w-full rounded-lg max-h-48 bg-black/40"
                                        />
                                      ) : (
                                        <a
                                          href={fullUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="flex items-center gap-2 p-2 rounded-lg bg-black/10 dark:bg-white/10 hover:bg-black/20 text-xs transition-colors"
                                        >
                                          <FileIcon className="w-4 h-4 shrink-0" />
                                          <span className="truncate flex-1">{att.original_name}</span>
                                          <span className="text-[10px] opacity-75">
                                            {(att.size_bytes / 1024).toFixed(0)} KB
                                          </span>
                                        </a>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Canned Quick Replies */}
                  <div className="px-4 py-2 border-t border-surface-border bg-surface-card/60 flex items-center gap-1.5 overflow-x-auto text-[11px]">
                    <span className="text-slate-400 font-medium shrink-0 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" /> Canned:
                    </span>
                    {cannedReplies.map((r, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setReplyMessage(r)}
                        className="px-2.5 py-1 rounded-full bg-surface-darkest border border-surface-border text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition-colors whitespace-nowrap shrink-0"
                      >
                        {r.slice(0, 32)}...
                      </button>
                    ))}
                  </div>

                  {/* Pending file attachments strip */}
                  {pendingFiles.length > 0 && (
                    <div className="px-4 py-2 bg-surface-card border-t border-surface-border flex items-center gap-2 overflow-x-auto">
                      {pendingFiles.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-darkest border border-surface-border text-xs"
                        >
                          {f.previewUrl ? (
                            <img src={f.previewUrl} alt="preview" className="w-4 h-4 rounded object-cover" />
                          ) : (
                            <FileIcon className="w-3.5 h-3.5 text-blue-500" />
                          )}
                          <span className="truncate max-w-[120px]">{f.name}</span>
                          <button
                            type="button"
                            onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-slate-400 hover:text-rose-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Chat Input Bar */}
                  <form onSubmit={handleSendMessage} className="p-3 bg-surface-card border-t border-surface-border">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <span>Replying as:</span>
                        <input
                          type="text"
                          value={executiveName}
                          onChange={(e) => setExecutiveName(e.target.value)}
                          className="px-1.5 py-0.5 rounded border border-surface-border bg-surface-darkest text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none w-36"
                        />
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 ml-auto">
                        <span>Update status to:</span>
                        <select
                          value={updateStatusTo}
                          onChange={(e) => setUpdateStatusTo(e.target.value)}
                          className="px-1.5 py-0.5 rounded border border-surface-border bg-surface-darkest text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
                        >
                          <option value="">(Keep current)</option>
                          <option value="in_progress">In Progress</option>
                          <option value="waiting_user">Waiting for User</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-end gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        multiple
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-xl border border-surface-border text-slate-500 hover:text-blue-600 hover:bg-surface-darkest transition-colors shrink-0"
                        title="Attach screenshot or file"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>

                      <textarea
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder="Type a message to the user... (Press Enter to send)"
                        rows={2}
                        className="flex-1 p-2.5 text-xs rounded-xl border border-surface-border bg-surface-darkest text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                      />

                      <button
                        type="submit"
                        disabled={sendingMessage || (!replyMessage.trim() && pendingFiles.length === 0)}
                        className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Tab 2: Device Diagnostics */}
              {activeTab === 'diagnostics' && (
                <div className="flex-1 overflow-y-auto p-6">
                  {!ticketDetails.ticket.device_info ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No device diagnostics attached to this ticket.
                    </div>
                  ) : (
                    <div className="max-w-3xl mx-auto space-y-6">
                      <div className="bg-surface-card rounded-xl border border-surface-border p-5">
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-surface-border">
                          <Smartphone className="w-4 h-4 text-blue-600" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                            Hardware & System Profile
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="block text-[11px] text-slate-400 font-medium">Device</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {ticketDetails.ticket.device_info.manufacturer}{' '}
                              {ticketDetails.ticket.device_info.model}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[11px] text-slate-400 font-medium">Android OS</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              v{ticketDetails.ticket.device_info.os_version} (API{' '}
                              {ticketDetails.ticket.device_info.sdk_int})
                            </span>
                          </div>
                          <div>
                            <span className="block text-[11px] text-slate-400 font-medium">App Version</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              v{ticketDetails.ticket.device_info.app_version} (Code{' '}
                              {ticketDetails.ticket.device_info.app_version_code})
                            </span>
                          </div>
                          <div>
                            <span className="block text-[11px] text-slate-400 font-medium">Battery</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {ticketDetails.ticket.device_info.battery_level}%{' '}
                              {ticketDetails.ticket.device_info.is_charging ? '(Charging)' : ''}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[11px] text-slate-400 font-medium">Network</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {ticketDetails.ticket.device_info.network_type || 'Unknown'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[11px] text-slate-400 font-medium">Internal Storage</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {ticketDetails.ticket.device_info.storage_available_mb} MB free /{' '}
                              {ticketDetails.ticket.device_info.storage_total_mb} MB
                            </span>
                          </div>
                          <div>
                            <span className="block text-[11px] text-slate-400 font-medium">System RAM</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {ticketDetails.ticket.device_info.ram_available_mb} MB avail /{' '}
                              {ticketDetails.ticket.device_info.ram_total_mb} MB
                            </span>
                          </div>
                          <div>
                            <span className="block text-[11px] text-slate-400 font-medium">Locale & Timezone</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {ticketDetails.ticket.device_info.locale} (
                              {ticketDetails.ticket.device_info.timezone})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Permissions Profile */}
                      <div className="bg-surface-card rounded-xl border border-surface-border p-5">
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-surface-border">
                          <Shield className="w-4 h-4 text-emerald-600" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                            Critical Ring Permissions
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="block text-[11px] text-slate-400 font-medium">Notifications</span>
                            <span
                              className={`font-semibold ${
                                ticketDetails.ticket.device_info.notifications_enabled
                                  ? 'text-emerald-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {ticketDetails.ticket.device_info.notifications_enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[11px] text-slate-400 font-medium">Full-Screen Ring Intent</span>
                            <span
                              className={`font-semibold ${
                                ticketDetails.ticket.device_info.full_screen_intent_allowed
                                  ? 'text-emerald-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {ticketDetails.ticket.device_info.full_screen_intent_allowed
                                ? 'Allowed'
                                : 'Restricted (Lock screen ring won’t pop up)'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[11px] text-slate-400 font-medium">Battery Optimization</span>
                            <span
                              className={`font-semibold ${
                                ticketDetails.ticket.device_info.ignoring_battery_optimizations
                                  ? 'text-emerald-600'
                                  : 'text-amber-600'
                              }`}
                            >
                              {ticketDetails.ticket.device_info.ignoring_battery_optimizations
                                ? 'Ignored (Good)'
                                : 'Optimized (May delay rings)'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[11px] text-slate-400 font-medium">Camera Permission</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {ticketDetails.ticket.device_info.camera_permission ? 'Granted' : 'Denied'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[11px] text-slate-400 font-medium">Microphone Permission</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {ticketDetails.ticket.device_info.mic_permission ? 'Granted' : 'Denied'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Door Context */}
                      {ticketDetails.ticket.device_info.door && (
                        <div className="bg-surface-card rounded-xl border border-surface-border p-5">
                          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-surface-border">
                            <DoorClosed className="w-4 h-4 text-indigo-600" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                              User Door Configuration
                            </h3>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                            <div>
                              <span className="block text-[11px] text-slate-400 font-medium">Door Label</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-100">
                                {ticketDetails.ticket.device_info.door.label}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[11px] text-slate-400 font-medium">Doorbell Active</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-100">
                                {ticketDetails.ticket.device_info.door.is_active ? 'Active' : 'Paused'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[11px] text-slate-400 font-medium">Quiet Hours</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-100">
                                {ticketDetails.ticket.device_info.door.quiet_window || 'Off'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[11px] text-slate-400 font-medium">Radius</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-100">
                                {ticketDetails.ticket.device_info.door.radius_m} m
                              </span>
                            </div>
                            <div>
                              <span className="block text-[11px] text-slate-400 font-medium">Auto-Reply</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-100">
                                {ticketDetails.ticket.device_info.door.auto_reply || 'Default'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Internal Notes */}
              {activeTab === 'notes' && (
                <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full space-y-5">
                  <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-2">
                      Add Internal Executive Note
                    </h3>
                    <p className="text-[11px] text-slate-400 mb-3">
                      Internal notes are private to staff and never shown to the customer.
                    </p>
                    <form onSubmit={handleAddNote} className="space-y-3">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Log internal diagnostics, escalation info, or customer background..."
                        rows={3}
                        className="w-full p-2.5 text-xs rounded-lg border border-surface-border bg-surface-darkest text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={savingNote || !newNote.trim()}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                        >
                          {savingNote ? 'Saving...' : 'Post Internal Note'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Past notes list */}
                  <div className="space-y-3">
                    {ticketDetails.notes.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400">
                        No internal notes recorded for this ticket yet.
                      </div>
                    ) : (
                      ticketDetails.notes.map((note) => (
                        <div
                          key={note.id}
                          className="bg-surface-card rounded-xl border border-surface-border p-4 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-surface-border">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {note.author}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(note.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                            {note.note}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
