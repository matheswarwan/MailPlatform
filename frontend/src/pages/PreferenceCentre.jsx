import React, { useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import useAppStore from '../store/appStore';
import Button from '../components/ui/Button';

function LivePreview({ config }) {
  return (
    <div
      className="rounded-2xl overflow-hidden border"
      style={{ border: '1px solid #252B3B', background: '#fff' }}
    >
      {/* Branded header */}
      <div
        className="px-8 py-8 text-center"
        style={{ background: config.brandColor || '#4F7FFF' }}
      >
        {config.logoUrl ? (
          <img src={config.logoUrl} alt="Logo" className="h-12 mx-auto mb-4 object-contain" />
        ) : (
          <div
            className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center text-white font-bold text-xl"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            M
          </div>
        )}
        <h1 className="text-xl font-bold text-white mb-2">
          {config.headline || 'Manage Your Email Preferences'}
        </h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
          {config.description || 'Choose the types of emails you would like to receive.'}
        </p>
      </div>

      {/* Subscription types */}
      <div className="px-6 py-6 space-y-3" style={{ background: '#f9f9f9' }}>
        {config.subscriptionTypes?.length > 0 ? (
          config.subscriptionTypes.map((type, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-white"
              style={{ border: '1px solid #e5e7eb' }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: '#111' }}>{type.name}</p>
                {type.defaultOptIn && (
                  <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Subscribed by default</p>
                )}
              </div>
              <div
                className="relative w-10 h-6 rounded-full transition-colors"
                style={{ background: type.defaultOptIn ? (config.brandColor || '#4F7FFF') : '#d1d5db' }}
              >
                <span
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform"
                  style={{ left: type.defaultOptIn ? '20px' : '4px' }}
                />
              </div>
            </div>
          ))
        ) : (
          <div
            className="flex items-center justify-between px-4 py-3 rounded-xl bg-white"
            style={{ border: '1px solid #e5e7eb' }}
          >
            <p className="text-sm" style={{ color: '#111' }}>Marketing Emails</p>
            <div className="relative w-10 h-6 rounded-full" style={{ background: config.brandColor || '#4F7FFF' }}>
              <span className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full shadow" />
            </div>
          </div>
        )}

        <button
          className="w-full py-2.5 rounded-xl text-sm font-semibold mt-2"
          style={{ background: config.brandColor || '#4F7FFF', color: '#fff' }}
        >
          Save Preferences
        </button>

        <button
          className="w-full py-2.5 rounded-xl text-sm font-medium"
          style={{ background: '#fff', color: '#ef4444', border: '1px solid #fecaca' }}
        >
          Unsubscribe from all emails
        </button>
      </div>
    </div>
  );
}

export default function PreferenceCentre() {
  const { preferenceConfig, fetchPreferenceConfig, updatePreferenceConfig } = useAppStore();
  const [config, setConfig] = useState({
    headline: '',
    description: '',
    brandColor: '#4F7FFF',
    logoUrl: '',
    subscriptionTypes: [],
  });
  const [newTypeName, setNewTypeName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    fetchPreferenceConfig();
  }, []);

  useEffect(() => {
    if (preferenceConfig) {
      setConfig({
        headline: preferenceConfig.headline || '',
        description: preferenceConfig.description || '',
        brandColor: preferenceConfig.brandColor || '#4F7FFF',
        logoUrl: preferenceConfig.logoUrl || '',
        subscriptionTypes: preferenceConfig.subscriptionTypes || [],
      });
      if (preferenceConfig.logoUrl) setLogoPreview(preferenceConfig.logoUrl);
    }
  }, [preferenceConfig]);

  const onLogoDrop = useCallback((accepted) => {
    const file = accepted[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target.result);
      setConfig((prev) => ({ ...prev, logoUrl: e.target.result }));
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps: getLogoProps, getInputProps: getLogoInputProps, isDragActive: logoIsDragging } = useDropzone({
    onDrop: onLogoDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.svg', '.webp'] },
    multiple: false,
  });

  const addSubscriptionType = () => {
    if (!newTypeName.trim()) return;
    setConfig((prev) => ({
      ...prev,
      subscriptionTypes: [
        ...prev.subscriptionTypes,
        { name: newTypeName.trim(), defaultOptIn: false },
      ],
    }));
    setNewTypeName('');
  };

  const removeSubscriptionType = (i) => {
    setConfig((prev) => ({
      ...prev,
      subscriptionTypes: prev.subscriptionTypes.filter((_, idx) => idx !== i),
    }));
  };

  const toggleDefaultOptIn = (i) => {
    setConfig((prev) => ({
      ...prev,
      subscriptionTypes: prev.subscriptionTypes.map((t, idx) =>
        idx === i ? { ...t, defaultOptIn: !t.defaultOptIn } : t
      ),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updatePreferenceConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-6">
      {/* Left: Config */}
      <div className="flex-1 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold" style={{ color: '#F1F3F9' }}>Preference Centre</h2>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-sm font-medium" style={{ color: '#22C55E' }}>
                Saved!
              </span>
            )}
            <Button variant="primary" size="md" onClick={handleSave} loading={saving}>
              Save Changes
            </Button>
          </div>
        </div>

        {/* Logo */}
        <div
          className="rounded-xl p-5 space-y-4"
          style={{ background: '#181C27', border: '1px solid #252B3B' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: '#F1F3F9' }}>Brand Logo</h3>

          <div className="flex items-start gap-4">
            {/* Preview */}
            <div
              className="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ background: '#0F1117', border: '1px solid #252B3B' }}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="#252B3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              )}
            </div>

            <div
              {...getLogoProps()}
              className="flex-1 px-4 py-5 rounded-xl text-center cursor-pointer transition-all"
              style={{
                background: logoIsDragging ? '#1A2744' : '#0F1117',
                border: `2px dashed ${logoIsDragging ? '#4F7FFF' : '#252B3B'}`,
              }}
            >
              <input {...getLogoInputProps()} />
              <p className="text-sm" style={{ color: '#F1F3F9' }}>
                Drop logo here or <span style={{ color: '#4F7FFF' }}>browse</span>
              </p>
              <p className="text-xs mt-1" style={{ color: '#8B92A5' }}>PNG, JPG, SVG — max 2 MB</p>
            </div>

            {logoPreview && (
              <button
                onClick={() => { setLogoPreview(null); setConfig((prev) => ({ ...prev, logoUrl: '' })); }}
                className="text-xs"
                style={{ color: '#EF4444' }}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Brand color */}
        <div
          className="rounded-xl p-5"
          style={{ background: '#181C27', border: '1px solid #252B3B' }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#F1F3F9' }}>Brand Color</h3>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={config.brandColor}
              onChange={(e) => setConfig({ ...config, brandColor: e.target.value })}
              className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
            />
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                style={{ color: '#8B92A5' }}
              >
                #
              </span>
              <input
                type="text"
                value={config.brandColor.replace('#', '')}
                onChange={(e) => {
                  const hex = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                  if (hex.length === 6) setConfig({ ...config, brandColor: `#${hex}` });
                }}
                maxLength={6}
                className="pl-7 pr-4 py-2 rounded-lg text-sm outline-none font-mono"
                style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9', width: 120 }}
                onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
              />
            </div>
            {/* Color swatches */}
            <div className="flex items-center gap-2">
              {['#4F7FFF', '#22C55E', '#EAB308', '#EF4444', '#A855F7', '#F97316', '#06B6D4', '#EC4899'].map((color) => (
                <button
                  key={color}
                  onClick={() => setConfig({ ...config, brandColor: color })}
                  className="w-7 h-7 rounded-lg transition-transform hover:scale-110"
                  style={{
                    background: color,
                    outline: config.brandColor === color ? `2px solid ${color}` : 'none',
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div
          className="rounded-xl p-5 space-y-4"
          style={{ background: '#181C27', border: '1px solid #252B3B' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: '#F1F3F9' }}>Page Content</h3>

          {/* Headline */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium" style={{ color: '#8B92A5' }}>Headline</label>
              <span className="text-xs" style={{ color: config.headline.length > 70 ? '#EF4444' : '#8B92A5' }}>
                {config.headline.length}/80
              </span>
            </div>
            <input
              type="text"
              value={config.headline}
              maxLength={80}
              onChange={(e) => setConfig({ ...config, headline: e.target.value })}
              placeholder="Manage Your Email Preferences"
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
              onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
              onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium" style={{ color: '#8B92A5' }}>Description</label>
              <span className="text-xs" style={{ color: config.description.length > 270 ? '#EF4444' : '#8B92A5' }}>
                {config.description.length}/300
              </span>
            </div>
            <textarea
              value={config.description}
              maxLength={300}
              onChange={(e) => setConfig({ ...config, description: e.target.value })}
              placeholder="Choose the types of emails you would like to receive."
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none resize-none"
              style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
              onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
              onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
            />
          </div>
        </div>

        {/* Subscription types */}
        <div
          className="rounded-xl p-5 space-y-4"
          style={{ background: '#181C27', border: '1px solid #252B3B' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: '#F1F3F9' }}>Subscription Types</h3>

          {config.subscriptionTypes.length > 0 && (
            <div className="space-y-2">
              {config.subscriptionTypes.map((type, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: '#0F1117', border: '1px solid #252B3B' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: '#F1F3F9' }}>{type.name}</p>
                  </div>

                  {/* Default opt-in toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: '#8B92A5' }}>Default opt-in</span>
                    <button
                      onClick={() => toggleDefaultOptIn(i)}
                      className="relative w-9 h-5 rounded-full transition-colors"
                      style={{ background: type.defaultOptIn ? '#4F7FFF' : '#252B3B' }}
                    >
                      <span
                        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                        style={{ left: type.defaultOptIn ? '17px' : '2px' }}
                      />
                    </button>
                  </div>

                  <button
                    onClick={() => removeSubscriptionType(i)}
                    className="text-xs px-2 py-1 rounded transition-colors"
                    style={{ color: '#EF4444' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#2D0E0E')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new type */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSubscriptionType()}
              placeholder="e.g. Product Updates"
              className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
              onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
              onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
            />
            <Button variant="secondary" size="md" onClick={addSubscriptionType} disabled={!newTypeName.trim()}>
              Add Type
            </Button>
          </div>
        </div>
      </div>

      {/* Right: Live Preview */}
      <div className="w-80 flex-shrink-0">
        <div className="sticky top-0">
          <p className="text-sm font-semibold mb-3" style={{ color: '#8B92A5' }}>Live Preview</p>
          <LivePreview config={config} />
          <p className="text-xs mt-3 text-center" style={{ color: '#8B92A5' }}>
            This is how subscribers will see the preference page
          </p>
        </div>
      </div>
    </div>
  );
}
