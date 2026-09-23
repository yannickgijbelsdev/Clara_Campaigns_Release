export function Logo({ className = "" }) {
  return (
    <img
      src="/koodh-clara-logo.webp"
      alt="koodh clara"
      className={`h-7 w-auto select-none ${className}`}
      draggable="false"
    />
  );
}
