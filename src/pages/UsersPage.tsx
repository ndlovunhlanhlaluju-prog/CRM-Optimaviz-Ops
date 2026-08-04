import React from 'react';
import { User, Brand } from '../types';
import { BrandWorkspaceProfile, BRAND_COLOR_PRESETS } from '../config/crmConfig';

type ManagedBrand = Brand & {
  archived?: boolean;
  target_audience?: string;
  audience_keywords?: string[];
  cross_sell_notes?: string;
  market_scope?: 'global' | 'country_specific' | string;
  market_countries?: string[];
  description?: string;
};

interface UsersPageProps {
  handleSelectDashboard: () => void;
  setAddUserIsOpen: (v: boolean) => void;
  usersList: User[];
  /** Current signed-in user — used to gate admin create/delete to superadmin. */
  currentUser?: User | null;
  selectedUserManagementId: string;
  setSelectedUserManagementId: (id: string) => void;
  activeBrands: Brand[];
  handleUpdateUserBrands: (targetUser: User, allowedBrandIds: string[]) => Promise<void>;
  setPwdUser: (user: User | null) => void;
  setNewPwdField: (v: string) => void;
  setShowAdminPwd: (v: boolean) => void;
  confirmDeleteUserId: string | null;
  setConfirmDeleteUserId: (id: string | null) => void;
  handleDeleteUser: (userId: string) => Promise<void>;
  newBrandSetupMode: 'starter' | 'duplicate';
  setNewBrandSetupMode: (mode: 'starter' | 'duplicate') => void;
  newBrandSourceBrandId: string;
  setNewBrandSourceBrandId: (id: string) => void;
  newBrandName: string;
  setNewBrandName: (name: string) => void;
  newBrandLogo: string;
  newBrandLogoFileName: string;
  handleNewBrandLogoUpload: (file?: File) => void;
  newBrandColor: string;
  setNewBrandColor: (color: string) => void;
  newBrandDescription: string;
  setNewBrandDescription: (desc: string) => void;
  newBrandTargetAudience: string;
  setNewBrandTargetAudience: (audience: string) => void;
  newBrandAudienceKeywords: string;
  setNewBrandAudienceKeywords: (keywords: string) => void;
  newBrandCrossSellNotes: string;
  setNewBrandCrossSellNotes: (notes: string) => void;
  newBrandMarketScope: 'global' | 'country_specific';
  setNewBrandMarketScope: (scope: 'global' | 'country_specific') => void;
  newBrandMarketCountries: string;
  setNewBrandMarketCountries: (countries: string) => void;
  newBrandSegments: string;
  setNewBrandSegments: (segments: string) => void;
  newBrandStages: string;
  setNewBrandStages: (stages: string) => void;
  handleAddBrand: () => void;
  filteredManagedBrands: ManagedBrand[];
  managedBrands: ManagedBrand[];
  brandLibrarySearch: string;
  setBrandLibrarySearch: (search: string) => void;
  brandLibraryStatus: 'all' | 'active' | 'archived';
  setBrandLibraryStatus: (status: 'all' | 'active' | 'archived') => void;
  expandedBrandProfileId: string;
  setExpandedBrandProfileId: (id: string) => void;
  handleRestoreBrand: (brandId: string) => void;
  handleArchiveBrand: (brandId: string) => void;
  handleDeleteManagedBrand: (brandId: string) => void;
  updateManagedBrandProfile: (brandId: string, patch: Partial<ManagedBrand>) => void;
  brandMarketCountryDrafts: Record<string, string>;
  setBrandMarketCountryDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saveBrandIntelligenceProfile: (brandId: string) => Promise<void>;
  parseLineList: (value: string, fallback: string[]) => string[];
  workflowDesignerBrandId: string;
  syncWorkflowDesignerDrafts: (brandId: string) => void;
  getBrandSegmentOptions: (brandId?: string) => { label: string; value: string; color?: string; icon?: string }[];
  slugifyValue: (value: string) => string;
  getSegmentStagesForBrand: (brandId: string, segmentValue: string) => string[];
  workflowSegmentStageDrafts: Record<string, string>;
  setWorkflowSegmentStageDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  workflowFollowUpDrafts: Record<string, string>;
  setWorkflowFollowUpDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  getFollowUpPlaybookForSegment: (brandId: string, segmentValue: string) => string[];
  workflowPreviewCollapsed: Record<string, boolean>;
  setWorkflowPreviewCollapsed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  getStageColor: (stage?: string) => string;
  handleSaveWorkflowDesigner: () => void;
  handleDownloadBrandImportTemplate: (brand: Brand) => void;
  workspaceProfileBrandId: string;
  setWorkspaceProfileBrandId: (id: string) => void;
  getBrandWorkspaceProfiles: (brandId: string) => BrandWorkspaceProfile[];
  selectedWorkspaceProfileId: string;
  setSelectedWorkspaceProfileId: (id: string) => void;
  workspaceProfileName: string;
  setWorkspaceProfileName: (name: string) => void;
  saveBrandWorkspaceProfile: (brand: Brand) => void;
  applyBrandWorkspaceProfile: (brand: Brand, profileId: string) => void;
  duplicateBrandWorkspaceProfile: (brand: Brand, profileId: string) => void;
  setDefaultBrandWorkspaceProfile: (brand: Brand, profileId: string) => void;
  deleteBrandWorkspaceProfile: (brand: Brand, profileId: string) => void;
  workflowSegmentsDraft: string;
  setWorkflowSegmentsDraft: (segments: string) => void;
  workflowStagesDraft: string;
  setWorkflowStagesDraft: (stages: string) => void;
}

export default function UsersPage({
  handleSelectDashboard,
  setAddUserIsOpen,
  usersList,
  currentUser,
  selectedUserManagementId,
  setSelectedUserManagementId,
  activeBrands,
  handleUpdateUserBrands,
  setPwdUser,
  setNewPwdField,
  setShowAdminPwd,
  confirmDeleteUserId,
  setConfirmDeleteUserId,
  handleDeleteUser,
  newBrandSetupMode,
  setNewBrandSetupMode,
  newBrandSourceBrandId,
  setNewBrandSourceBrandId,
  newBrandName,
  setNewBrandName,
  newBrandLogo,
  newBrandLogoFileName,
  handleNewBrandLogoUpload,
  newBrandColor,
  setNewBrandColor,
  newBrandDescription,
  setNewBrandDescription,
  newBrandTargetAudience,
  setNewBrandTargetAudience,
  newBrandAudienceKeywords,
  setNewBrandAudienceKeywords,
  newBrandCrossSellNotes,
  setNewBrandCrossSellNotes,
  newBrandMarketScope,
  setNewBrandMarketScope,
  newBrandMarketCountries,
  setNewBrandMarketCountries,
  newBrandSegments,
  setNewBrandSegments,
  newBrandStages,
  setNewBrandStages,
  handleAddBrand,
  filteredManagedBrands,
  managedBrands,
  brandLibrarySearch,
  setBrandLibrarySearch,
  brandLibraryStatus,
  setBrandLibraryStatus,
  expandedBrandProfileId,
  setExpandedBrandProfileId,
  handleRestoreBrand,
  handleArchiveBrand,
  handleDeleteManagedBrand,
  updateManagedBrandProfile,
  brandMarketCountryDrafts,
  setBrandMarketCountryDrafts,
  saveBrandIntelligenceProfile,
  parseLineList,
  workflowDesignerBrandId,
  syncWorkflowDesignerDrafts,
  getBrandSegmentOptions,
  slugifyValue,
  getSegmentStagesForBrand,
  workflowSegmentStageDrafts,
  setWorkflowSegmentStageDrafts,
  workflowFollowUpDrafts,
  setWorkflowFollowUpDrafts,
  getFollowUpPlaybookForSegment,
  workflowPreviewCollapsed,
  setWorkflowPreviewCollapsed,
  getStageColor,
  handleSaveWorkflowDesigner,
  handleDownloadBrandImportTemplate,
  workspaceProfileBrandId,
  setWorkspaceProfileBrandId,
  getBrandWorkspaceProfiles,
  selectedWorkspaceProfileId,
  setSelectedWorkspaceProfileId,
  workspaceProfileName,
  setWorkspaceProfileName,
  saveBrandWorkspaceProfile,
  applyBrandWorkspaceProfile,
  duplicateBrandWorkspaceProfile,
  setDefaultBrandWorkspaceProfile,
  deleteBrandWorkspaceProfile,
  workflowSegmentsDraft,
  setWorkflowSegmentsDraft,
  workflowStagesDraft,
  setWorkflowStagesDraft,
}: UsersPageProps) {
  const selectedStaff = usersList.find(u => u.id === selectedUserManagementId) || usersList[0];
  const selectedAllowedBrands = Array.isArray(selectedStaff?.allowed_brand_ids) ? selectedStaff.allowed_brand_ids : [];
  const selectedHasAllBrands = Boolean(selectedStaff?.role === 'admin') || selectedAllowedBrands.length === 0;
  const selectedBrandLabel = selectedHasAllBrands ? 'All brands' : `${selectedAllowedBrands.length} selected`;
  const adminCount = usersList.filter(u => u.role === 'admin').length;
  const staffCount = usersList.filter(u => u.role !== 'admin').length;
  const activeCount = usersList.filter(u => u.presence_status && u.presence_status !== 'offline').length;
  const isSuperAdmin = ['superadmin', 'owner'].includes(String(currentUser?.platform_role || '').toLowerCase())
    || String(currentUser?.email || '').toLowerCase() === 'superadmin@optimaviz.com';
  const canManageSelectedAdmin = Boolean(selectedStaff)
    && (selectedStaff!.role !== 'admin' || isSuperAdmin)
    && selectedStaff!.id !== currentUser?.id;
  const canResetSelectedPassword = Boolean(selectedStaff)
    && (selectedStaff!.role !== 'admin' || isSuperAdmin || selectedStaff!.id === currentUser?.id);

  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={handleSelectDashboard} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '6px', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <i className="fas fa-arrow-left"></i>
            <span>Back to Dashboard</span>
          </button>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Staff users roster directory</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {isSuperAdmin
                ? 'Superadmin can add platform admins and staff, and manage all credentials.'
                : 'Admins can add staff users. Only the superadmin can create or remove platform admins.'}
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setAddUserIsOpen(true)}>
          <i className="fas fa-plus"></i> Add executive user
        </button>
      </div>

      <section className="user-admin-console">
        <div className="user-admin-metrics">
          <div><span>Total users</span><strong>{usersList.length}</strong></div>
          <div><span>Admins</span><strong>{adminCount}</strong></div>
          <div><span>Staff</span><strong>{staffCount}</strong></div>
          <div><span>Active now</span><strong>{activeCount}</strong></div>
        </div>

        <div className="user-admin-workspace">
          <aside className="user-admin-list">
            <div className="user-admin-list__header">
              <strong>Team directory</strong>
              <span>{usersList.length} profiles</span>
            </div>
            {usersList.length === 0 ? (
              <div className="user-admin-empty">No staff users yet.</div>
            ) : (
              <div className="user-admin-list__body">
                {usersList.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    className={`user-admin-row ${selectedStaff?.id === u.id ? 'active' : ''}`}
                    onClick={() => setSelectedUserManagementId(u.id)}
                  >
                    <span className="user-admin-avatar">{(u.name || u.email || '?').charAt(0).toUpperCase()}</span>
                    <span>
                      <strong>{u.name}</strong>
                      <small>{u.email}</small>
                    </span>
                    <em className={u.role === 'admin' ? 'admin' : ''}>{u.role === 'admin' ? 'Admin' : 'Staff'}</em>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <main className="user-admin-detail">
            {selectedStaff ? (
              <>
                <div className="user-admin-detail__top">
                  <span className="user-admin-avatar user-admin-avatar--large">{(selectedStaff.name || selectedStaff.email || '?').charAt(0).toUpperCase()}</span>
                  <div>
                    <span className={`pill ${selectedStaff.role === 'admin' ? 'pill-purple' : 'pill-green'}`}>{selectedStaff.role === 'admin' ? 'Platform Admin' : 'Standard Staff'}</span>
                    <h3>{selectedStaff.name}</h3>
                    <p>{selectedStaff.email}</p>
                  </div>
                </div>

                <div className="user-admin-detail__grid">
                  <div><span>Created</span><strong>{new Date(selectedStaff.created_at).toLocaleDateString()}</strong></div>
                  <div><span>Status</span><strong>{selectedStaff.presence_status || 'Not reported'}</strong></div>
                  <div><span>Security</span><strong>{selectedStaff.role === 'admin' ? 'Full admin access' : 'Operational access'}</strong></div>
                  <div><span>Brand scope</span><strong>{selectedBrandLabel}</strong></div>
                </div>

                <div className="user-brand-access-panel">
                  <div>
                    <strong>Brand access</strong>
                    <p>Control which brands this user can open, edit, and receive leads from. Admin users always keep access to all brands.</p>
                  </div>
                  {selectedStaff.role === 'admin' ? (
                    <div className="user-brand-access-all"><i className="fas fa-shield-alt"></i> Admins have all-brand access.</div>
                  ) : (
                    <div className="user-brand-access-list">
                      {activeBrands.length === 0 ? (
                        <p className="user-admin-empty">Create a brand first, then assign staff access here.</p>
                      ) : (
                        activeBrands.map(brand => {
                          const checked = selectedAllowedBrands.length === 0 || selectedAllowedBrands.includes(brand.id);
                          return (
                            <label key={brand.id} className="user-brand-access-option">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const current = selectedAllowedBrands.length === 0 ? activeBrands.map(item => item.id) : selectedAllowedBrands;
                                  const next = checked ? current.filter(id => id !== brand.id) : [...current, brand.id];
                                  handleUpdateUserBrands(selectedStaff, next);
                                }}
                              />
                              <span style={{ background: brand.color || '#0f766e' }} />
                              <strong>{brand.name}</strong>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                <div className="user-admin-actions">
                  {canResetSelectedPassword ? (
                    <button className="btn btn-ghost" onClick={() => {
                      setPwdUser(selectedStaff);
                      setNewPwdField('');
                      setShowAdminPwd(false);
                    }}>
                      <i className="fas fa-key"></i> Reset password
                    </button>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Only superadmin can reset platform admin passwords.
                    </span>
                  )}
                  {canManageSelectedAdmin ? (
                    confirmDeleteUserId === selectedStaff.id ? (
                      <>
                        <button className="btn btn-sm" onClick={() => { handleDeleteUser(selectedStaff.id); setConfirmDeleteUserId(null); }} style={{ background: '#ef4444', color: '#fff', border: 'none' }}>Confirm remove</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteUserId(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="btn btn-ghost" onClick={() => setConfirmDeleteUserId(selectedStaff.id)} style={{ color: '#ef4444' }}>
                        <i className="fas fa-trash"></i> Remove user
                      </button>
                    )
                  ) : selectedStaff.id === currentUser?.id ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>You cannot remove your own account.</span>
                  ) : selectedStaff.role === 'admin' && !isSuperAdmin ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Only superadmin can remove platform admins.</span>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="user-admin-empty">Select a staff profile to manage access.</div>
            )}
          </main>
        </div>
      </section>

      <div style={{ marginTop: '28px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Brand Management</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '6px 0 0' }}>Add, archive, restore, or remove brands as the business changes. Archiving hides a brand from the sidebar but keeps existing lead records.</p>
          </div>
        </div>
        <div className="brand-create-panel brand-create-panel--compact">
          <div className="brand-create-setup">
            <span>Setup style</span>
            <div className="brand-create-mode">
              <button type="button" className={newBrandSetupMode === 'starter' ? 'active' : ''} onClick={() => setNewBrandSetupMode('starter')}>
                <i className="fas fa-sparkles"></i> Starter setup
              </button>
              <button type="button" className={newBrandSetupMode === 'duplicate' ? 'active' : ''} onClick={() => setNewBrandSetupMode('duplicate')}>
                <i className="fas fa-copy"></i> Duplicate brand
              </button>
            </div>
            {newBrandSetupMode === 'duplicate' ? (
              <label>
                Copy from
                <select className="brand-aware-select" value={newBrandSourceBrandId} onChange={e => setNewBrandSourceBrandId(e.target.value)}>
                  {activeBrands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                </select>
              </label>
            ) : (
              <small>Creates a clean brand with editable dashboard cards, lead views, segments, stages, and follow-up defaults.</small>
            )}
          </div>
          <div className="brand-create-field">
            <span>Brand name</span>
            <input value={newBrandName} onChange={e => setNewBrandName(e.target.value)} placeholder="New brand name" />
          </div>
          <label className="brand-logo-picker">
            <img src={newBrandLogo || '/logos/optima_crm_logo.png'} alt="Brand logo preview" />
            <span>
              <strong>{newBrandLogoFileName || 'Upload logo'}</strong>
              <small>PNG, JPG, or SVG under 2 MB</small>
            </span>
            <input type="file" accept="image/*" onChange={e => handleNewBrandLogoUpload(e.target.files?.[0])} />
          </label>
          <div className="brand-color-picker">
            <span>Brand color</span>
            <div>
              {BRAND_COLOR_PRESETS.map(color => (
                <button
                  key={color}
                  type="button"
                  className={newBrandColor === color ? 'active' : ''}
                  onClick={() => setNewBrandColor(color)}
                  style={{ background: color }}
                  aria-label={`Use ${color}`}
                />
              ))}
              <label style={{ background: newBrandColor }}>
                <input type="color" value={newBrandColor} onChange={e => setNewBrandColor(e.target.value)} />
              </label>
            </div>
          </div>
          <details className="brand-create-advanced">
            <summary>Brand intelligence profile and defaults</summary>
            <div>
              <label>
                <span>Brand description</span>
                <textarea value={newBrandDescription} onChange={e => setNewBrandDescription(e.target.value)} rows={3} placeholder="What this brand sells, solves, or manages." />
                <small>Used by Intelligence to understand the brand before recommending cross-brand opportunities.</small>
              </label>
              <label>
                <span>Target audience</span>
                <textarea value={newBrandTargetAudience} onChange={e => setNewBrandTargetAudience(e.target.value)} rows={3} placeholder="Example: mining managers, property owners, SMEs, training buyers." />
                <small>Describe ideal customers, industries, roles, locations, and buying signals.</small>
              </label>
              <label>
                <span>Audience keywords</span>
                <textarea value={newBrandAudienceKeywords} onChange={e => setNewBrandAudienceKeywords(e.target.value)} rows={3} placeholder={'mining manager\nproperty owner\noperations dashboard'} />
                <small>One keyword or phrase per line. These power automatic portfolio recommendations.</small>
              </label>
              <label>
                <span>Recommended offer</span>
                <textarea value={newBrandCrossSellNotes} onChange={e => setNewBrandCrossSellNotes(e.target.value)} rows={2} placeholder="Example: Offer an Optimaviz performance dashboard consultation." />
              </label>
              <label>
                <span>Market scope</span>
                <select className="brand-aware-select" value={newBrandMarketScope} onChange={e => setNewBrandMarketScope(e.target.value as 'global' | 'country_specific')}>
                  <option value="global">Global / can serve any country</option>
                  <option value="country_specific">Country specific</option>
                </select>
                <small>Use country specific for brands such as property, local services, or anything limited by location.</small>
              </label>
              {newBrandMarketScope === 'country_specific' && (
                <label>
                  <span>Countries served</span>
                  <textarea value={newBrandMarketCountries} onChange={e => setNewBrandMarketCountries(e.target.value)} rows={2} placeholder="Zimbabwe, South Africa" />
                  <small>Add one or more countries separated by commas. Portfolio recommendations skip leads outside these countries.</small>
                </label>
              )}
              {newBrandSetupMode === 'duplicate' && <p className="brand-create-copy-note">Duplicate mode copies the selected brand's dashboard cards, stages, saved views, and follow-up setup. These fields are only used for starter setup.</p>}
              <label>
                <span>Default segments</span>
                <textarea value={newBrandSegments} onChange={e => setNewBrandSegments(e.target.value)} rows={4} placeholder={'New Enquiries\nFollow-Up Leads\nActive Customers'} />
                <small>One segment per line. These become dashboard cards and lead filters.</small>
              </label>
              <label>
                <span>Default pipeline stages</span>
                <textarea value={newBrandStages} onChange={e => setNewBrandStages(e.target.value)} rows={4} placeholder={'New Lead\nContacted\nFollow-Up Due\nProposal Sent\nWon\nLost'} />
                <small>One stage per line. Admins can later refine the process as the brand grows.</small>
              </label>
            </div>
          </details>
          <div className="brand-create-submit">
            <button className="btn btn-primary" onClick={handleAddBrand}><i className="fas fa-plus"></i> Add Brand</button>
          </div>
        </div>
        <section className="brand-library-panel">
          <div className="brand-library-panel__head">
            <div>
              <span>Brand library</span>
              <strong>{filteredManagedBrands.length} shown · {activeBrands.length} active · {managedBrands.filter(brand => brand.archived).length} archived</strong>
            </div>
            <div className="brand-library-controls">
              <label>
                <i className="fas fa-search"></i>
                <input value={brandLibrarySearch} onChange={e => setBrandLibrarySearch(e.target.value)} placeholder="Search brands, audience, country..." />
              </label>
              <select className="brand-aware-select" value={brandLibraryStatus} onChange={e => setBrandLibraryStatus(e.target.value as 'all' | 'active' | 'archived')}>
                <option value="all">All brands</option>
                <option value="active">Active only</option>
                <option value="archived">Archived only</option>
              </select>
            </div>
          </div>
          <div className="brand-management-grid">
          {filteredManagedBrands.map(b => {
            const profileOpen = expandedBrandProfileId === b.id;
            return (
            <article key={b.id} className={`brand-management-card ${profileOpen ? 'brand-management-card--expanded' : ''} ${b.archived ? 'archived' : ''}`}>
              <div className="brand-management-card__main">
                <img src={b.logo} alt={`${b.name} logo`} />
                <div>
                  <strong>{b.name}</strong>
                  <span style={{ color: b.color }}>{b.color}</span>
                </div>
                <em className={b.archived ? 'archived' : ''}>{b.archived ? 'Archived' : 'Active'}</em>
              </div>
              <div className="brand-management-card__actions">
                {b.archived ? <button className="btn btn-ghost btn-sm" onClick={() => handleRestoreBrand(b.id)}>Restore</button> : <button className="btn btn-ghost btn-sm" onClick={() => handleArchiveBrand(b.id)}>Archive</button>}
                <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteManagedBrand(b.id)} style={{ color: '#ef4444' }}>Delete</button>
                <button className="btn btn-ghost btn-sm brand-profile-toggle" onClick={() => setExpandedBrandProfileId(profileOpen ? '' : b.id)}>
                  <i className={`fas ${profileOpen ? 'fa-chevron-up' : 'fa-sliders'}`}></i> {profileOpen ? 'Close profile' : 'Intelligence profile'}
                </button>
              </div>
              {profileOpen && (
              <div className="brand-intelligence-profile">
                <div className="brand-intelligence-profile__head">
                  <div>
                    <strong>{b.name} intelligence profile</strong>
                    <small>Set the target audience, countries, and offer rules used by portfolio recommendations.</small>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpandedBrandProfileId('')}>Close</button>
                </div>
                <div className="brand-intelligence-profile__grid">
                <label>
                  <span>Description</span>
                  <textarea
                    rows={3}
                    value={String(b.description || '')}
                    onChange={e => updateManagedBrandProfile(b.id, { description: e.target.value })}
                    placeholder="What this brand does and what problem it solves."
                  />
                </label>
                <label>
                  <span>Target audience</span>
                  <textarea
                    rows={3}
                    value={String(b.target_audience || '')}
                    onChange={e => updateManagedBrandProfile(b.id, { target_audience: e.target.value })}
                    placeholder="Ideal customers, industries, job titles, locations, or buying signals."
                  />
                </label>
                <label>
                  <span>Audience keywords</span>
                  <textarea
                    rows={3}
                    value={Array.isArray(b.audience_keywords) ? b.audience_keywords.join('\n') : String(b.audience_keywords || '')}
                    onChange={e => updateManagedBrandProfile(b.id, { audience_keywords: parseLineList(e.target.value, []) })}
                    placeholder={'mining manager\nproperty owner\noperations dashboard'}
                  />
                </label>
                <label>
                  <span>Recommended offer</span>
                  <textarea
                    rows={2}
                    value={String(b.cross_sell_notes || '')}
                    onChange={e => updateManagedBrandProfile(b.id, { cross_sell_notes: e.target.value })}
                    placeholder="What should the team offer when this brand is recommended?"
                  />
                </label>
                <label>
                  <span>Market scope</span>
                  <select
                    className="brand-aware-select"
                    value={b.market_scope === 'country_specific' ? 'country_specific' : 'global'}
                    onChange={e => updateManagedBrandProfile(b.id, { market_scope: e.target.value })}
                  >
                    <option value="global">Global / can serve any country</option>
                    <option value="country_specific">Country specific</option>
                  </select>
                </label>
                {b.market_scope === 'country_specific' && (
                  <label>
                    <span>Countries served</span>
                    <textarea
                      rows={2}
                      value={brandMarketCountryDrafts[b.id] ?? (Array.isArray(b.market_countries) ? b.market_countries.join(', ') : String(b.market_countries || ''))}
                      onChange={e => {
                        const value = e.target.value;
                        setBrandMarketCountryDrafts(prev => ({ ...prev, [b.id]: value }));
                        updateManagedBrandProfile(b.id, { market_countries: parseLineList(value, []) });
                      }}
                      placeholder="Zimbabwe, South Africa"
                    />
                    <small>Add one or more countries separated by commas. Country-specific brands only receive recommendations when the lead country matches.</small>
                  </label>
                )}
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => saveBrandIntelligenceProfile(b.id)}>
                  <i className="fas fa-save"></i> Save profile
                </button>
              </div>
              )}
            </article>
            );
          })}
          {filteredManagedBrands.length === 0 && (
            <div className="brand-library-empty">No brands match this search or filter.</div>
          )}
          </div>
        </section>

        <section className="compact-workflow-builder" style={{ marginTop: '18px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '16px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div>
              <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.6px' }}>Universal Brand Dashboard Builder</span>
              <h3 style={{ margin: '4px 0 4px', fontSize: '16px', fontWeight: 900 }}>Segments, stages, snapshots, and import template defaults</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>Edit the segments and stage names for the selected brand. The preview updates instantly, then Save Workflow Setup applies it to dashboards, filters, and import templates.</p>
            </div>
            <select
              className="brand-aware-select"
              value={workflowDesignerBrandId}
              onChange={e => syncWorkflowDesignerDrafts(e.target.value)}
              style={{ minWidth: '220px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
            >
              {managedBrands.map(brand => <option key={brand.id} value={brand.id}>{brand.archived ? 'Archived - ' : ''}{brand.name}</option>)}
            </select>
          </div>
          <div className="workflow-builder-grid">
            <label className="workflow-builder-field">
              <span style={{ fontSize: '12px', fontWeight: 900, color: 'var(--text-secondary)' }}>Dashboard segments / lead types</span>
              <textarea value={workflowSegmentsDraft} onChange={e => setWorkflowSegmentsDraft(e.target.value)} rows={6} placeholder={'New Enquiries\nFollow-Up Leads\nActive Customers'} style={{ width: '100%', resize: 'vertical', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px' }} />
              <small style={{ color: 'var(--text-muted)' }}>Each line becomes a dashboard segment, filter, and import option.</small>
            </label>
            <label className="workflow-builder-field">
              <span style={{ fontSize: '12px', fontWeight: 900, color: 'var(--text-secondary)' }}>Pipeline stages / Kanban columns</span>
              <textarea value={workflowStagesDraft} onChange={e => setWorkflowStagesDraft(e.target.value)} rows={6} placeholder={'New Lead\nContacted\nFollow-Up Due\nProposal Sent\nWon\nLost'} style={{ width: '100%', resize: 'vertical', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px' }} />
              <small style={{ color: 'var(--text-muted)' }}>Each line becomes a pipeline step and Kanban column.</small>
            </label>
            <div className="workflow-builder-preview">
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '8px' }}>Live workflow preview</strong>
                <p className="workflow-preview-note">Each card can have its own stages and follow-up playbook. Edit a card when one segment needs a different journey, then save the setup.</p>
                <div className="workflow-segment-preview">
                  {(() => {
                    const existingSegments = getBrandSegmentOptions(workflowDesignerBrandId);
                    return parseLineList(workflowSegmentsDraft, ['Main Pipeline']).slice(0, 6).map(segment => {
                      const existing = existingSegments.find(seg => seg.label.toLowerCase() === segment.toLowerCase() || seg.value === segment);
                      const segmentValue = existing?.value || slugifyValue(segment);
                      const fallbackStages = getSegmentStagesForBrand(workflowDesignerBrandId, segmentValue);
                      const stages = parseLineList(workflowSegmentStageDrafts[segmentValue] || '', fallbackStages);
                      const playbook = workflowFollowUpDrafts[segmentValue] || getFollowUpPlaybookForSegment(workflowDesignerBrandId, segmentValue).join('\n');
                      const previewCollapsed = workflowPreviewCollapsed[segmentValue] ?? true;
                      return (
                        <div key={segmentValue} className={`workflow-preview-card ${previewCollapsed ? 'is-collapsed' : ''}`}>
                          <button
                            type="button"
                            className="workflow-preview-card__toggle"
                            onClick={() => setWorkflowPreviewCollapsed(prev => ({ ...prev, [segmentValue]: !(prev[segmentValue] ?? true) }))}
                            aria-expanded={!previewCollapsed}
                          >
                            <span>{segment}</span>
                            <i className={`fas ${previewCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`}></i>
                          </button>
                          <div className="workflow-preview-pills">
                            {stages.slice(0, 7).map((stage, index, arr) => (
                              <React.Fragment key={`${segmentValue}-${stage}-${index}`}>
                                <em style={{ background: `${getStageColor(stage)}14`, color: getStageColor(stage), borderColor: `${getStageColor(stage)}44` }}>{stage}</em>
                                {index < arr.length - 1 && <i className="fas fa-arrow-right"></i>}
                              </React.Fragment>
                            ))}
                          </div>
                          {!previewCollapsed && (
                            <div className="workflow-preview-card__body">
                              <label className="workflow-card-editor">
                                <strong>Stages for this segment</strong>
                                <textarea
                                  value={workflowSegmentStageDrafts[segmentValue] ?? fallbackStages.join('\n')}
                                  onChange={e => setWorkflowSegmentStageDrafts(prev => ({ ...prev, [segmentValue]: e.target.value }))}
                                  rows={4}
                                />
                              </label>
                              <label className="workflow-card-editor">
                                <strong>Follow-up playbook</strong>
                                <textarea
                                  value={playbook}
                                  onChange={e => setWorkflowFollowUpDrafts(prev => ({ ...prev, [segmentValue]: e.target.value }))}
                                  rows={3}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '8px' }}>Follow-up playbook summary</strong>
                <div className="workflow-followup-summary">
                  {(() => {
                    const existingSegments = getBrandSegmentOptions(workflowDesignerBrandId);
                    return parseLineList(workflowSegmentsDraft, ['Main Pipeline']).slice(0, 6).map(segment => {
                      const existing = existingSegments.find(seg => seg.label.toLowerCase() === segment.toLowerCase() || seg.value === segment);
                      const segmentValue = existing?.value || slugifyValue(segment);
                      const playbook = parseLineList(workflowFollowUpDrafts[segmentValue] || '', getFollowUpPlaybookForSegment(workflowDesignerBrandId, segmentValue));
                      return (
                        <div key={`${segmentValue}-playbook`}>
                          <span>{segment}</span>
                          {playbook.slice(0, 3).map(step => <small key={step}><i className="fas fa-clock"></i>{step}</small>)}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
              <div className="workflow-builder-actions">
                <button type="button" className="btn btn-primary" onClick={handleSaveWorkflowDesigner}>
                  <i className="fas fa-save"></i> Save Workflow Setup
                </button>
                {(() => {
                  const brand = managedBrands.find(b => b.id === workflowDesignerBrandId);
                  return brand ? <button type="button" className="btn btn-ghost" onClick={() => handleDownloadBrandImportTemplate(brand)}><i className="fas fa-file-csv"></i> Download Template</button> : null;
                })()}
              </div>
            </div>
          </div>
        </section>

        {(() => {
          const profileBrand = managedBrands.find(b => b.id === workspaceProfileBrandId) || activeBrands[0] || managedBrands[0];
          if (!profileBrand) return null;
          const profiles = getBrandWorkspaceProfiles(profileBrand.id);
          const selectedProfile = profiles.find(profile => profile.id === selectedWorkspaceProfileId) || profiles.find(profile => profile.isDefault) || profiles[0];
          return (
            <section className="brand-profile-panel brand-profile-panel--management">
              <div className="brand-profile-panel__copy">
                <span>Workspace Profiles</span>
                <h3>{profileBrand.name} saved layouts</h3>
                <p>Save dashboard, column, widget, filter, and Command Center setups. Applying a profile never changes leads, emails, notes, calls, or WhatsApp records.</p>
              </div>
              <div className="brand-profile-panel__controls">
                <select
                  value={profileBrand.id}
                  onChange={e => {
                    setWorkspaceProfileBrandId(e.target.value);
                    setSelectedWorkspaceProfileId('');
                    setWorkspaceProfileName('');
                  }}
                >
                  {managedBrands.map(brand => (
                    <option key={brand.id} value={brand.id}>{brand.archived ? 'Archived - ' : ''}{brand.name}</option>
                  ))}
                </select>
                <input
                  value={workspaceProfileName}
                  onChange={e => setWorkspaceProfileName(e.target.value)}
                  placeholder="Profile name, e.g. Sales view"
                />
                <button type="button" className="btn btn-primary" style={{ background: profileBrand.color, border: 'none' }} onClick={() => saveBrandWorkspaceProfile(profileBrand)}>
                  <i className="fas fa-camera"></i> Save Current
                </button>
                <select value={selectedProfile?.id || ''} onChange={e => setSelectedWorkspaceProfileId(e.target.value)}>
                  <option value="">No saved profile</option>
                  {profiles.map(profile => (
                    <option key={profile.id} value={profile.id}>{profile.isDefault ? 'Default - ' : ''}{profile.name}</option>
                  ))}
                </select>
                <button type="button" className="btn btn-ghost" disabled={!selectedProfile} onClick={() => selectedProfile && applyBrandWorkspaceProfile(profileBrand, selectedProfile.id)}>
                  <i className="fas fa-rotate-left"></i> Apply
                </button>
                <button type="button" className="btn btn-ghost" disabled={!selectedProfile} onClick={() => selectedProfile && duplicateBrandWorkspaceProfile(profileBrand, selectedProfile.id)}>
                  <i className="fas fa-copy"></i> Duplicate
                </button>
                <button type="button" className="btn btn-ghost" disabled={!selectedProfile} onClick={() => selectedProfile && setDefaultBrandWorkspaceProfile(profileBrand, selectedProfile.id)}>
                  <i className="fas fa-star"></i> Set Default
                </button>
                <button type="button" className="btn btn-ghost brand-profile-delete" disabled={!selectedProfile} onClick={() => selectedProfile && deleteBrandWorkspaceProfile(profileBrand, selectedProfile.id)}>
                  <i className="fas fa-trash"></i> Delete
                </button>
              </div>
              <div className="brand-profile-panel__meta">
                {selectedProfile ? (
                  <>
                    <strong>{selectedProfile.name}</strong>
                    <span>Last saved {new Date(selectedProfile.updatedAt).toLocaleString()}</span>
                    {selectedProfile.isDefault && <em>Default</em>}
                  </>
                ) : (
                  <>
                    <strong>No profiles yet</strong>
                    <span>Save the current setup before trying a new layout.</span>
                  </>
                )}
              </div>
            </section>
          );
        })()}
      </div>
    </div>
  );
}
