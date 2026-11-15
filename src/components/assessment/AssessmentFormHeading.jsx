export function AssessmentFormHeading({ title, children }) {
  return (
    <div className="dg-form-heading">
      <h2 className="card__title">{title}</h2>
      {children && <div className="text-sm">{children}</div>}
    </div>
  );
}
