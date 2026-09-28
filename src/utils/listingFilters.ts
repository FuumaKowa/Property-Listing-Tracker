export function picOptions(values: string[]): string[] {
  return [...new Set(values.flatMap(value => [value, ...value.split('/').map(part => part.trim())]).filter(Boolean))].sort();
}
export function matchesPic(value: string, selected: string): boolean {
  return selected === 'All' || value === selected || value.split('/').some(part => part.trim() === selected);
}
