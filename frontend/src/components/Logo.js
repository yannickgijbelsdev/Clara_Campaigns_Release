export function Logo({ className = "" }) {
  return (
    <img
      src="/favicon-32.png"
      alt="Clara"
      className={`h-7 w-7 object-contain select-none ${className}`}
      draggable="false"
    />
  );
}
