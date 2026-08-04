import fs from 'fs';

const path = 'src/AppCore.tsx';
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
const start = 8730; // 0-based: line 8731
const end = 9010; // inclusive

const replacement = `                    {/* Merged Brand Snapshot + Lead Intelligence */}
                    {(() => {
                      const getLeadValue = (lead: Lead, keys: string[]) => {
                        for (const key of keys) {
                          const match = getLeadMetricRawValue(lead, key);
                          if (isMeaningfulMetricValue(match.value)) return { key: match.key, value: String(match.value).trim() };
                        }
                        return null;
                      };
                      const segmentLabelByValue = Object.fromEntries(getBrandSegmentOptions(selectedBrand.id).map(seg => [seg.value, seg.label]));
                      const stageLabels = new Set(getBrandStageOptions(selectedBrand.id));
                      const formatBreakdownLabel = (value: string, type: string) => {
                        if (type === 'segment') return segmentLabelByValue[value] || value.replace(/_/g, ' ').replace(/\\b\\w/g, char => char.toUpperCase());
                        if (type === 'stage' && stageLabels.has(value)) return value;
                        return value.replace(/_/g, ' ').replace(/\\b\\w/g, char => char.toUpperCase());
                      };
                      const resolveBreakdownType = (config: { keys: string[]; title?: string; type: string }) => {
                        const keyText = config.keys.join(' ').toLowerCase();
                        const titleText = String(config.title || '').toLowerCase();
                        const isAbnMetric = /\\babn\\b|australian business number/.test(\`\${keyText} \${titleText}\`);
                        if (isAbnMetric && /(missing|blank|without|no abn|not supplied|not filled)/.test(titleText)) return 'field_missing';
                        if (isAbnMetric && /(with|has|valid|verified|supplied|present)/.test(titleText)) return 'field_present';
                        return config.type;
                      };
                      const makeBreakdown = (config: { keys: string[]; title?: string; type: string }) => {
                        const resolvedType = resolveBreakdownType(config);
                        if (resolvedType === 'field_present' || resolvedType === 'field_missing') {
                          const presentPeople = new Set<string>();
                          const missingPeople = new Set<string>();
                          leads.forEach(lead => {
                            const hasValue = config.keys.some(key => isMeaningfulMetricValue(getLeadMetricRawValue(lead, key).value));
                            (hasValue ? presentPeople : missingPeople).add(getLeadIdentityKeyForBrand(lead));
                          });
                          const isPresent = resolvedType === 'field_present';
                          return [{
                            value: isPresent ? '__filled__' : '__missing__',
                            label: isPresent ? 'Records with this value' : 'Missing or blank',
                            count: isPresent ? presentPeople.size : missingPeople.size,
                            field: config.keys[0] || 'custom',
                            kind: resolvedType
                          }];
                        }
                        const counts: Record<string, { label: string; count: number; field: string; people: Set<string> }> = {};
                        leads.forEach(lead => {
                          const match = getLeadValue(lead, config.keys);
                          const value = match?.value || 'Unspecified';
                          const field = match?.key || config.keys[0] || 'custom';
                          const label = formatBreakdownLabel(value, config.type);
                          const existing = counts[value] || { label, count: 0, field, people: new Set<string>() };
                          existing.people.add(getLeadIdentityKeyForBrand(lead));
                          existing.count = existing.people.size;
                          counts[value] = existing;
                        });
                        return Object.entries(counts).sort((a, b) => b[1].count - a[1].count).slice(0, 8).map(([value, item]) => ({ value, label: item.label, count: item.count, field: item.field, kind: resolvedType }));
                      };
                      const uniquePeople = countUniquePeopleForBrand(leads);
                      const followUpsDue = countUniquePeopleForBrand(leads.filter(l => isFollowUpDue(l)));
                      const missingContact = countUniquePeopleForBrand(leads.filter(l => !String(l.email || '').trim() && !String(l.phone || '').trim()));
                      const missingStage = countUniquePeopleForBrand(leads.filter(l => !String(l.funnel_stage || '').trim()));
                      const duplicateRecords = Math.max(0, leads.length - uniquePeople);
                      const intelligenceBreakdowns = brandIntelligenceBreakdowns[selectedBrand.id] || DEFAULT_INTELLIGENCE_BREAKDOWNS;
                      const healthCards = [
                        { id: 'unique', label: 'Unique leads', value: uniquePeople, icon: 'fa-address-book', color: selectedBrand.color, action: undefined as undefined | (() => void) },
                        { id: 'dups', label: 'Duplicates', value: duplicateRecords, icon: 'fa-copy', color: '#155e75', action: undefined as undefined | (() => void) },
                        { id: 'followups', label: 'Follow-ups due', value: followUpsDue, icon: 'fa-clock', color: '#ef4444', action: () => setSelectedStageFilter('Follow-Up Due') },
                        { id: 'cleanup', label: 'Needs cleanup', value: missingContact + missingStage, icon: 'fa-wand-magic-sparkles', color: '#f97316', action: undefined as undefined | (() => void) },
                      ];
                      const snapshotMetricCards = (snapshotCards[selectedBrand.id] || []).filter(c => c.active !== false).map(card => {
                        const current = getSnapshotCardValue(card, leads);
                        return {
                          id: card.id,
                          label: card.label,
                          value: current,
                          icon: card.icon || 'fa-bullseye',
                          color: card.color || selectedBrand.color,
                          target: card.target,
                          unit: card.unit,
                        };
                      });
                      const showHealth = isSectionVisible(selectedBrand.id, 'lead_intelligence', true);
                      if (!showHealth && snapshotMetricCards.length === 0) {
                        return (
                          <div className="brand-intelligence-hidden">
                            <span>Brand insights are hidden for {selectedBrand.name}.</span>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleSection(selectedBrand.id, 'lead_intelligence', true)}>Show section</button>
                          </div>
                        );
                      }
                      const snapshotSource = snapshotForm.fieldKey || 'segment';
                      const segmentOptions = getBrandSegmentOptions(selectedBrand.id).map(seg => ({ label: seg.label, value: seg.value, color: seg.color, icon: seg.icon }));
                      const stageOptions = getBrandStageOptions(selectedBrand.id).map(stage => ({ label: stage, value: stage, color: getStageColor(stage), icon: 'fas fa-table-columns' }));
                      const valueOptions = snapshotSource === 'segment' ? segmentOptions : snapshotSource === 'funnel_stage' ? stageOptions : [];
                      return (
                        <section className="brand-insights-panel">
                          <div className="brand-insights-head">
                            <div>
                              <h3><i className="fas fa-chart-pie" style={{ color: selectedBrand.color }}></i> Brand insights</h3>
                              <p>Pipeline health and snapshot metrics in one place — more room for leads below.</p>
                            </div>
                            <div className="brand-insights-actions">
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIntelligenceBuilderOpen(prev => !prev)}>
                                <i className="fas fa-sliders"></i> {intelligenceBuilderOpen ? 'Done' : 'Customize'}
                              </button>
                              {showHealth && (
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleSection(selectedBrand.id, 'lead_intelligence', true)}>
                                  <i className="fas fa-eye-slash"></i> Hide
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="brand-insights-metrics">
                            {showHealth && healthCards.map(card => (
                              <button key={card.id} type="button" onClick={card.action || (() => undefined)}>
                                <span className="icon" style={{ color: card.color, background: \`\${card.color}18\` }}><i className={\`fas \${card.icon}\`}></i></span>
                                <strong>{card.value}</strong>
                                <small>{card.label}</small>
                              </button>
                            ))}
                            {snapshotMetricCards.map(card => (
                              <div key={card.id} className="brand-insights-metric" title={card.target ? \`Goal: \${card.target} \${card.unit || ''}\` : card.label}>
                                <span className="icon" style={{ color: card.color, background: \`\${card.color}18\` }}><i className={\`fas \${card.icon}\`}></i></span>
                                <strong>{card.value}{card.target ? <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>/{card.target}</span> : null}</strong>
                                <small>{card.label}</small>
                              </div>
                            ))}
                          </div>
                          {intelligenceBuilderOpen && (
                            <div className="brand-insights-customize">
                              <details className="snapshot-editor-panel snapshot-editor-panel--data" open>
                                <summary><i className="fas fa-bullseye"></i> Snapshot metrics <span>Track totals, segments, or stages</span></summary>
                                <div className="snapshot-editor-grid snapshot-editor-grid--data">
                                  <label>
                                    Source
                                    <select value={snapshotSource} onChange={e => setSnapshotForm(prev => ({ ...prev, fieldKey: e.target.value, matchValue: '', label: '' }))}>
                                      <option value="segment">Segment / lead type</option>
                                      <option value="funnel_stage">Pipeline stage</option>
                                      <option value="__total__">Total leads</option>
                                    </select>
                                  </label>
                                  {snapshotSource !== '__total__' && (
                                    <label>
                                      Track
                                      <select value={snapshotForm.matchValue} onChange={e => {
                                        const item = valueOptions.find(opt => opt.value === e.target.value);
                                        setSnapshotForm(prev => ({ ...prev, matchValue: e.target.value, label: prev.label || item?.label || '', color: item?.color || prev.color }));
                                      }}>
                                        <option value="">Choose {snapshotSource === 'segment' ? 'segment' : 'stage'}</option>
                                        {valueOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                      </select>
                                    </label>
                                  )}
                                  <label>
                                    Label
                                    <input value={snapshotForm.label} onChange={e => setSnapshotForm(prev => ({ ...prev, label: e.target.value }))} placeholder="Auto or custom label" />
                                  </label>
                                  <label>
                                    Goal <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>(optional)</span>
                                    <input value={snapshotForm.target} onChange={e => setSnapshotForm(prev => ({ ...prev, target: e.target.value }))} placeholder="Leave blank" />
                                  </label>
                                  <button className="btn btn-primary btn-sm" type="button" onClick={() => handleAddSnapshotCard(selectedBrand.id)}><i className="fas fa-plus"></i> Add metric</button>
                                </div>
                                {(snapshotCards[selectedBrand.id] || []).length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                                    {(snapshotCards[selectedBrand.id] || []).map(card => (
                                      <button key={card.id} type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteSnapshotCard(selectedBrand.id, card.id)} title="Remove snapshot metric">
                                        <i className="fas fa-times" style={{ color: '#ef4444' }}></i> {card.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </details>
                              {showHealth && (
                                <>
                                  <div className="brand-intelligence-builder">
                                    <label>
                                      Breakdown title
                                      <input value={intelligenceForm.title} onChange={e => setIntelligenceForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Contractors by city" />
                                    </label>
                                    <label>
                                      Field keys
                                      <input value={intelligenceForm.keys} onChange={e => setIntelligenceForm(prev => ({ ...prev, keys: e.target.value }))} placeholder="city, source" />
                                    </label>
                                    <label>
                                      Metric type
                                      <select value={intelligenceForm.type} onChange={e => setIntelligenceForm(prev => ({ ...prev, type: e.target.value }))}>
                                        <option value="custom">Breakdown by field value</option>
                                        <option value="field_present">Count: field filled</option>
                                        <option value="field_missing">Count: field missing</option>
                                        <option value="segment">Breakdown by segment</option>
                                        <option value="stage">Breakdown by stage</option>
                                      </select>
                                    </label>
                                    <button type="button" className="btn btn-primary btn-sm" onClick={() => {
                                      const keys = intelligenceForm.keys.split(',').map(key => key.trim()).filter(Boolean);
                                      if (!intelligenceForm.title.trim() || keys.length === 0) { showToast('Add a title and at least one field key.', true); return; }
                                      setBrandIntelligenceBreakdowns(prev => ({
                                        ...prev,
                                        [selectedBrand.id]: editingIntelligenceId
                                          ? (prev[selectedBrand.id] || DEFAULT_INTELLIGENCE_BREAKDOWNS).map(item => item.id === editingIntelligenceId ? { ...item, title: intelligenceForm.title.trim(), keys, type: intelligenceForm.type } : item)
                                          : [
                                              ...(prev[selectedBrand.id] || DEFAULT_INTELLIGENCE_BREAKDOWNS),
                                              { id: \`\${selectedBrand.id}-intel-\${Date.now()}\`, title: intelligenceForm.title.trim(), keys, type: intelligenceForm.type }
                                            ]
                                      }));
                                      setIntelligenceForm({ title: '', keys: 'city', type: 'custom' });
                                      setEditingIntelligenceId('');
                                      showToast(editingIntelligenceId ? 'Breakdown updated.' : 'Breakdown added.');
                                    }}><i className={\`fas \${editingIntelligenceId ? 'fa-save' : 'fa-plus'}\`}></i> {editingIntelligenceId ? 'Save' : 'Add breakdown'}</button>
                                  </div>
                                  <div className="brand-insights-breakdowns">
                                    {intelligenceBreakdowns.map(config => {
                                      const rows = makeBreakdown(config);
                                      return (
                                        <div key={config.id}>
                                          <div className="brand-intelligence-breakdown-head">
                                            <strong>{config.title}</strong>
                                            <span>
                                              <button type="button" title="Edit" onClick={() => {
                                                setEditingIntelligenceId(config.id);
                                                setIntelligenceForm({ title: config.title, keys: config.keys.join(', '), type: config.type });
                                              }}><i className="fas fa-pencil-alt"></i></button>
                                              <button type="button" title="Delete" onClick={() => setBrandIntelligenceBreakdowns(prev => ({ ...prev, [selectedBrand.id]: (prev[selectedBrand.id] || DEFAULT_INTELLIGENCE_BREAKDOWNS).filter(item => item.id !== config.id) }))}><i className="fas fa-times"></i></button>
                                            </span>
                                          </div>
                                          {rows.map(row => (
                                            <button key={\`\${config.id}-\${row.value}\`} type="button" onClick={() => {
                                              if (row.kind === 'segment') setSelectedSegmentFilter(row.value);
                                              else if (row.kind === 'stage') setSelectedStageFilter(row.value);
                                              else if (row.kind === 'field_present') setSelectedCustomFieldFilter({ field: row.field, value: '__filled__' });
                                              else if (row.kind === 'field_missing') setSelectedCustomFieldFilter({ field: row.field, value: '__missing__' });
                                              else setSelectedCustomFieldFilter({ field: row.field, value: row.value });
                                            }}>
                                              <span>{row.label}</span><em>{row.count}</em>
                                            </button>
                                          ))}
                                          {rows.length === 0 && <small>No data yet</small>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </section>
                      );
                    })()}`;

const out = [...lines.slice(0, start), ...replacement.split('\n'), ...lines.slice(end + 1)].join('\n');
fs.writeFileSync(path, out);
console.log('OK replaced', start + 1, '-', end + 1, 'lines; file lines now', out.split('\n').length);
