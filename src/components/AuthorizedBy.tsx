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
  const name = (personName ?? '').toString().trim();
  const des = (designation ?? '').toString().trim();
  const hasText = name.length > 0 || des.length > 0;
  const hasSignature = Boolean(signatureUrl && signatureUrl.toString().trim().length > 0);

  if (!visible) return null;
  if (!hasSignature && !hasText) return null;

  const alignmentClasses: Record<AlignOption, string> = {
    left: 'items-start text-left',
    center: 'items-center text-center',
    right: 'items-end text-right',
  };

  const headingLabel = label?.trim() || 'AUTHORIZED SIGNATORY';
  const headingClass = labelClassName || 'text-xs uppercase tracking-wide text-gray-500';

  return (
    <div className={`authorized-by print-avoid-break mt-2 flex flex-col ${alignmentClasses[align]} ${className}`.trim()}>
      <span className={headingClass}>{headingLabel}</span>
      <span className="mt-3 block w-40 border-t border-gray-300" aria-hidden="true" />

      {hasSignature ? (
        <img
          src={signatureUrl as string}
          alt={name ? `Signature of ${name}` : 'Authorized signature'}
          className="mt-2 max-w-full"
          style={{ width: '160px', height: 'auto' }}
          crossOrigin="anonymous"
        />
      ) : null}

      {name ? <span className="mt-2 font-semibold text-sm text-gray-800">{name}</span> : null}
      {des ? <span className="mt-1 text-xs text-gray-600">{des}</span> : null}

      <span className="mt-3 block" aria-hidden="true" />
    </div>
  );
};

export default AuthorizedBy;