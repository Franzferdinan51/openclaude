import { getInitialSettings } from '../utils/settings/settings.js'

export function getSpinnerVerbs(): string[] {
  const settings = getInitialSettings()
  const config = settings.spinnerVerbs
  if (!config) {
    return SPINNER_VERBS
  }
  if (config.mode === 'replace') {
    return config.verbs.length > 0 ? config.verbs : SPINNER_VERBS
  }
  return [...SPINNER_VERBS, ...config.verbs]
}

// Spinner verbs for loading messages
export const SPINNER_VERBS = [
  'Waddling',
  'Quacking',
  'Dabbling',
  'Preening',
  'Splashing',
  'Diving',
  'Drifting',
  'Pond-hopping',
  'Wing-flapping',
  'Beak-bathing',
  'Feather-fluffing',
  'Bill-clatting',
  'Courting',
  'Nest-building',
  'Egg-sitting',
  'Duckling-shepherding',
  'Foraging',
  'Grazing',
  'Gulping',
  'Tipping',
  'Up-ending',
  'Rafting',
  'Decoy-draping',
  'Mallard-flapping',
  'Teal-teasing',
  'Widgeon-wobbling',
  'Pintail-plotting',
  'Shoveler-splashing',
  'Canvasback-cruising',
  'Redhead-rambling',
  'Scaup-scouting',
  'Merganser-melding',
  'Bufflehead-buoying',
  'Goldeneye-gliding',
  'Smew-swooping',
  'Eider-exploring',
  'Scoter-surfing',
  'Long-tailed-dabbling',
  'Harlequin-huddling',
  'Oldsquaw-orbiting',
  'Steller-surfing',
  'Labrador-lapping',
  'Wood-duck-wandering',
  'Muscovy-marching',
  'Mandarin-meandering',
  'Ringed-teal-rocking',
  'Crested-cresting',
  'Falcated-flapping',
  'Baikal-bobbing',
  'Barred-waddling',
  'Hooded-honkling',
  'Tufted-tupping',
  'Ferruginous-flapping',
]
