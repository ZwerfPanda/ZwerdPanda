import { useId, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface FieldShellProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: (ids: { inputId: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/** Label + control + hint/error, wired together for screen readers. */
export function Field({ label, hint, error, optional, children }: FieldShellProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {label}
        {optional && <span className="optional"> (optioneel)</span>}
      </label>
      {children({ inputId, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={errorId}>
          <AlertCircle aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
};

export function TextField({ label, value, onChange, hint, error, optional, ...rest }: InputProps) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional}>
      {({ inputId, describedBy, invalid }) => (
        <input
          {...rest}
          id={inputId}
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        />
      )}
    </Field>
  );
}

type TextAreaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'onChange' | 'value'
> & {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  variant?: 'default' | 'letter';
};

export function TextArea({
  label,
  value,
  onChange,
  hint,
  error,
  optional,
  variant,
  ...rest
}: TextAreaProps) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional}>
      {({ inputId, describedBy, invalid }) => (
        <textarea
          {...rest}
          id={inputId}
          className={`textarea ${variant === 'letter' ? 'textarea--letter' : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        />
      )}
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
  optional,
}: {
  label: ReactNode;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  hint?: ReactNode;
  optional?: boolean;
}) {
  return (
    <Field label={label} hint={hint} optional={optional}>
      {({ inputId, describedBy }) => (
        <select
          id={inputId}
          className="select"
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          aria-describedby={describedBy}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** A row of pill-shaped radio buttons. */
export function Segmented<T extends string>({
  legend,
  value,
  onChange,
  options,
  hint,
}: {
  legend: ReactNode;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  hint?: ReactNode;
}) {
  const name = useId();
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="field__label" style={{ marginBottom: 6 }}>
        {legend}
      </legend>
      <div className="segmented">
        {options.map((o) => (
          <label key={o.value} className="segmented__option">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>
              {o.icon}
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {hint && <p className="field__hint">{hint}</p>}
    </fieldset>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  art,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  art?: ReactNode;
}) {
  return (
    <header className="page-header">
      {art}
      {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
      <h1 className="page-header__title">{title}</h1>
      {lede && <p className="page-header__lede">{lede}</p>}
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  art,
  title,
  text,
  action,
}: {
  art?: ReactNode;
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {art && <div className="empty__art">{art}</div>}
      <h3 className="empty__title">{title}</h3>
      {text && <p className="empty__text">{text}</p>}
      {action}
    </div>
  );
}
