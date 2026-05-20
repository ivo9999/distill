interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-medium">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-ink-medium">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
