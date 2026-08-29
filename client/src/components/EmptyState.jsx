// Shared "nothing to show" placeholder — was previously just a bare <p>,
// dropped directly into the page with no visual structure, repeated
// near-identically across Kanji/Grammar/Vocabulary/Listening/Progress.
export default function EmptyState({ icon, message }) {
  return (
    <div className="empty-state">
      {icon}
      <p>{message}</p>
    </div>
  );
}
