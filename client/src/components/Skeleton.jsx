// Shimmer loading placeholders, shaped per-page to match the content that
// will replace them (flashcard, quiz question, kanji grid, etc.) instead of
// a generic spinner/text — layout doesn't jump when real data lands.

export function SkeletonBlock({ className = '', style }) {
  return <div className={`skeleton-block ${className}`} style={style} />;
}

export function QuizSkeleton({ count = 3 }) {
  return (
    <div className="quiz-runner skeleton-wrap" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="quiz-question" key={i}>
          <div className="quiz-question-head">
            <SkeletonBlock className="sk-pill" />
            <SkeletonBlock className="sk-line" style={{ flex: 1 }} />
          </div>
          <div className="quiz-options">
            {Array.from({ length: 4 }).map((_, j) => (
              <SkeletonBlock className="sk-option" key={j} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FlashcardSkeleton() {
  return (
    <div className="flashcard-wrap skeleton-wrap" aria-hidden="true">
      <div className="flip-card skeleton-flip-card">
        <SkeletonBlock className="sk-flashcard-main" />
        <SkeletonBlock className="sk-flashcard-sub" />
      </div>
      <div className="flashcard-controls">
        <SkeletonBlock className="sk-pill wide" />
        <SkeletonBlock className="sk-pill wide" />
        <SkeletonBlock className="sk-pill wide" />
      </div>
    </div>
  );
}

export function KanjiGridSkeleton({ count = 8 }) {
  return (
    <div className="kanji-grid skeleton-wrap" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="kanji-card" key={i}>
          <SkeletonBlock className="sk-kanji-char" />
          <div className="kanji-readings">
            <SkeletonBlock className="sk-line" />
            <SkeletonBlock className="sk-line" />
            <SkeletonBlock className="sk-line short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GrammarListSkeleton({ count = 5 }) {
  return (
    <div className="grammar-list skeleton-wrap" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="grammar-card" key={i}>
          <SkeletonBlock className="sk-line short" />
          <SkeletonBlock className="sk-line" />
          <SkeletonBlock className="sk-line" />
          <SkeletonBlock className="sk-line short" />
        </div>
      ))}
    </div>
  );
}

export function SpeakingSkeleton() {
  return (
    <div className="speaking-card skeleton-wrap" aria-hidden="true">
      <SkeletonBlock className="sk-line wide" />
      <SkeletonBlock className="sk-line" />
      <SkeletonBlock className="sk-line short" />
      <div className="speaking-controls">
        <SkeletonBlock className="sk-pill wide" />
        <SkeletonBlock className="sk-pill wide" />
        <SkeletonBlock className="sk-pill wide" />
      </div>
      <SkeletonBlock className="sk-visualizer" />
    </div>
  );
}

export function StatGridSkeleton({ count = 4 }) {
  return (
    <div className="card-grid skeleton-wrap" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="stat-card" key={i}>
          <SkeletonBlock className="sk-stat-value" />
          <SkeletonBlock className="sk-line short" />
        </div>
      ))}
    </div>
  );
}

export function MemoryGridSkeleton({ count = 16, cols = 4 }) {
  return (
    <div className="memory-grid skeleton-wrap" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock className="sk-memory-card" key={i} />
      ))}
    </div>
  );
}
