import "./anchor-heading.css";

/** A section heading with a visible link to itself, so a section can be shared by URL. */
export default function AnchorHeading({
  id,
  label,
  children,
  level = 2,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  level?: 2 | 3;
}) {
  const Tag = level === 2 ? "h2" : "h3";
  return (
    <Tag className="anchor-heading">
      {children}
      <a className="anchor-link" href={`#${id}`} aria-label={`${label}: ${String(children)}`}>
        #
      </a>
    </Tag>
  );
}
