import React, { useEffect, useRef, useState } from 'react';
import { User, TeamMessage } from '../types';

interface TeamChatPageProps {
  activeTab: 'team-chat';
  usersList: User[];
  user: User;
  activeTeamDmId: string;
  setActiveTeamDmId: (id: string) => void;
  teamRecipientId: string;
  setTeamRecipientId: (id: string) => void;
  teamChatSubTab: 'messages' | 'files';
  setTeamChatSubTab: (tab: 'messages' | 'files') => void;
  teamMessageText: string;
  setTeamMessageText: (text: string) => void;
  teamFiles: any[];
  setTeamFiles: React.Dispatch<React.SetStateAction<any[]>>;
  teamDmSearch: string;
  setTeamDmSearch: (search: string) => void;
  teamUnreadOnly: boolean;
  setTeamUnreadOnly: (unread: boolean) => void;
  teamPresenceStatus: 'online' | 'away' | 'offline';
  setTeamPresenceStatus: (status: 'online' | 'away' | 'offline') => void;
  profilePicture: string;
  teamGlobalUnreadCount: number;
  fetchTeamMessages: () => void;
  getTeamThreadMessages: (id: string) => any[];
  getTeamThreadUnreadCount: (id: string) => number;
  getTeamMessageDateKey: (dateStr?: string) => string;
  formatTeamPreviewTime: (dateStr?: string) => string;
  formatTeamDateDivider: (dateStr?: string) => string;
  formatTeamTime: (dateStr?: string) => string;
  handleDeleteTeamMessage: (id: string) => void;
  renderTeamMessageContent: (content: string) => React.ReactNode;
  handleSendTeamMessage: (e: React.FormEvent) => void;
  formatTeamDraft: (action: string) => void;
  addTeamFiles: (files: FileList | any[]) => void;
  startTeamCall: () => void;
  teamPosting: boolean;
  handleSelectCommunications: () => void;
  setUserNotesOpen: (open: boolean) => void;
  fetchTeamNotes: () => void;
  teamMessages: TeamMessage[];
}

export function TeamChatPage(props: TeamChatPageProps) {
  const {
    activeTab,
    usersList,
    user,
    activeTeamDmId,
    setActiveTeamDmId,
    teamRecipientId,
    setTeamRecipientId,
    teamChatSubTab,
    setTeamChatSubTab,
    teamMessageText,
    setTeamMessageText,
    teamFiles,
    setTeamFiles,
    teamDmSearch,
    setTeamDmSearch,
    teamUnreadOnly,
    setTeamUnreadOnly,
    teamPresenceStatus,
    setTeamPresenceStatus,
    profilePicture,
    teamGlobalUnreadCount,
    fetchTeamMessages,
    getTeamThreadMessages,
    getTeamThreadUnreadCount,
    getTeamMessageDateKey,
    formatTeamPreviewTime,
    formatTeamDateDivider,
    formatTeamTime,
    handleDeleteTeamMessage,
    renderTeamMessageContent,
    handleSendTeamMessage,
    formatTeamDraft,
    addTeamFiles,
    startTeamCall,
    teamPosting,
    handleSelectCommunications,
    setUserNotesOpen,
    fetchTeamNotes,
    teamMessages,
  } = props;

  const teamStreamRef = useRef<HTMLDivElement | null>(null);
  const teamEndRef = useRef<HTMLDivElement | null>(null);
  const teamTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  /** Collapsed composer = more room for chat history until the user starts typing. */
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    // Keep open while drafting; collapse when switching chats if empty.
    if (!teamMessageText.trim() && teamFiles.length === 0) {
      setComposerOpen(false);
    }
  }, [activeTeamDmId]);

  useEffect(() => {
    if (composerOpen && teamTextareaRef.current) {
      teamTextareaRef.current.focus();
    }
  }, [composerOpen, activeTeamDmId]);

  if (activeTab === 'team-chat') {
    const staffMembers = usersList.filter(staff => staff.id !== user.id);
    const onlineCount = usersList.filter(staff => staff.presence_status === 'online').length;
    const formatFileSize = (size = 0) => size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.ceil(size / 1024))} KB`;

    const buildDmOption = (id: string, name: string, role = '') => {
      const messages = getTeamThreadMessages(id).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      const latest = messages[0];
      const unread = getTeamThreadUnreadCount(id);
      const preview = latest
        ? `${latest.user_id === user.id ? 'You: ' : ''}${latest.content || (latest.attachments?.length ? `${latest.attachments.length} file${latest.attachments.length === 1 ? '' : 's'} shared` : 'New message')}`
        : 'No messages yet';
      return { id, name, role, latest, preview, unread };
    };

    const dmOptions = [
      buildDmOption('all', 'All staff', 'channel'),
      ...staffMembers.map(staff => buildDmOption(staff.id, staff.name, staff.role))
    ].filter(option => {
      const query = teamDmSearch.trim().toLowerCase();
      const matchesSearch = !query || option.name.toLowerCase().includes(query) || option.preview.toLowerCase().includes(query);
      const matchesUnread = !teamUnreadOnly || option.unread > 0;
      return matchesSearch && matchesUnread;
    }).sort((a, b) => {
      if (a.id === 'all') return -1;
      if (b.id === 'all') return 1;
      if (b.unread !== a.unread) return b.unread - a.unread;
      return String(b.latest?.created_at || '').localeCompare(String(a.latest?.created_at || ''));
    });

    const activeDm = dmOptions.find(option => option.id === activeTeamDmId) || buildDmOption(activeTeamDmId, activeTeamDmId === 'all' ? 'All staff' : usersList.find(staff => staff.id === activeTeamDmId)?.name || 'Direct message');
    const activeThreadMessages = getTeamThreadMessages(activeTeamDmId).sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    const activeThreadMessagesWithDates = activeThreadMessages.map((message, index) => ({
      message,
      showDateDivider: index === 0 || getTeamMessageDateKey(message.created_at) !== getTeamMessageDateKey(activeThreadMessages[index - 1]?.created_at),
    }));
    const activeThreadFiles = activeThreadMessages.flatMap(message => (message.attachments || []).map((file: any) => ({ message, file }))).slice().reverse();

    const getDmPresence = (dmId: string) => {
      if (dmId === 'all') return { label: 'Channel', className: 'channel' };
      const staff = dmId === user.id ? user : usersList.find(item => item.id === dmId);
      const status = staff?.presence_status === 'online' || staff?.presence_status === 'away' || staff?.presence_status === 'offline'
        ? staff.presence_status
        : 'offline';
      return {
        label: status === 'away' ? 'Away' : status === 'offline' ? 'Offline' : 'Online',
        className: status
      };
    };

    const getTeamAvatarUrl = (id?: string) => {
      const staff = id === user.id ? user : usersList.find(item => item.id === id);
      return staff?.profile_picture_url || staff?.avatar_url || staff?.picture_url || (id === user.id ? profilePicture : '');
    };

    const renderTeamAvatar = (id: string, name: string, extraClass = '') => {
      const avatarUrl = id === 'all' ? '' : getTeamAvatarUrl(id);
      return (
        <span className={`team-dm-avatar ${id === 'all' ? 'all' : ''} ${extraClass}`}>
          {avatarUrl ? <img src={avatarUrl} alt={name || 'Team member'} /> : (id === 'all' ? '#' : (name || '?').charAt(0))}
        </span>
      );
    };

    const activePresence = getDmPresence(activeTeamDmId);

    return (
      <div className="team-slack-shell team-chat-premium">
        <aside className="team-dm-sidebar">
          <div className="team-dm-title team-dm-title--premium">
            <button type="button" className="team-dm-back" onClick={handleSelectCommunications}>
              <i className="fas fa-arrow-left"></i>
              <span>Hub</span>
            </button>
            <div className="team-dm-title__copy">
              <h3>Team Chat</h3>
              <span>
                <em className="team-online-pill"><i className="fas fa-circle"></i> {onlineCount} online</em>
                {teamGlobalUnreadCount > 0 ? ` · ${teamGlobalUnreadCount} unread` : ' · All caught up'}
              </span>
            </div>
            <div className="team-dm-actions">
              <label className="team-unread-toggle" title="Show unread only">
                <input type="checkbox" checked={teamUnreadOnly} onChange={e => setTeamUnreadOnly(e.target.checked)} />
                <span>Unread</span>
              </label>
              <button type="button" className="team-icon-btn" onClick={fetchTeamMessages} title="Refresh messages">
                <i className="fas fa-arrows-rotate"></i>
              </button>
            </div>
          </div>

          <div className="team-dm-search team-dm-search--premium">
            <i className="fas fa-search"></i>
            <input value={teamDmSearch} onChange={e => setTeamDmSearch(e.target.value)} placeholder="Search people or messages..." />
          </div>

          <div className="team-dm-list">
            {dmOptions.map(option => (
              <button
                key={option.id}
                type="button"
                className={`team-dm-item ${activeTeamDmId === option.id ? 'active' : ''} ${option.unread ? 'unread' : ''}`}
                onClick={() => {
                  setActiveTeamDmId(option.id);
                  setTeamRecipientId(option.id);
                  setTeamChatSubTab('messages');
                  setTeamMessageText('');
                  setTeamFiles([]);
                }}
              >
                {renderTeamAvatar(option.id, option.name)}
                <span className="team-dm-copy">
                  <strong>{option.name}<span className={`team-presence-dot ${getDmPresence(option.id).className}`}></span></strong>
                  <small>{option.preview}</small>
                </span>
                <span className="team-dm-side">
                  {option.latest?.created_at && <time>{formatTeamPreviewTime(option.latest.created_at)}</time>}
                  {option.unread > 0 && <em>{option.unread > 9 ? '9+' : option.unread}</em>}
                </span>
              </button>
            ))}
            {dmOptions.length === 0 && (
              <div className="team-dm-empty">
                <i className="fas fa-magnifying-glass"></i>
                <strong>No matching chats</strong>
                <span>Try a different search or turn off unread-only.</span>
              </div>
            )}
          </div>
        </aside>

        <section className="team-chat-pane">
          <div className="team-chat-header">
            {renderTeamAvatar(activeTeamDmId, activeDm.name)}
            <div className="team-chat-header__identity">
              <h3>{activeDm.name}</h3>
              <span>
                <span className={`team-presence-dot ${activePresence.className}`}></span>
                {activeTeamDmId === 'all' ? 'Messages everyone can see' : activePresence.label}
                <em className="team-chat-header__meta">
                  · {activeThreadMessages.length} msg{activeThreadMessages.length === 1 ? '' : 's'}
                  {activeThreadFiles.length > 0 ? ` · ${activeThreadFiles.length} file${activeThreadFiles.length === 1 ? '' : 's'}` : ''}
                </em>
              </span>
            </div>
            <div className="team-chat-header__actions">
              {activeDm.unread > 0 && <strong className="team-chat-header__new">{activeDm.unread} new</strong>}
              <button type="button" className="team-call-button" onClick={startTeamCall} disabled={teamPosting} title="Start a team call and share the join link in this chat">
                <i className="fas fa-phone"></i>
                <span>Start call</span>
              </button>
              <label className="team-presence-control" title="Your chat availability">
                <span>Status</span>
                <select value={teamPresenceStatus} onChange={e => setTeamPresenceStatus(e.target.value as 'online' | 'away' | 'offline')}>
                  <option value="online">Online</option>
                  <option value="away">Away</option>
                  <option value="offline">Offline</option>
                </select>
              </label>
            </div>
          </div>

          <div className="team-chat-tabs">
            <button type="button" className={teamChatSubTab === 'messages' ? 'active' : ''} onClick={() => setTeamChatSubTab('messages')}>
              <i className="fas fa-comment"></i> Messages
            </button>
            <button type="button" className={teamChatSubTab === 'files' ? 'active' : ''} onClick={() => setTeamChatSubTab('files')}>
              <i className="fas fa-folder-open"></i> Files and links
              {activeThreadFiles.length > 0 && <span>{activeThreadFiles.length}</span>}
            </button>
            <button type="button" className="team-chat-open-notes" title="Open personal notes" onClick={() => { setUserNotesOpen(true); fetchTeamNotes(); }}>
              <i className="fas fa-note-sticky"></i> My Notes
            </button>
            <button type="button" className="team-chat-jump-latest" title="Jump to latest message" onClick={() => teamEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })}>
              <i className="fas fa-arrow-down"></i> Latest
            </button>
            <label title="Attach files" style={{ cursor: 'pointer' }}>
              <i className="fas fa-plus"></i>
              <input type="file" multiple style={{ display: 'none' }} onChange={e => { addTeamFiles(e.target.files || []); e.currentTarget.value = ''; }} />
            </label>
          </div>

          {teamChatSubTab === 'messages' ? (
            <div className="team-message-stream team-message-stream--slack" ref={teamStreamRef}>
              {activeThreadMessages.length === 0 ? (
                <div className="team-empty">
                  <i className="fas fa-comments"></i>
                  <strong>{activeTeamDmId === 'all' ? 'No all-staff messages yet' : `No conversation with ${activeDm.name} yet`}</strong>
                  <span>Send a message or attach files. They can read it later even when offline.</span>
                </div>
              ) : activeThreadMessagesWithDates.map(({ message, showDateDivider }) => {
                const isMine = message.user_id === user.id;
                const attachments = Array.isArray(message.attachments) ? message.attachments : [];
                return (
                  <React.Fragment key={message.id}>
                    {showDateDivider && (
                      <div className="team-date-divider">
                        <span>{formatTeamDateDivider(message.created_at)}</span>
                      </div>
                    )}
                    <article className={`team-message ${isMine ? 'mine' : ''}`}>
                      <div className="team-message-avatar">
                        {getTeamAvatarUrl(message.user_id) ? <img src={getTeamAvatarUrl(message.user_id)} alt={message.user_name || 'Team member'} /> : (message.user_name || 'U').charAt(0)}
                      </div>
                      <div className="team-message-bubble">
                        <div className="team-message-meta">
                          <strong>{message.user_name || 'Team member'}</strong>
                          <time>{formatTeamTime(message.created_at)}</time>
                          {(isMine || ['owner', 'admin'].includes(String(user.role))) && (
                            <button type="button" onClick={() => handleDeleteTeamMessage(message.id)} title="Delete message">
                              <i className="fas fa-trash"></i>
                            </button>
                          )}
                        </div>
                        {message.content && renderTeamMessageContent(message.content)}
                        {attachments.length > 0 && attachments.map((file: any) => {
                          const isImage = file.mime_type?.startsWith('image/');
                          return (
                            <a className={`team-file-card ${isImage ? 'image' : ''}`} key={file.id} href={file.download_url} target="_blank" rel="noreferrer" download>
                              {isImage ? <img src={file.download_url} alt={file.name || 'Shared image'} /> : <span><i className={`fas ${file.mime_type?.includes('zip') ? 'fa-file-zipper' : file.mime_type?.includes('video') ? 'fa-file-video' : 'fa-file-lines'}`}></i></span>}
                              <div>
                                <strong>{file.name || 'Shared file'}</strong>
                                <small>{file.size ? `${Math.ceil(file.size / 1024)} KB` : 'Download file'} - {file.mime_type || 'file'}</small>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </article>
                  </React.Fragment>
                );
              })}
              <div ref={teamEndRef} />
            </div>
          ) : teamChatSubTab === 'files' ? (
            <div className="team-files-panel">
              {activeThreadFiles.length > 0 ? activeThreadFiles.map(({ message, file }) => (
                <a key={`${message.id}-${file.id}`} className={file.mime_type?.startsWith('image/') ? 'image' : ''} href={file.download_url} target="_blank" rel="noreferrer" download>
                  {file.mime_type?.startsWith('image/') ? <img src={file.download_url} alt={file.name || 'Shared image'} /> : <i className={`fas ${file.mime_type?.includes('zip') ? 'fa-file-zipper' : file.mime_type?.includes('video') ? 'fa-file-video' : 'fa-file-lines'}`}></i>}
                  <span>
                    <strong>{file.name || 'Shared file'}</strong>
                    <small>{message.user_name || 'Team'} - {formatTeamDateDivider(message.created_at)} {formatTeamTime(message.created_at)}</small>
                  </span>
                </a>
              )) : (
                <div className="team-empty">
                  <i className="fas fa-folder-open"></i>
                  <strong>No files shared here yet</strong>
                  <span>Attach files from the composer and they will stay available in this tab.</span>
                </div>
              )}
            </div>
          ) : null}

          <form
            className={`team-composer team-composer--slack team-composer--collapsible ${composerOpen || teamMessageText.trim() || teamFiles.length > 0 ? 'is-open' : 'is-collapsed'}`}
            onSubmit={(e) => {
              handleSendTeamMessage(e);
              // After send, parent clears text; collapse so history fills the pane again.
              window.setTimeout(() => setComposerOpen(false), 0);
            }}
            onBlur={(e) => {
              const next = e.relatedTarget as Node | null;
              if (next && e.currentTarget.contains(next)) return;
              if (!teamMessageText.trim() && teamFiles.length === 0) setComposerOpen(false);
            }}
          >
            {!composerOpen && !teamMessageText.trim() && teamFiles.length === 0 ? (
              <button
                type="button"
                className="team-composer-collapsed"
                onClick={() => setComposerOpen(true)}
                aria-label={`Compose message to ${activeDm.name}`}
              >
                <i className="fas fa-pen"></i>
                <span>Message {activeDm.name}…</span>
                <em>
                  <i className="fas fa-paperclip"></i>
                  <i className="fas fa-paper-plane"></i>
                </em>
              </button>
            ) : (
              <div className="team-composer-box">
                <div className="team-composer-open-head">
                  <strong>Compose</strong>
                  <button
                    type="button"
                    className="team-composer-collapse-btn"
                    title="Minimize composer"
                    onClick={() => setComposerOpen(false)}
                  >
                    <i className="fas fa-chevron-down"></i>
                    Minimize
                  </button>
                </div>
                <div className="team-format-row" aria-label="Message formatting">
                  <button type="button" title="Bold selected text" onClick={() => formatTeamDraft('bold')}>B</button>
                  <button type="button" title="Italic selected text" onClick={() => formatTeamDraft('italic')}>I</button>
                  <button type="button" title="Underline selected text" onClick={() => formatTeamDraft('underline')}>U</button>
                  <button type="button" title="Strikethrough selected text" onClick={() => formatTeamDraft('strike')}>S</button>
                  <span></span>
                  <button type="button" title="Add link" onClick={() => formatTeamDraft('link')}><i className="fas fa-link"></i></button>
                  <button type="button" title="Numbered list" onClick={() => formatTeamDraft('ol')}><i className="fas fa-list-ol"></i></button>
                  <button type="button" title="Bullet list" onClick={() => formatTeamDraft('ul')}><i className="fas fa-list-ul"></i></button>
                  <button type="button" title="Inline code" onClick={() => formatTeamDraft('code')}><i className="fas fa-code"></i></button>
                </div>
                <textarea
                  ref={teamTextareaRef}
                  value={teamMessageText}
                  onChange={e => {
                    setTeamMessageText(e.target.value);
                    if (!composerOpen) setComposerOpen(true);
                  }}
                  onFocus={() => setComposerOpen(true)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setComposerOpen(false);
                      (e.currentTarget as HTMLTextAreaElement).blur();
                      return;
                    }
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={`Message ${activeDm.name}`}
                  rows={2}
                />
                <div className="team-share-row">
                  <div className="team-composer-actions">
                    <label className="team-file-picker" title="Attach files" style={{ cursor: 'pointer' }}>
                      <i className="fas fa-plus"></i>
                      <input type="file" multiple style={{ display: 'none' }} onChange={e => { addTeamFiles(e.target.files || []); setComposerOpen(true); e.currentTarget.value = ''; }} />
                    </label>
                    <button type="button" title="Mention this conversation" onClick={() => formatTeamDraft('mention')}><i className="fas fa-at"></i></button>
                    <button type="button" title="Start a team call" onClick={startTeamCall} disabled={teamPosting}>
                      <i className="fas fa-phone"></i>
                    </button>
                  </div>
                  <button className="team-send-button" type="submit" disabled={teamPosting || (!teamMessageText.trim() && teamFiles.length === 0)}>
                    <i className={`fas ${teamPosting ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                    <span>{teamPosting ? 'Sending' : 'Send'}</span>
                  </button>
                </div>
              </div>
            )}
            {teamFiles.length > 0 && (
              <div className="team-selected-files">
                {teamFiles.map((file, index) => (
                  <span key={`${file.name}-${file.size}-${index}`}>
                    <i className={`fas ${file.type.startsWith('image/') ? 'fa-file-image' : file.type.includes('pdf') ? 'fa-file-pdf' : 'fa-file'}`}></i>
                    <strong>{file.name}</strong>
                    <small>{formatFileSize(file.size)}</small>
                    <button type="button" onClick={() => setTeamFiles(files => files.filter((_, fileIndex) => fileIndex !== index))} title="Remove file">
                      <i className="fas fa-xmark"></i>
                    </button>
                  </span>
                ))}
                <button type="button" className="team-clear-files" onClick={() => setTeamFiles([])}>Clear files</button>
              </div>
            )}
          </form>
        </section>
      </div>
    );
  }

  // legacy mode
  return (
    <div className="team-hub">
      <section className="team-hub-main">
        <div className="team-hub-header">
          <div>
            <span>Internal workspace</span>
            <h3>Team Chat</h3>
          </div>
          <button type="button" onClick={fetchTeamMessages}>
            <i className="fas fa-arrows-rotate"></i>
            Refresh
          </button>
        </div>

        <div className="team-message-stream">
          {teamMessages.length === 0 ? (
            <div className="team-empty">
              <i className="fas fa-comments"></i>
              <strong>No team messages yet</strong>
              <span>Start a quick internal thread or attach files for the CRM team.</span>
            </div>
          ) : teamMessages.map(message => {
            const isMine = message.user_id === user.id;
            const attachments = Array.isArray(message.attachments) ? message.attachments : [];
            return (
              <article key={message.id} className={`team-message ${isMine ? 'mine' : ''}`}>
                <div className="team-message-avatar">{isMine && profilePicture ? <img src={profilePicture} alt={message.user_name || 'Team member'} /> : (message.user_name || 'U').charAt(0)}</div>
                <div className="team-message-bubble">
                  <div className="team-message-meta">
                    <strong>{message.user_name || 'Team member'}</strong>
                    <span>{(message.recipient_names || []).length ? `to ${(message.recipient_names || []).join(', ')}` : 'to Everyone'}</span>
                    <time>{message.created_at ? new Date(message.created_at).toLocaleString() : ''}</time>
                    {(isMine || user.role === 'admin') && (
                      <button type="button" onClick={() => handleDeleteTeamMessage(message.id)} title="Delete message">
                        <i className="fas fa-trash"></i>
                      </button>
                    )}
                  </div>
                  {message.content && renderTeamMessageContent(message.content)}
                  {attachments.length > 0 && attachments.map(file => {
                    const isImage = String(file.mime_type || '').startsWith('image/');
                    return (
                      <a className="team-file-card" key={file.id} href={file.download_url} target="_blank" rel="noreferrer" download>
                        <span><i className={`fas ${isImage ? 'fa-image' : file.mime_type?.includes('zip') ? 'fa-file-zipper' : file.mime_type?.includes('video') ? 'fa-file-video' : 'fa-file-lines'}`}></i></span>
                        <div>
                          <strong>{file.name || 'Shared file'}</strong>
                          <small>{file.size ? `${Math.ceil(file.size / 1024)} KB` : 'Download file'} - {file.mime_type || 'file'}</small>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>

        <form className="team-composer" onSubmit={handleSendTeamMessage}>
          <div className="team-recipient-row">
            <label>
              <span>To</span>
              <select value={teamRecipientId} onChange={e => setTeamRecipientId(e.target.value)}>
                <option value="all">Everyone on staff</option>
                {usersList.map(staff => (
                  <option key={staff.id} value={staff.id}>{staff.name} ({staff.role})</option>
                ))}
              </select>
            </label>
          </div>
          <textarea
            value={teamMessageText}
            onChange={e => setTeamMessageText(e.target.value)}
            placeholder="Message the team..."
          />
          <div className="team-share-row">
            <label className="team-file-picker" style={{ cursor: 'pointer' }}>
              <i className="fas fa-paperclip"></i>
              <span>{teamFiles.length ? `${teamFiles.length} file${teamFiles.length === 1 ? '' : 's'} selected` : 'Attach files'}</span>
              <input
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={e => setTeamFiles(Array.from(e.target.files || []))}
              />
            </label>
            <button type="submit" disabled={teamPosting || (!teamMessageText.trim() && teamFiles.length === 0)}>
              <i className={`fas ${teamPosting ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
              {teamPosting ? 'Sending' : 'Send'}
            </button>
          </div>
          {teamFiles.length > 0 && (
            <div className="team-selected-files">
              {teamFiles.map((file, idx) => (
                <span key={`${file.name}-${file.size}-${idx}`}>
                  <i className="fas fa-file"></i>
                  {file.name}
                  <button type="button" onClick={() => setTeamFiles(files => files.filter(f => f !== file))}>
                    <i className="fas fa-xmark"></i>
                  </button>
                </span>
              ))}
            </div>
          )}
        </form>
      </section>

      <aside className="team-sharepoint">
        <div>
          <span>Organization Share Point</span>
          <strong>{teamMessages.reduce((total, message) => total + (message.attachments?.length || 0), 0)} shared files</strong>
        </div>
        <div className="team-file-list">
          {teamMessages.flatMap(message => (message.attachments || []).map(file => ({ message, file }))).slice().reverse().slice(0, 12).map(({ message, file }) => (
            <a key={`${message.id}-${file.id}`} href={file.download_url} target="_blank" rel="noreferrer" download>
              <i className={`fas ${file.mime_type?.startsWith('image/') ? 'fa-image' : file.mime_type?.includes('zip') ? 'fa-file-zipper' : file.mime_type?.includes('video') ? 'fa-file-video' : 'fa-file-lines'}`}></i>
              <span>
                <strong>{file.name || 'Shared file'}</strong>
                <small>{message.user_name || 'Team'} - {message.created_at ? new Date(message.created_at).toLocaleDateString() : ''}</small>
              </span>
            </a>
          ))}
          {teamMessages.reduce((total, message) => total + (message.attachments?.length || 0), 0) === 0 && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No files shared yet.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
