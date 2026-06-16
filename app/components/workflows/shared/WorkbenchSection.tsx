"use client";

type Props = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

export default function WorkbenchSection({ title, children, className = "" }: Props) {
  return (
    <section className={`glass-panel mb-4 rounded-xl p-5 ${className}`}>
      <h2 className="workbench-section-title mb-3">{title}</h2>
      {children}
    </section>
  );
}
