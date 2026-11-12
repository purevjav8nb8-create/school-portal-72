export function formatTeacherName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name.trim();
  return `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}`;
}
