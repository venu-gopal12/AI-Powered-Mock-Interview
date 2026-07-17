import React from 'react';

const titleCase = (value) =>
  value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

function DimensionGroup({ title, values, fallback }) {
  // New scorecards include nested dimensions; fallback keeps older saved
  // sessions readable by expanding the aggregate score into each row.
  const dimensions = values || fallback;
  return (
    <div style={{ flex: '1 1 240px' }}>
      <h4 style={{ margin: '0 0 0.75rem' }}>{title}</h4>
      {Object.entries(dimensions).map(([name, score]) => (
        <div key={name} style={{ marginBottom: '0.65rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
            <span>{titleCase(name)}</span><strong>{score}/10</strong>
          </div>
          <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 10, marginTop: 4 }}>
            <div style={{
              width: `${Math.max(0, Math.min(10, score)) * 10}%`,
              height: '100%', borderRadius: 10,
              background: title === 'Technical' ? '#10a37f' : '#1976d2',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceList({ title, items, fallback, color }) {
  // Prefer evidence-based model output, but show legacy feedback/improvement
  // strings when old saved scorecards do not have arrays yet.
  const displayItems = items?.length ? items : fallback ? [{ point: fallback, evidence: '' }] : [];
  if (!displayItems.length) return null;
  return (
    <section style={{ marginTop: '1.25rem' }}>
      <h3 style={{ marginBottom: '0.65rem', color }}>{title}</h3>
      {displayItems.map((item, index) => (
        <div key={`${item.point}-${index}`} style={{
          padding: '0.8rem 1rem', marginBottom: '0.6rem',
          borderLeft: `4px solid ${color}`, background: 'var(--input-bg)',
          borderRadius: '0.5rem',
        }}>
          <strong>{item.point}</strong>
          {item.evidence && (
            <div style={{ marginTop: '0.3rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Evidence: {item.evidence}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

export default function Scorecard({ scorecard }) {
  if (!scorecard) return null;
  // Fallbacks preserve compatibility with scorecards saved before detailed
  // correctness/depth/communication dimensions existed.
  const technicalFallback = {
    correctness: scorecard.technical_score ?? 0,
    depth: scorecard.technical_score ?? 0,
    problem_solving: scorecard.technical_score ?? 0,
  };
  const communicationFallback = {
    clarity: scorecard.communication_score ?? 0,
    structure: scorecard.communication_score ?? 0,
    confidence: scorecard.communication_score ?? 0,
  };
  const overall = scorecard.overall_score ??
    // Recalculate old scorecards using the same weighted blend as the server.
    Math.round((scorecard.technical_score ?? 0) * 0.6 + (scorecard.communication_score ?? 0) * 0.4);
  const summary = scorecard.interview_summary;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{
          width: 92, height: 92, borderRadius: '50%', display: 'grid',
          placeItems: 'center', border: '8px solid #10a37f',
          fontSize: '1.6rem', fontWeight: 800,
        }}>{overall}/10</div>
        <div>
          <h2 style={{ margin: 0 }}>Interview Scorecard</h2>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)' }}>
            Technical {scorecard.technical_score}/10 · Communication {scorecard.communication_score}/10
          </p>
          {summary && (
            <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              {summary.questions_answered} substantive answers · {summary.hints_used} hints · {titleCase(summary.completion)}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
        <DimensionGroup title="Technical" values={scorecard.technical} fallback={technicalFallback} />
        <DimensionGroup title="Communication" values={scorecard.communication} fallback={communicationFallback} />
      </div>
      <EvidenceList title="What you did well" items={scorecard.strengths} fallback={scorecard.feedback} color="#10a37f" />
      <EvidenceList title="Where you lost points" items={scorecard.weaknesses} fallback={scorecard.improvement} color="#d97706" />

      {scorecard.recommended_actions?.length > 0 && (
        <section style={{ marginTop: '1.25rem' }}>
          <h3 style={{ marginBottom: '0.65rem' }}>Your next practice plan</h3>
          {scorecard.recommended_actions.map((item, index) => (
            <div key={`${item.topic}-${index}`} style={{
              padding: '1rem', marginBottom: '0.75rem',
              background: 'var(--input-bg)', border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
            }}>
              <strong>#{item.priority} · {item.topic}</strong>
              <p style={{ margin: '0.45rem 0' }}>{item.action}</p>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Practice: {item.practice_question}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
