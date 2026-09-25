/** Türkçe iyelik eki isme göre değişir (Baba’nın, Anne’nin, Dede’nin); bilinmeyen isimde ünlü uyumuna bakılır. */
export function withGenitive(name: string) {
  const known: Record<string, string> = { Baba: 'Baba’nın', Anne: 'Anne’nin', Anneanne: 'Anneanne’nin' };
  if (known[name]) return known[name];
  const vowels = name.toLocaleLowerCase('tr-TR').match(/[aeıioöuü]/g) || [];
  const last = vowels[vowels.length - 1] || 'e';
  const suffix = ({ a: 'ın', ı: 'ın', e: 'in', i: 'in', o: 'un', u: 'un', ö: 'ün', ü: 'ün' } as Record<string, string>)[last] || 'in';
  const endsWithVowel = /[aeıioöuü]$/i.test(name);
  return `${name}’${endsWithVowel ? 'n' : ''}${suffix}`;
}
