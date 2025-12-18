import React, { useMemo } from 'react';
import {
  ColumnConfig,
  FieldConfig,
  SectionConfig,
  TemplateConfig,
} from 'src/components/template-editor/field-types';

interface TemplateEditorProps {
  config: TemplateConfig;
  onChange: (config: TemplateConfig) => void;
  onSave: () => void;
  onLoad: () => void;
  onApply: () => void;
  liveUpdate: boolean;
  onToggleLive: (value: boolean) => void;
}

const cloneConfig = (config: TemplateConfig): TemplateConfig =>
  JSON.parse(JSON.stringify(config)) as TemplateConfig;

const sortByOrder = <T extends { order?: number }>(items: T[]): T[] =>
  items.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const TemplateEditor: React.FC<TemplateEditorProps> = ({
  config,
  onChange,
  onSave,
  onLoad,
  onApply,
  liveUpdate,
  onToggleLive,
}) => {
  const sections = useMemo<SectionConfig[]>(() => sortByOrder(config.sections), [config.sections]);
  const columns = useMemo<ColumnConfig[]>(() => sortByOrder(config.columns), [config.columns]);

  const updateConfig = (updater: (next: TemplateConfig) => void) => {
    const next = cloneConfig(config);
    updater(next);
    onChange(next);
  };

  const updateSection = (sectionId: string, updater: (section: SectionConfig) => void) => {
    updateConfig((next) => {
      const section = next.sections.find((item) => item.id === sectionId);
      if (!section) return;
      updater(section);
      section.order = typeof section.order === 'number' ? section.order : 0;
      section.fields = sortByOrder(section.fields).map((field, index) => ({
        ...field,
        order: index,
      }));
      next.sections = sortByOrder(next.sections).map((item, index) => ({
        ...item,
        order: index,
      }));
    });
  };

  const moveSection = (sectionId: string, direction: -1 | 1) => {
    updateConfig((next) => {
      const ordered = sortByOrder(next.sections);
      const index = ordered.findIndex((section) => section.id === sectionId);
      if (index === -1) return;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= ordered.length) return;
      const [current] = ordered.splice(index, 1);
      ordered.splice(targetIndex, 0, current);
      next.sections = ordered.map((section, order) => ({ ...section, order }));
    });
  };

  const moveField = (sectionId: string, fieldKey: string, direction: -1 | 1) => {
    updateSection(sectionId, (section) => {
      const ordered = sortByOrder(section.fields);
      const index = ordered.findIndex((field) => field.key === fieldKey);
      if (index === -1) return;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= ordered.length) return;
      const [current] = ordered.splice(index, 1);
      ordered.splice(targetIndex, 0, current);
      section.fields = ordered.map((field, order) => ({ ...field, order }));
    });
  };

  const moveColumn = (columnKey: string, direction: -1 | 1) => {
    updateConfig((next) => {
      const ordered = sortByOrder(next.columns);
      const index = ordered.findIndex((column) => column.key === columnKey);
      if (index === -1) return;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= ordered.length) return;
      const [current] = ordered.splice(index, 1);
      ordered.splice(targetIndex, 0, current);
      next.columns = ordered.map((column, order) => ({ ...column, order }));
    });
  };

  const addSection = () => {
    const newId = `custom-section-${Date.now()}`;
    updateConfig((next) => {
      next.sections.push({
        id: newId,
        label: 'New Section',
        visible: true,
        order: next.sections.length,
        fields: [],
      });
      next.sections = next.sections.map((section, index) => ({
        ...section,
        order: index,
      }));
    });
  };

  const removeSection = (sectionId: string) => {
    const confirmed = window.confirm('Remove section and all of its fields?');
    if (!confirmed) return;
    updateConfig((next) => {
      next.sections = next.sections.filter((section) => section.id !== sectionId);
      next.sections = next.sections.map((section, index) => ({
        ...section,
        order: index,
      }));
    });
  };

  const addField = (sectionId: string) => {
    const fieldKey = `custom-field-${Date.now()}`;
    updateSection(sectionId, (section) => {
      section.fields.push({
        key: fieldKey,
        label: 'New Field',
        visible: true,
        order: section.fields.length,
        type: 'text',
        placeholder: '',
        defaultValue: '',
        options: [],
        validation: {},
      });
    });
  };

  const removeField = (sectionId: string, fieldKey: string) => {
    const confirmed = window.confirm('Remove this field?');
    if (!confirmed) return;
    updateSection(sectionId, (section) => {
      section.fields = section.fields
        .filter((field) => field.key !== fieldKey)
        .map((field, index) => ({ ...field, order: index }));
    });
  };

  const addColumn = () => {
    const columnKey = `custom-column-${Date.now()}`;
    updateConfig((next) => {
      next.columns.push({
        key: columnKey,
        label: 'Custom Column',
        visible: true,
        width: 12,
        formatter: 'text',
        order: next.columns.length,
        isCustom: true,
      });
      next.columns = next.columns.map((column, index) => ({
        ...column,
        order: index,
      }));
    });
  };

  const removeColumn = (columnKey: string) => {
    const confirmed = window.confirm('Remove this column?');
    if (!confirmed) return;
    updateConfig((next) => {
      next.columns = next.columns
        .filter((column) => column.key !== columnKey)
        .map((column, index) => ({ ...column, order: index }));
    });
  };

  const updateColumn = (columnKey: string, updater: (column: ColumnConfig) => void) => {
    updateConfig((next) => {
      const column = next.columns.find((item) => item.key === columnKey);
      if (!column) return;
      updater(column);
      next.columns = sortByOrder(next.columns).map((item, index) => ({
        ...item,
        order: index,
      }));
    });
  };

  const updateField = (
    sectionId: string,
    fieldKey: string,
    updater: (field: FieldConfig) => void,
  ) => {
    updateSection(sectionId, (section) => {
      const field = section.fields.find((item) => item.key === fieldKey);
      if (!field) return;
      updater(field);
    });
  };

  return (
    <div className="template-editor-pane h-full overflow-y-auto bg-gray-50 p-4 print:hidden">
      <div className="mb-4 flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Template Editor</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-1 text-white shadow hover:bg-blue-700"
            onClick={onSave}
          >
            Save
          </button>
          <button
            type="button"
            className="rounded border border-blue-600 px-3 py-1 text-blue-600 hover:bg-blue-50"
            onClick={onLoad}
          >
            Load
          </button>
          <button
            type="button"
            className="rounded border border-gray-400 px-3 py-1 text-gray-700 hover:bg-gray-100"
            onClick={onApply}
          >
            Apply to Template
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={liveUpdate}
            onChange={(event) => onToggleLive(event.target.checked)}
          />
          Live preview updates
        </label>
      </div>

      <section className="mb-6">
        <header className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">Sections</h3>
          <button
            type="button"
            className="rounded border border-dashed border-gray-400 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
            onClick={addSection}
          >
            + Section
          </button>
        </header>
        <div className="flex flex-col gap-4">
          {sections.map((section) => (
            <div key={section.id} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <input
                  type="text"
                  value={section.label}
                  onChange={(event) =>
                    updateSection(section.id, (target) => {
                      target.label = event.target.value;
                    })
                  }
                  className="w-full rounded border border-gray-300 px-3 py-1 text-sm text-gray-800 focus:border-blue-500 focus:outline-none md:w-1/2"
                  aria-label={`Section label for ${section.id}`}
                />
                <div className="flex items-center gap-2">
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-600">Style</summary>
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3 text-xs">
                      <label className="flex items-center gap-2">
                        <span className="w-20">Font</span>
                        <select
                          value={section.style?.fontFamily ?? 'sans'}
                          onChange={(e) =>
                            updateSection(section.id, (target) => {
                              target.style = { ...(target.style || {}), fontFamily: e.target.value as any };
                            })
                          }
                          className="flex-1 rounded border border-gray-300 px-2 py-1"
                        >
                          <option value="sans">Sans</option>
                          <option value="serif">Serif</option>
                          <option value="mono">Mono</option>
                        </select>
                      </label>

                      <label className="flex items-center gap-2">
                        <span className="w-20">Size</span>
                        <select
                          value={section.style?.fontSize ?? 'base'}
                          onChange={(e) =>
                            updateSection(section.id, (target) => {
                              target.style = { ...(target.style || {}), fontSize: e.target.value as any };
                            })
                          }
                          className="flex-1 rounded border border-gray-300 px-2 py-1"
                        >
                          <option value="xs">XS</option>
                          <option value="sm">SM</option>
                          <option value="base">Base</option>
                          <option value="lg">LG</option>
                          <option value="xl">XL</option>
                        </select>
                      </label>

                      <label className="flex items-center gap-2">
                        <span className="w-20">Align</span>
                        <select
                          value={section.style?.align ?? 'left'}
                          onChange={(e) =>
                            updateSection(section.id, (target) => {
                              target.style = { ...(target.style || {}), align: e.target.value as any };
                            })
                          }
                          className="flex-1 rounded border border-gray-300 px-2 py-1"
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </label>

                      <label className="flex items-center gap-2">
                        <span className="w-20">Color</span>
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="color"
                            value={section.style?.textColor && String(section.style.textColor).startsWith('#') ? String(section.style.textColor) : '#000000'}
                            onChange={(e) =>
                              updateSection(section.id, (target) => {
                                target.style = { ...(target.style || {}), textColor: e.target.value };
                              })
                            }
                            className="w-10 h-8 p-0 border rounded"
                          />
                          <input
                            type="text"
                            placeholder="text-gray-700 or #333"
                            value={section.style?.textColor ?? ''}
                            onChange={(e) =>
                              updateSection(section.id, (target) => {
                                target.style = { ...(target.style || {}), textColor: e.target.value };
                              })
                            }
                            className="flex-1 rounded border border-gray-300 px-2 py-1"
                          />
                        </div>
                      </label>

                      <label className="flex items-center gap-2">
                        <span className="w-20">BG</span>
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="color"
                            value={section.style?.bgColor && String(section.style.bgColor).startsWith('#') ? String(section.style.bgColor) : '#ffffff'}
                            onChange={(e) =>
                              updateSection(section.id, (target) => {
                                target.style = { ...(target.style || {}), bgColor: e.target.value };
                              })
                            }
                            className="w-10 h-8 p-0 border rounded"
                          />
                          <input
                            type="text"
                            placeholder="bg-white or #fff"
                            value={section.style?.bgColor ?? ''}
                            onChange={(e) =>
                              updateSection(section.id, (target) => {
                                target.style = { ...(target.style || {}), bgColor: e.target.value };
                              })
                            }
                            className="flex-1 rounded border border-gray-300 px-2 py-1"
                          />
                        </div>
                      </label>

                      <label className="flex items-center gap-2">
                        <span className="w-20">Padding</span>
                        <input
                          type="text"
                          placeholder="p-2 or py-1"
                          value={section.style?.padding ?? ''}
                          onChange={(e) =>
                            updateSection(section.id, (target) => {
                              target.style = { ...(target.style || {}), padding: e.target.value };
                            })
                          }
                          className="flex-1 rounded border border-gray-300 px-2 py-1"
                        />
                      </label>
                    </div>
                  </details>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={section.visible !== false}
                      onChange={(event) =>
                        updateSection(section.id, (target) => {
                          target.visible = event.target.checked;
                        })
                      }
                    />
                    Show
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded border border-gray-300 px-2 py-1"
                      onClick={() => moveSection(section.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="rounded border border-gray-300 px-2 py-1"
                      onClick={() => moveSection(section.id, 1)}
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    className="rounded border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50"
                    onClick={() => removeSection(section.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-gray-700">Fields</span>
                  <button
                    type="button"
                    className="rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                    onClick={() => addField(section.id)}
                  >
                    + Field
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {sortByOrder(section.fields).map((field) => (
                    <div key={field.key} className="rounded border border-gray-200 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <input
                          type="text"
                          value={field.label}
                          onChange={(event) =>
                            updateField(section.id, field.key, (target) => {
                              target.label = event.target.value;
                            })
                          }
                          className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none md:w-1/2"
                          aria-label={`Label for field ${field.key}`}
                        />
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={field.visible !== false}
                              onChange={(event) =>
                                updateField(section.id, field.key, (target) => {
                                  target.visible = event.target.checked;
                                })
                              }
                            />
                            Show
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={field.required === true}
                              onChange={(event) =>
                                updateField(section.id, field.key, (target) => {
                                  target.required = event.target.checked;
                                })
                              }
                            />
                            Required
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="rounded border border-gray-300 px-2 py-1"
                              onClick={() => moveField(section.id, field.key, -1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="rounded border border-gray-300 px-2 py-1"
                              onClick={() => moveField(section.id, field.key, 1)}
                            >
                              ↓
                            </button>
                          </div>
                          <button
                            type="button"
                            className="rounded border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50"
                            onClick={() => removeField(section.id, field.key)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-col gap-1 text-xs text-gray-600">
                        <label className="flex items-center gap-2">
                          <span className="w-20">Key</span>
                          <input
                            type="text"
                            value={field.key}
                            readOnly
                            className="flex-1 rounded border border-gray-200 bg-gray-100 px-2 py-1"
                          />
                        </label>
                        <label className="flex items-center gap-2">
                          <span className="w-20">Class</span>
                          <input
                            type="text"
                            value={field.className || ''}
                            onChange={(event) =>
                              updateField(section.id, field.key, (target) => {
                                target.className = event.target.value;
                              })
                            }
                            className="flex-1 rounded border border-gray-300 px-2 py-1"
                          />
                        </label>
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer text-gray-600">Style</summary>
                          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3 text-xs text-gray-600">
                            <label className="flex items-center gap-2">
                              <span className="w-20">Font</span>
                              <select
                                value={field.style?.fontFamily ?? 'sans'}
                                onChange={(e) =>
                                  updateField(section.id, field.key, (target) => {
                                    target.style = { ...(target.style || {}), fontFamily: e.target.value as any };
                                  })
                                }
                                className="flex-1 rounded border border-gray-300 px-2 py-1"
                              >
                                <option value="sans">Sans</option>
                                <option value="serif">Serif</option>
                                <option value="mono">Mono</option>
                              </select>
                            </label>

                            <label className="flex items-center gap-2">
                              <span className="w-20">Size</span>
                              <select
                                value={field.style?.fontSize ?? 'base'}
                                onChange={(e) =>
                                  updateField(section.id, field.key, (target) => {
                                    target.style = { ...(target.style || {}), fontSize: e.target.value as any };
                                  })
                                }
                                className="flex-1 rounded border border-gray-300 px-2 py-1"
                              >
                                <option value="xs">XS</option>
                                <option value="sm">SM</option>
                                <option value="base">Base</option>
                                <option value="lg">LG</option>
                                <option value="xl">XL</option>
                              </select>
                            </label>

                            <label className="flex items-center gap-2">
                              <span className="w-20">Align</span>
                              <select
                                value={field.style?.align ?? 'left'}
                                onChange={(e) =>
                                  updateField(section.id, field.key, (target) => {
                                    target.style = { ...(target.style || {}), align: e.target.value as any };
                                  })
                                }
                                className="flex-1 rounded border border-gray-300 px-2 py-1"
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </select>
                            </label>

                            <label className="flex items-center gap-2">
                              <span className="w-20">Text</span>
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="color"
                                  value={field.style?.textColor && String(field.style.textColor).startsWith('#') ? String(field.style.textColor) : '#000000'}
                                  onChange={(e) =>
                                    updateField(section.id, field.key, (target) => {
                                      target.style = { ...(target.style || {}), textColor: e.target.value };
                                    })
                                  }
                                  className="w-10 h-8 p-0 border rounded"
                                />
                                <input
                                  type="text"
                                  placeholder="text-gray-700 or #333"
                                  value={field.style?.textColor ?? ''}
                                  onChange={(e) =>
                                    updateField(section.id, field.key, (target) => {
                                      target.style = { ...(target.style || {}), textColor: e.target.value };
                                    })
                                  }
                                  className="flex-1 rounded border border-gray-300 px-2 py-1"
                                />
                              </div>
                            </label>

                            <label className="flex items-center gap-2">
                              <span className="w-20">BG</span>
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="color"
                                  value={field.style?.bgColor && String(field.style.bgColor).startsWith('#') ? String(field.style.bgColor) : '#ffffff'}
                                  onChange={(e) =>
                                    updateField(section.id, field.key, (target) => {
                                      target.style = { ...(target.style || {}), bgColor: e.target.value };
                                    })
                                  }
                                  className="w-10 h-8 p-0 border rounded"
                                />
                                <input
                                  type="text"
                                  placeholder="bg-white or #fff"
                                  value={field.style?.bgColor ?? ''}
                                  onChange={(e) =>
                                    updateField(section.id, field.key, (target) => {
                                      target.style = { ...(target.style || {}), bgColor: e.target.value };
                                    })
                                  }
                                  className="flex-1 rounded border border-gray-300 px-2 py-1"
                                />
                              </div>
                            </label>

                            <label className="flex items-center gap-2">
                              <span className="w-20">Padding</span>
                              <input
                                type="text"
                                placeholder="p-1 or py-1"
                                value={field.style?.padding ?? ''}
                                onChange={(e) =>
                                  updateField(section.id, field.key, (target) => {
                                    target.style = { ...(target.style || {}), padding: e.target.value };
                                  })
                                }
                                className="flex-1 rounded border border-gray-300 px-2 py-1"
                              />
                            </label>
                          </div>
                        </details>
                        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                          <label className="flex items-center gap-2">
                            <span className="w-20">Type</span>
                            <select
                              value={field.type || 'text'}
                              onChange={(e) =>
                                updateField(section.id, field.key, (target) => {
                                  target.type = e.target.value as any;
                                })
                              }
                              className="flex-1 rounded border border-gray-300 px-2 py-1"
                            >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                              <option value="date">Date</option>
                              <option value="textarea">Textarea</option>
                              <option value="select">Select</option>
                              <option value="currency">Currency</option>
                              <option value="checkbox">Checkbox</option>
                            </select>
                          </label>

                          <label className="flex items-center gap-2">
                            <span className="w-20">Placeholder</span>
                            <input
                              type="text"
                              value={field.placeholder || ''}
                              onChange={(e) =>
                                updateField(section.id, field.key, (target) => {
                                  target.placeholder = e.target.value;
                                })
                              }
                              className="flex-1 rounded border border-gray-300 px-2 py-1"
                            />
                          </label>
                        </div>

                        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                          <label className="flex items-center gap-2">
                          
                          </label>

                          {/* Select options (comma separated) */}
                          {field.type === 'select' && (
                            <label className="flex items-center gap-2">
                              <span className="w-20">Options</span>
                              <input
                                type="text"
                                value={(field.options || []).join(',')}
                                onChange={(e) =>
                                  updateField(section.id, field.key, (target) => {
                                    const parts = e.target.value
                                      .split(',')
                                      .map((p) => p.trim())
                                      .filter(Boolean);
                                    target.options = parts;
                                  })
                                }
                                className="flex-1 rounded border border-gray-300 px-2 py-1"
                                placeholder="a,b,c"
                              />
                            </label>
                          )}
                        </div>

                        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3 text-xs text-gray-600">
                          <label className="flex items-center gap-2">
                            <span className="w-20">Pattern</span>
                            <input
                              type="text"
                              value={field.validation?.pattern || ''}
                              onChange={(e) =>
                                updateField(section.id, field.key, (target) => {
                                  target.validation = { ...(target.validation || {}), pattern: e.target.value };
                                })
                              }
                              className="flex-1 rounded border border-gray-300 px-2 py-1"
                              placeholder="e.g. ^[A-Za-z0-9 ]+$"
                            />
                          </label>

                          <label className="flex items-center gap-2">
                            <span className="w-20">Min</span>
                            <input
                              type="number"
                              value={field.validation?.min ?? ''}
                              onChange={(e) =>
                                updateField(section.id, field.key, (target) => {
                                  const v = e.target.value === '' ? undefined : Number(e.target.value);
                                  target.validation = { ...(target.validation || {}), min: v };
                                })
                              }
                              className="flex-1 rounded border border-gray-300 px-2 py-1"
                            />
                          </label>

                          <label className="flex items-center gap-2">
                            <span className="w-20">Max</span>
                            <input
                              type="number"
                              value={field.validation?.max ?? ''}
                              onChange={(e) =>
                                updateField(section.id, field.key, (target) => {
                                  const v = e.target.value === '' ? undefined : Number(e.target.value);
                                  target.validation = { ...(target.validation || {}), max: v };
                                })
                              }
                              className="flex-1 rounded border border-gray-300 px-2 py-1"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                  {section.fields.length === 0 && (
                    <p className="text-xs text-gray-500">No fields in this section. Add one to begin.</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {sections.length === 0 && (
            <p className="rounded border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-600">
              No sections defined. Add a section to start configuring labels.
            </p>
          )}
        </div>
      </section>

      <section className="mb-6">
        <header className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">Table Columns</h3>
          <button
            type="button"
            className="rounded border border-dashed border-gray-400 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
            onClick={addColumn}
          >
            + Column
          </button>
        </header>
        <div className="flex flex-col gap-3">
          {columns.map((column) => (
            <div key={column.key} className="rounded border border-gray-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <input
                  type="text"
                  value={column.label}
                  onChange={(event) =>
                    updateColumn(column.key, (target) => {
                      target.label = event.target.value;
                    })
                  }
                  className="w-full rounded border border-gray-300 px-3 py-1 text-sm text-gray-800 focus:border-blue-500 focus:outline-none md:w-2/5"
                  aria-label={`Column label for ${column.key}`}
                />
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={column.visible !== false}
                      onChange={(event) =>
                        updateColumn(column.key, (target) => {
                          target.visible = event.target.checked;
                        })
                      }
                    />
                    Show
                  </label>
                  <label className="flex items-center gap-1">
                    <span>Width</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={column.width ?? ''}
                      onChange={(event) =>
                        updateColumn(column.key, (target) => {
                          const value = Number(event.target.value);
                          target.width = Number.isFinite(value) ? value : undefined;
                        })
                      }
                      className="w-20 rounded border border-gray-300 px-2 py-1"
                    />
                    <span>%</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <span>Format</span>
                    <select
                      value={column.formatter || 'text'}
                      onChange={(event) =>
                        updateColumn(column.key, (target) => {
                          target.formatter = event.target.value as ColumnConfig['formatter'];
                        })
                      }
                      className="rounded border border-gray-300 px-2 py-1"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="currency">Currency</option>
                    </select>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded border border-gray-300 px-2 py-1"
                      onClick={() => moveColumn(column.key, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="rounded border border-gray-300 px-2 py-1"
                      onClick={() => moveColumn(column.key, 1)}
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    className="rounded border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50"
                    onClick={() => removeColumn(column.key)}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-col gap-2 text-xs text-gray-600">
                <label className="flex items-center gap-2">
                  <span className="w-24">Key</span>
                  <input
                    type="text"
                    value={column.key}
                    onChange={(event) => {
                      const newKey = event.target.value.trim();
                      if (!newKey) return;
                      updateConfig((next) => {
                        const target = next.columns.find((item) => item.key === column.key);
                        if (!target) return;
                        target.key = newKey;
                      });
                    }}
                    className={`flex-1 rounded border border-gray-300 px-2 py-1 ${
                      column.isCustom ? '' : 'bg-gray-100 text-gray-500'
                    }`}
                    readOnly={!column.isCustom}
                  />
                </label>
              </div>
            </div>
          ))}
          {columns.length === 0 && (
            <p className="rounded border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-600">
              No columns defined. Add columns to configure the items table.
            </p>
          )}
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-3 text-base font-semibold text-gray-800">Authorized Signature</h3>
        <div className="rounded border border-gray-200 bg-white p-3 text-sm text-gray-700">
          <label className="mb-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.authorizedBy?.visible !== false}
              onChange={(event) =>
                updateConfig((next) => {
                  if (!next.authorizedBy) {
                    next.authorizedBy = { visible: true, label: 'Authorized By' };
                  }
                  next.authorizedBy.visible = event.target.checked;
                })
              }
            />
            Show authorized signature block
          </label>
          <label className="flex items-center gap-2">
            <span className="w-24 text-xs uppercase tracking-wide text-gray-500">Label</span>
            <input
              type="text"
              value={config.authorizedBy?.label ?? 'Authorized By'}
              onChange={(event) =>
                updateConfig((next) => {
                  if (!next.authorizedBy) {
                    next.authorizedBy = { visible: true, label: 'Authorized By' };
                  }
                  next.authorizedBy.label = event.target.value;
                })
              }
              className="flex-1 rounded border border-gray-300 px-2 py-1"
            />
          </label>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <label className="flex items-center gap-2">
              <span className="w-24 text-xs uppercase tracking-wide text-gray-500">Signature URL</span>
              <input
                type="text"
                value={config.authorizedBy?.signatureUrl ?? ''}
                onChange={(e) =>
                  updateConfig((next) => {
                    if (!next.authorizedBy) next.authorizedBy = { visible: true, label: 'Authorized By' } as any;
                    next.authorizedBy.signatureUrl = e.target.value || undefined;
                  })
                }
                className="flex-1 rounded border border-gray-300 px-2 py-1"
                placeholder="https://... or data:image/..."
              />
            </label>

            <label className="flex items-center gap-2">
              <span className="w-24 text-xs uppercase tracking-wide text-gray-500">Upload</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    updateConfig((next) => {
                      if (!next.authorizedBy) next.authorizedBy = { visible: true, label: 'Authorized By' } as any;
                      next.authorizedBy.signatureUrl = String(reader.result || '');
                    });
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            <label className="flex items-center gap-2">
              <span className="w-24 text-xs uppercase tracking-wide text-gray-500">Name</span>
              <input
                type="text"
                value={config.authorizedBy?.personName ?? ''}
                onChange={(e) =>
                  updateConfig((next) => {
                    if (!next.authorizedBy) next.authorizedBy = { visible: true, label: 'Authorized By' } as any;
                    next.authorizedBy.personName = e.target.value || undefined;
                  })
                }
                className="flex-1 rounded border border-gray-300 px-2 py-1"
              />
            </label>

            <label className="flex items-center gap-2">
              <span className="w-24 text-xs uppercase tracking-wide text-gray-500">Designation</span>
              <input
                type="text"
                value={config.authorizedBy?.designation ?? ''}
                onChange={(e) =>
                  updateConfig((next) => {
                    if (!next.authorizedBy) next.authorizedBy = { visible: true, label: 'Authorized By' } as any;
                    next.authorizedBy.designation = e.target.value || undefined;
                  })
                }
                className="flex-1 rounded border border-gray-300 px-2 py-1"
              />
            </label>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="w-24 text-xs uppercase tracking-wide text-gray-500">Align</span>
            <select
              value={config.authorizedBy?.align ?? 'right'}
              onChange={(e) =>
                updateConfig((next) => {
                  if (!next.authorizedBy) next.authorizedBy = { visible: true, label: 'Authorized By' } as any;
                  next.authorizedBy.align = e.target.value as any;
                })
              }
              className="rounded border border-gray-300 px-2 py-1"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>

            <button
              type="button"
              className="ml-4 rounded border border-red-300 px-2 py-1 text-red-600"
              onClick={() =>
                updateConfig((next) => {
                  if (!next.authorizedBy) return;
                  next.authorizedBy.signatureUrl = undefined;
                })
              }
            >
              Remove Signature
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TemplateEditor;
