export function ComingSoon({ title, step }: { title: string; step: string }) {
  return (
    <div className="screen">
      <h1 className="screen-title">{title}</h1>
      <div className="empty">
        <div className="big">🚧</div>
        <p>Cet écran arrive à l’étape « {step} ».</p>
      </div>
    </div>
  );
}
