export type VocalGenderOption = {
  id: 'm' | 'f';
  name: string;
};

export function getVocalGenderOptions(t: (key: string) => string): VocalGenderOption[] {
  return [
    { id: 'm', name: t('featurePanel.male') },
    { id: 'f', name: t('featurePanel.female') },
  ];
}
