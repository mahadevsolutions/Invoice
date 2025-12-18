import React from 'react';

type AlignOption = 'left' | 'center' | 'right';

interface AuthorizedByProps {
  signatureUrl?: string | null;
  personName?: string | null;
  designation?: string | null;
  align?: AlignOption;
  className?: string;
  label?: string;
  labelClassName?: string;
  visible?: boolean;
}

/**
 * Renders an optional authorized signature block with configurable alignment.
 * Block is wrapped in "print-avoid-break" so it NEVER splits across PDF pages.
 */
const AuthorizedBy: React.FC<AuthorizedByProps> = ({
  signatureUrl,
  personName,
  designation,
  align = 'right',
  className = '',
  label,
  labelClassName,
  visible = true,
}) => {
  if (!visible) return null;
  if (!signatureUrl && !personName && !designation) return null;

  const alignmentClasses: Record<AlignOption, string> = {
    left: 'items-start text-left',
    center: 'items-center text-center',
    right: 'items-end text-right',
  };

  const headingLabel = label?.trim() || 'Authorized By';
  const headingClass =
    labelClassName || 'text-xs uppercase tracking-wide text-gray-500';

  return (
    <div
      className={`authorized-by print-avoid-break mt-6 flex flex-col gap-2 ${alignmentClasses[align]} ${className}`.trim()}
    >
      <span className={headingClass}>{headingLabel}</span>

      {signatureUrl ? (
        <img
          src={signatureUrl}
          alt={personName ? `Signature of ${personName}` : 'Authorized signature'}
          className="max-w-full"
          style={{ width: '160px', height: 'auto' }}
          crossOrigin="anonymous"
        />
      ) : (
        <span
          className="block w-40 border-t border-gray-300 pt-6"
          aria-hidden="true"
        />
      )}

      {personName ? (
        <span className="font-semibold text-sm text-gray-800">
          {personName}
        </span>
      ) : null}
        {/** optional designation */}
        {designation ? (
          <span className="text-xs text-gray-600">{designation}</span>
        ) : null}
    </div>
  );
};

export default AuthorizedBy;
