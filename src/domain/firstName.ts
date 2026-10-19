// Devine à partir du prénom quelle photo d'accueil proposer par défaut.
// C'est seulement une proposition : la personne peut toujours choisir l'autre photo.

const normalize = (name: string) =>
  name
    .trim()
    .split(/[\s-]+/)[0]
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Prénoms féminins courants. */
const FEMALE = new Set(
  `agathe agnes alice aline amandine ambre amelie anais angele anne annie apolline astrid aude audrey aurelie aurore
  axelle beatrice berenice blanche brigitte capucine carole caroline cecile celine chantal charlotte chloe christine
  claire clara clarisse clemence colette coralie corinne delphine diane dorothee edith eleonore elise eloise elodie
  emilie emma emmanuelle esther estelle eve fanny fatou fleur florence frederique gabrielle genevieve gwendoline helene
  hortense ines ingrid iris isabelle jade jeanne josephine judith julie juliette justine karine laetitia laure laurence
  lea leila leonie lise lou louane louise lucie lucile lucy lydie madeleine maelle maeva manon margaux margot marie
  marine marion marjorie marthe mathilde maud maude melanie melissa mireille monique morgane muriel myriam nadege
  nadine nathalie noemie oceane odile ophelie pascale patricia pauline perrine priscille rachel rebecca rose roxane
  sabine salome sandrine sarah segolene severine solene sophie stephanie suzanne sylvie tiphaine valerie veronique
  victoire virginie yasmine zoe ruth jennifer kelly cindy nancy megane ashley chelsea maryam aicha khadija meryem
  fatima zeynep shirin ayse elif`.split(/\s+/),
);

/** Prénoms masculins qui ressemblent à des prénoms féminins (finale en -a, -e…). */
const MALE = new Set(
  `luca lucas joshua nicola andrea ilya mustafa moussa issa yahya zakaria hamza oussama noa elia mattia jonah sacha
  kylian kilian joe mike pierre philippe jerome guillaume maxime theophile stephane baptiste antoine alexandre anatole
  achille aime andre bertrand charlie christophe come etienne eugene fabrice gaspard gilles hippolyte jacques jeremie
  jerome jules lionel louis-marie lucien maurice olivier pascal remi rene serge thibaude yannick yves`.split(/\s+/),
);

/** Prénoms portés aussi bien par des filles que par des garçons : on ne devine pas. */
const MIXED = new Set(`camille dominique claude alex alexis sam charlie lou andrea eden noa sasha morgan`.split(/\s+/));

export type NameGuess = 'feminin' | 'masculin' | null;

export function guessFromFirstName(name: string): NameGuess {
  const n = normalize(name);
  if (n.length < 2 || MIXED.has(n)) return null;
  if (FEMALE.has(n)) return 'feminin';
  if (MALE.has(n)) return 'masculin';
  // Finales typiquement féminines en français.
  if (/(ine|elle|ette|ienne|anne|ia|ie|a)$/.test(n)) return 'feminin';
  return 'masculin';
}
