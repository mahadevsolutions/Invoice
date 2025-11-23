import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TemplateEditor from 'src/components/template-editor/TemplateEditor';
import { TemplateConfig, resolveTemplateConfig } from 'src/components/template-editor/field-types';
import { loadConfig, saveConfig } from 'src/utils/templateConfigStorage';

interface TemplatePreviewWrapperProps {
  defaultConfigFactory: () => TemplateConfig;
  config?: TemplateConfig;
  storageKey?: string;
  onConfigApply?: (config: TemplateConfig) => void;
}

const TemplatePreviewWrapper: React.FC<TemplatePreviewWrapperProps> = ({
  defaultConfigFactory,
  config,
  storageKey = 'invoicer-template-config',
  onConfigApply,
}) => {
  const [draftConfig, setDraftConfig] = useState<TemplateConfig>(() =>
    resolveTemplateConfig(defaultConfigFactory, config),
  );
  const [liveUpdate, setLiveUpdate] = useState<boolean>(true);
  const resolvedStorageConfig = useMemo(() => loadConfig(storageKey), [storageKey]);

  useEffect(() => {
    const resolved = resolveTemplateConfig(defaultConfigFactory, config);
    setDraftConfig(resolved);
  }, [config, defaultConfigFactory]);

  useEffect(() => {
    if (!resolvedStorageConfig || config) return;
    setDraftConfig(resolveTemplateConfig(defaultConfigFactory, resolvedStorageConfig));
  }, [config, defaultConfigFactory, resolvedStorageConfig]);

  const handleConfigChange = useCallback(
    (next: TemplateConfig) => {
      setDraftConfig(next);
      if (liveUpdate) {
        onConfigApply?.(next);
      }
    },
    [liveUpdate, onConfigApply],
  );

  const handleSave = useCallback(() => {
    saveConfig(storageKey, draftConfig);
  }, [draftConfig, storageKey]);

  const handleLoad = useCallback(() => {
    const stored = loadConfig(storageKey);
    if (!stored) {
      alert('No saved template configuration was found in storage.');
      return;
    }
    const restored = resolveTemplateConfig(defaultConfigFactory, stored);
    setDraftConfig(restored);
    if (liveUpdate) {
      onConfigApply?.(restored);
    }
  }, [defaultConfigFactory, liveUpdate, onConfigApply, storageKey]);

  const handleApply = useCallback(() => {
    onConfigApply?.(draftConfig);
  }, [draftConfig, onConfigApply]);

  const handleToggleLive = useCallback((value: boolean) => {
    setLiveUpdate(value);
    if (value) {
      onConfigApply?.(draftConfig);
    }
  }, [draftConfig, onConfigApply]);

  return (
    <div className="template-preview-wrapper flex h-full flex-col gap-4">
      <TemplateEditor
        config={draftConfig}
        onChange={handleConfigChange}
        onSave={handleSave}
        onLoad={handleLoad}
        onApply={handleApply}
        liveUpdate={liveUpdate}
        onToggleLive={handleToggleLive}
      />
    </div>
  );
};

export default TemplatePreviewWrapper;
