/*
 * Everything Wie kent wie can ask. Open questions are written about yourself
 * ("mijn", "ik"); when the other guesses, they read with your name instead.
 * Light and fun on purpose: things to laugh about and learn, nothing heavy.
 *
 * The first questions of each kind keep their old ids, so answers given
 * before this list grew still belong to the right question.
 */

export type Category =
  | 'food'
  | 'me'
  | 'dreams'
  | 'us'
  | 'habits'
  | 'media'
  | 'travel'
  | 'animals'
  | 'home'
  | 'party'
  | 'silly'
  | 'style'
  | 'love'
  | 'phone'
  | 'seasons'
  | 'own';

export const CATEGORIES: Record<Category, { label: string; emoji: string; color: string }> = {
  food: { label: 'Eten & drinken', emoji: '🍕', color: '#ffb020' },
  me: { label: 'Over mij', emoji: '💖', color: '#ff5fa2' },
  dreams: { label: 'Dromen', emoji: '✨', color: '#b07bff' },
  us: { label: 'Wij', emoji: '💑', color: '#ff8cc0' },
  habits: { label: 'Gewoontes', emoji: '☕', color: '#5ff3ff' },
  media: { label: 'Films, series & muziek', emoji: '🎬', color: '#7f9cff' },
  travel: { label: 'Reizen', emoji: '✈️', color: '#4fd1c5' },
  animals: { label: 'Coco & dieren', emoji: '🐰', color: '#c9a27c' },
  home: { label: 'Thuis', emoji: '🏠', color: '#f6ad55' },
  party: { label: 'Feestjes & cadeaus', emoji: '🎁', color: '#f687b3' },
  silly: { label: 'Gekke vragen', emoji: '🤪', color: '#9ae66e' },
  style: { label: 'Smaak & stijl', emoji: '💅', color: '#e9a1ff' },
  love: { label: 'Liefde', emoji: '💌', color: '#ff6b8b' },
  phone: { label: 'Telefoon & online', emoji: '📱', color: '#63b3ed' },
  seasons: { label: 'Seizoenen & weer', emoji: '🌦️', color: '#90cdf4' },
  own: { label: 'Eigen vraag', emoji: '📝', color: '#5dff9a' },
};

export interface OpenQuestion {
  id: string;
  text: string;
  category: Category;
}

const set = (category: Category, list: [string, string][]): OpenQuestion[] =>
  list.map(([id, text]) => ({ id, text, category }));

/** Questions about yourself, so the other can guess. Our own can be added. */
export const STARTER_QUESTIONS: OpenQuestion[] = [
  ...set('food', [
    ['q-food', 'Wat is mijn lievelingseten?'],
    ['q-snack', 'Wat is mijn favoriete snack?'],
    ['q-never', 'Wat zou ik nooit eten?'],
    ['q-drink', 'Koffie, thee of matcha?'],
    ['q-food-breakfast', 'Wat is mijn ideale ontbijt?'],
    ['q-food-candy', 'Welk snoepje kies ik altijd?'],
    ['q-food-pizza', 'Wat moet er bij mij op een pizza?'],
    ['q-food-icecream', 'Welke ijssmaak neem ik?'],
    ['q-food-takeaway', 'Wat bestel ik als we iets laten bezorgen?'],
    ['q-food-cook', 'Wat kan ik het lekkerst koken?'],
    ['q-food-sauce', 'Welke saus doe ik overal op?'],
    ['q-food-fruit', 'Wat is mijn lievelingsfruit?'],
    ['q-food-dessert', 'Welk toetje kan ik niet weerstaan?'],
    ['q-food-crisps', 'Welke chipssmaak koop ik?'],
    ['q-food-lastmeal', 'Als ik nog één ding mocht eten, wat zou het zijn?'],
    ['q-food-cinema', 'Wat neem ik mee naar de bioscoop?'],
  ]),
  ...set('me', [
    ['q-colour', 'Wat is mijn lievelingskleur?'],
    ['q-happy', 'Waar word ik meteen blij van?'],
    ['q-animal', 'Welk dier zou ik zijn?'],
    ['q-talent', 'Wat is mijn verborgen talent?'],
    ['q-proud', 'Waar ben ik stiekem trots op?'],
    ['q-grumpy', 'Waar word ik chagrijnig van?'],
    ['q-fear', 'Waar ben ik bang voor?'],
    ['q-me-number', 'Wat is mijn lievelingsgetal?'],
    ['q-me-word', 'Welk woord zeg ik veel te vaak?'],
    ['q-me-laugh', 'Waar moet ik altijd om lachen?'],
    ['q-me-superpower', 'Welke superkracht zou ik willen?'],
    ['q-me-emoji', 'Welke emoji gebruik ik het meest?'],
    ['q-me-calm', 'Waar word ik rustig van?'],
    ['q-me-compliment', 'Welk compliment vind ik het allerleukst?'],
    ['q-me-threewords', 'Welke drie woorden passen het best bij mij?'],
    ['q-me-guilty', 'Wat is mijn guilty pleasure?'],
  ]),
  ...set('dreams', [
    ['q-trip', 'Waar zou ik het liefst samen op reis gaan?'],
    ['q-dream-job', 'Wat is mijn droombaan?'],
    ['q-sunday', 'Mijn perfecte zondag ziet eruit als…'],
    ['q-dreams-house', 'Hoe ziet mijn droomhuis eruit?'],
    ['q-dreams-lottery', 'Wat doe ik als eerste met een loterijprijs?'],
    ['q-dreams-learn', 'Wat wil ik nog heel graag leren?'],
    ['q-dreams-bucket', 'Wat staat bovenaan mijn bucketlist?'],
    ['q-dreams-car', 'Wat is mijn droomauto?'],
    ['q-dreams-city', 'In welke stad zou ik best eens willen wonen?'],
    ['q-dreams-meet', 'Welke beroemdheid zou ik graag ontmoeten?'],
    ['q-dreams-birthday', 'Hoe ziet mijn droomverjaardag eruit?'],
    ['q-dreams-skill', 'Welk instrument zou ik willen kunnen spelen?'],
    ['q-dreams-future', 'Waar zie ik ons over tien jaar?'],
    ['q-dreams-pet', 'Welk huisdier wil ik er later nog bij?'],
  ]),
  ...set('us', [
    ['q-memory', 'Wat is mijn favoriete herinnering van ons?'],
    ['q-date', 'Mijn ideale date is…'],
    ['q-first', 'Wat viel mij als eerste aan jou op?'],
    ['q-us-song', 'Welk liedje is volgens mij óns liedje?'],
    ['q-us-laugh', 'Wat is volgens mij ons grappigste moment samen?'],
    ['q-us-tradition', 'Welke gewoonte van ons vind ik het leukst?'],
    ['q-us-nickname', 'Welk koosnaampje vind ik het liefst?'],
    ['q-us-place', 'Wat is mijn favoriete plek om samen te zijn?'],
    ['q-us-movie', 'Welke film zou ik samen met jou willen kijken?'],
    ['q-us-cute', 'Wat vind ik het schattigst aan jou?'],
    ['q-us-trip', 'Welk uitje samen wil ik nog een keer doen?'],
    ['q-us-photo', 'Wat is mijn favoriete foto van ons?'],
    ['q-us-mission', 'Wat moeten we volgens mij echt nog samen doen?'],
    ['q-us-team', 'Waar zijn wij volgens mij samen goed in?'],
    ['q-us-firstdate', 'Wat weet ik nog van onze eerste date?'],
  ]),
  ...set('habits', [
    ['q-song', 'Welk liedje zit altijd in mijn hoofd?'],
    ['q-morning', 'Wat doe ik als eerste na het wakker worden?'],
    ['q-series', 'Wat is mijn lievelingsfilm of -serie?'],
    ['q-habits-bed', 'Wat doe ik als laatste voor het slapengaan?'],
    ['q-habits-alarm', 'Hoe vaak druk ik op snooze?'],
    ['q-habits-late', 'Waar ben ik altijd te laat voor?'],
    ['q-habits-shower', 'Wat doe ik onder de douche?'],
    ['q-habits-sleep', 'In welke houding val ik in slaap?'],
    ['q-habits-procrastinate', 'Wat stel ik altijd uit?'],
    ['q-habits-stress', 'Wat doe ik bij stress?'],
    ['q-habits-weekend', 'Wat doe ik het liefst op vrijdagavond?'],
    ['q-habits-forget', 'Wat vergeet ik altijd?'],
    ['q-habits-tidy', 'Ben ik een opruimer of een stapelaar?'],
    ['q-habits-bored', 'Wat doe ik bij verveling?'],
  ]),
  ...set('media', [
    ['q-media-artist', 'Wie is mijn favoriete artiest?'],
    ['q-media-cry', 'Bij welke film moet ik huilen?'],
    ['q-media-rewatch', 'Welke serie kan ik eindeloos opnieuw kijken?'],
    ['q-media-karaoke', 'Welk liedje zing ik bij karaoke?'],
    ['q-media-genre', 'Welk muziekgenre luister ik het meest?'],
    ['q-media-character', 'Op welk personage uit een film of serie lijk ik?'],
    ['q-media-disney', 'Wat is mijn favoriete Disney- of animatiefilm?'],
    ['q-media-book', 'Welk boek of verhaal vond ik het mooist?'],
    ['q-media-game', 'Welke game speel ik het liefst?'],
    ['q-media-concert', 'Naar welk concert zou ik nog willen?'],
    ['q-media-youtube', 'Waar kijk ik filmpjes over?'],
    ['q-media-guilty', 'Welk liedje vind ik stiekem heel goed?'],
    ['q-media-scary', 'Welke film vond ik veel te eng?'],
    ['q-media-quote', 'Welke filmquote zeg ik vaak?'],
  ]),
  ...set('travel', [
    ['q-travel-country', 'Welk land wil ik het allerliefst zien?'],
    ['q-travel-type', 'Strandvakantie, stedentrip of avontuur?'],
    ['q-travel-pack', 'Wat vergeet ik altijd in te pakken?'],
    ['q-travel-food', 'Welk buitenlands eten vind ik het lekkerst?'],
    ['q-travel-souvenir', 'Wat neem ik mee als souvenir?'],
    ['q-travel-transport', 'Vliegen, trein of roadtrip?'],
    ['q-travel-hotel', 'Hoe ziet mijn perfecte hotelkamer eruit?'],
    ['q-travel-nl', 'Wat is mijn favoriete plek in Nederland?'],
    ['q-travel-weekend', 'Waar zou ik een weekendje heen willen?'],
    ['q-travel-activity', 'Wat moet ik op vakantie per se doen?'],
    ['q-travel-language', 'Welke taal zou ik willen spreken?'],
    ['q-travel-snow', 'Wintersport of liever naar de zon?'],
    ['q-travel-first', 'Wat doe ik als eerste op een vakantieadres?'],
  ]),
  ...set('animals', [
    ['q-animals-coco', 'Wat vind ik het schattigst aan Coco?'],
    ['q-animals-cocofood', 'Wat is volgens mij Coco’s lievelingssnack?'],
    ['q-animals-coconame', 'Welke bijnaam heb ik voor Coco?'],
    ['q-animals-fav', 'Wat is mijn lievelingsdier?'],
    ['q-animals-zoo', 'Welk dier wil ik als eerste zien in de dierentuin?'],
    ['q-animals-scary', 'Welk dier vind ik eng?'],
    ['q-animals-trick', 'Welk kunstje zou ik Coco willen leren?'],
    ['q-animals-cocothinks', 'Wat denkt Coco volgens mij als ze ons ziet?'],
    ['q-animals-cocojob', 'Welk beroep zou Coco hebben als ze een mens was?'],
    ['q-animals-sea', 'Welk zeedier vind ik het mooist?'],
    ['q-animals-pet', 'Welk dier zou ik ooit nog willen aaien?'],
    ['q-animals-baby', 'Van welk babydiertje smelt ik?'],
  ]),
  ...set('home', [
    ['q-home-room', 'Wat is mijn favoriete plek in huis?'],
    ['q-home-chore', 'Welk klusje doe ik het minst graag?'],
    ['q-home-blanket', 'Waar kruip ik het liefst onder?'],
    ['q-home-smell', 'Welke geur moet mijn huis hebben?'],
    ['q-home-plant', 'Welke plant zou ik nog willen hebben?'],
    ['q-home-style', 'Hoe zou ik ons huis inrichten?'],
    ['q-home-cozy', 'Wat maakt een avond thuis voor mij gezellig?'],
    ['q-home-lazy', 'Wat doe ik op een luie dag?'],
    ['q-home-kitchen', 'Wat staat er altijd in mijn koelkast?'],
    ['q-home-light', 'Grote lamp aan of alleen lampjes en kaarsjes?'],
    ['q-home-pyjama', 'Wat trek ik thuis het liefst aan?'],
    ['q-home-bath', 'Douchen of in bad?'],
  ]),
  ...set('party', [
    ['q-party-gift', 'Wat is het leukste cadeau dat ik ooit kreeg?'],
    ['q-party-cake', 'Wat is mijn droomverjaardagstaart?'],
    ['q-party-dance', 'Op welk liedje ga ik meteen dansen?'],
    ['q-party-holiday', 'Welke feestdag vind ik het leukst?'],
    ['q-party-wish', 'Wat zou ik nu graag krijgen?'],
    ['q-party-surprise', 'Hou ik van verrassingen of wil ik het liever weten?'],
    ['q-party-wrap', 'Pak ik cadeautjes mooi in of snel?'],
    ['q-party-outfit', 'Wat trek ik aan naar een feestje?'],
    ['q-party-game', 'Welk spelletje wil ik op een feestje spelen?'],
    ['q-party-flowers', 'Welke bloemen vind ik het mooist?'],
    ['q-party-treat', 'Waarmee kun je mij altijd blij maken?'],
    ['q-party-newyear', 'Welk goed voornemen houd ik nooit vol?'],
  ]),
  ...set('silly', [
    ['q-silly-zombie', 'Wat neem ik mee als de zombies komen?'],
    ['q-silly-island', 'Welke drie dingen neem ik mee naar een onbewoond eiland?'],
    ['q-silly-celebrity', 'Welke beroemdheid zou mij spelen in een film?'],
    ['q-silly-food', 'Welk eten zou ik zijn?'],
    ['q-silly-invent', 'Wat zou ik uitvinden?'],
    ['q-silly-shop', 'Wat voor winkeltje zou ik beginnen?'],
    ['q-silly-dinosaur', 'Welke dinosaurus zou ik als huisdier willen?'],
    ['q-silly-name', 'Welke andere voornaam zou ik kiezen?'],
    ['q-silly-timetravel', 'Naar welk jaar zou ik tijdreizen?'],
    ['q-silly-teleport', 'Waar teleporteer ik nu meteen heen?'],
    ['q-silly-invisible', 'Wat zou ik doen met een dagje onzichtbaarheid?'],
    ['q-silly-speak', 'Met welk dier zou ik willen kunnen praten?'],
    ['q-silly-reality', 'In welke tv-show zou ik winnen?'],
    ['q-silly-robot', 'Welk klusje mag een robot voor mij doen?'],
    ['q-silly-motto', 'Wat zou mijn lijfspreuk op een T-shirt zijn?'],
  ]),
  ...set('style', [
    ['q-style-nails', 'Welke nagelkleur kies ik het liefst?'],
    ['q-style-shoes', 'Wat zijn mijn favoriete schoenen?'],
    ['q-style-shop', 'In welke winkel kan ik uren rondkijken?'],
    ['q-style-perfume', 'Welke geur draag ik het liefst?'],
    ['q-style-outfit', 'Wat is mijn lievelingsoutfit?'],
    ['q-style-hair', 'Welk kapsel zou ik nog eens willen proberen?'],
    ['q-style-jewelry', 'Welk sieraad draag ik het vaakst?'],
    ['q-style-comfy', 'Wat is mijn comfy outfit?'],
    ['q-style-bag', 'Wat zit er altijd in mijn tas?'],
    ['q-style-pattern', 'Bloemetjes, strepen of effen?'],
    ['q-style-sweater', 'Welk kledingstuk zou ik van jou willen lenen?'],
    ['q-style-season', 'In welk seizoen is mijn kledingkast op z’n best?'],
  ]),
  ...set('love', [
    ['q-love-language', 'Wat is mijn liefdestaal?'],
    ['q-love-gesture', 'Welk klein gebaar maakt mij heel blij?'],
    ['q-love-letter', 'Wat zou ik in een liefdesbrief schrijven?'],
    ['q-love-kiss', 'Waar geef ik het liefst een kusje?'],
    ['q-love-romantic', 'Wat vind ik het romantischst?'],
    ['q-love-miss', 'Wat mis ik het meest als we elkaar niet zien?'],
    ['q-love-text', 'Welk berichtje maakt mijn dag?'],
    ['q-love-cuddle', 'Hoe knuffel ik het liefst?'],
    ['q-love-song', 'Welk liefdesliedje vind ik het mooist?'],
    ['q-love-surprise', 'Met welke verrassing kun je mij het blijst maken?'],
    ['q-love-sorry', 'Hoe maak ik het goed na iets stoms?'],
    ['q-love-why', 'Waarom ben ik verliefd geworden, denk je?'],
  ]),
  ...set('phone', [
    ['q-phone-app', 'Welke app open ik het vaakst?'],
    ['q-phone-wallpaper', 'Wat is mijn telefoonachtergrond?'],
    ['q-phone-battery', 'Bij hoeveel procent ga ik pas opladen?'],
    ['q-phone-notif', 'Hoeveel ongelezen meldingen heb ik meestal?'],
    ['q-phone-photo', 'Waar maak ik de meeste foto’s van?'],
    ['q-phone-voice', 'Spraakberichtjes: ja of nee?'],
    ['q-phone-sticker', 'Welke sticker of gif stuur ik het vaakst?'],
    ['q-phone-ringtone', 'Staat mijn telefoon op stil of met geluid?'],
    ['q-phone-scroll', 'Waar scroll ik ’s avonds doorheen?'],
    ['q-phone-first', 'Wat check ik ’s ochtends als eerste?'],
    ['q-phone-game', 'Welk spelletje staat er op mijn telefoon?'],
    ['q-phone-name', 'Onder welke naam sta jij in mijn telefoon?'],
  ]),
  ...set('seasons', [
    ['q-seasons-fav', 'Wat is mijn favoriete seizoen?'],
    ['q-seasons-rain', 'Wat doe ik op een regenachtige dag?'],
    ['q-seasons-summer', 'Wat moet ik elke zomer doen?'],
    ['q-seasons-winter', 'Wat vind ik het fijnst aan de winter?'],
    ['q-seasons-hot', 'Hoe warm is te warm voor mij?'],
    ['q-seasons-snow', 'Wat doe ik als het sneeuwt?'],
    ['q-seasons-autumn', 'Wat vind ik het mooist aan de herfst?'],
    ['q-seasons-spring', 'Waar kijk ik in de lente naar uit?'],
    ['q-seasons-drink', 'Wat drink ik als het koud is?'],
    ['q-seasons-holiday', 'Naar welke dag van het jaar kijk ik het meest uit?'],
    ['q-seasons-sleep', 'Slaap ik met het raam open of dicht?'],
    ['q-seasons-sunset', 'Zonsopgang of zonsondergang?'],
  ]),
];

/** The quick round: pick one, then guess what the other picked. */
export interface QuickQuestion {
  id: string;
  a: string;
  b: string;
  category: Category;
}

const pairs = (category: Category, list: [string, string, string][]): QuickQuestion[] =>
  list.map(([id, a, b]) => ({ id, a, b, category }));

export const THIS_OR_THAT: QuickQuestion[] = [
  ...pairs('food', [
    ['tt-sweet', 'Zoet', 'Zout'],
    ['tt-pizza', 'Pizza', 'Sushi'],
    ['tt-boba', 'Bubble tea', 'Matcha latte'],
    ['tt-chocolate', 'Melkchocolade', 'Pure chocolade'],
    ['tt-fries', 'Friet', 'Pasta'],
    ['tt-spicy', 'Pittig', 'Mild'],
    ['tt-pancake', 'Pannenkoeken', 'Wafels'],
    ['tt-breakfast', 'Hartig ontbijt', 'Zoet ontbijt'],
    ['tt-cook', 'Zelf koken', 'Uit eten'],
    ['tt-icecream', 'IJsje', 'Taartje'],
    ['tt-coffee', 'Koffie', 'Thee'],
    ['tt-mcd', 'McDonald’s', 'Burger King'],
  ]),
  ...pairs('habits', [
    ['tt-morning', 'Ochtendmens', 'Avondmens'],
    ['tt-sleep', 'Uitslapen', 'Vroeg op'],
    ['tt-plan', 'Alles plannen', 'Spontaan'],
    ['tt-call', 'Bellen', 'Appen'],
    ['tt-shower', 'Ochtenddouche', 'Avonddouche'],
    ['tt-alarm', 'Eén wekker', 'Tien wekkers'],
    ['tt-early', 'Te vroeg', 'Net te laat'],
    ['tt-list', 'Lijstjes maken', 'Alles onthouden'],
  ]),
  ...pairs('media', [
    ['tt-film', 'Film', 'Serie'],
    ['tt-romcom', 'Romcom', 'Horror'],
    ['tt-music', 'Muziek aan', 'Lekker stil'],
    ['tt-book', 'Boek', 'Film van het boek'],
    ['tt-cinema', 'Bioscoop', 'Film thuis'],
    ['tt-cartoon', 'Disney', 'Pixar'],
    ['tt-podcast', 'Podcast', 'Playlist'],
    ['tt-concert', 'Concert', 'Festival'],
  ]),
  ...pairs('travel', [
    ['tt-beach', 'Strand', 'Stad'],
    ['tt-mountains', 'Bergen', 'Zee'],
    ['tt-train', 'Trein', 'Auto'],
    ['tt-camping', 'Kamperen', 'Hotel'],
    ['tt-window', 'Raamplek', 'Gangpad'],
    ['tt-pack', 'Licht inpakken', 'Alles meenemen'],
    ['tt-abroad', 'Ver weg', 'Dichtbij'],
    ['tt-museum', 'Museum', 'Pretpark'],
  ]),
  ...pairs('us', [
    ['tt-cuddle', 'Knuffelen op de bank', 'Samen op stap'],
    ['tt-gift', 'Een cadeautje', 'Een lieve brief'],
    ['tt-date', 'Dinertje', 'Picknick'],
    ['tt-karaoke', 'Karaoke', 'Arcade'],
    ['tt-photo', 'Selfie', 'Iemand anders maakt de foto'],
    ['tt-surprise', 'Verrast worden', 'Zelf verrassen'],
    ['tt-hold', 'Handjes vasthouden', 'Arm om je heen'],
    ['tt-walk', 'Wandelen', 'Fietsen'],
  ]),
  ...pairs('animals', [
    ['tt-dog', 'Hond', 'Kat'],
    ['tt-bunny', 'Konijn', 'Hamster'],
    ['tt-zoo', 'Dierentuin', 'Aquarium'],
    ['tt-bird', 'Pinguïn', 'Flamingo'],
    ['tt-bear', 'IJsbeer', 'Panda'],
  ]),
  ...pairs('home', [
    ['tt-home', 'Thuis chillen', 'Uitgaan'],
    ['tt-bath', 'Bad', 'Douche'],
    ['tt-tidy', 'Opgeruimd', 'Gezellige chaos'],
    ['tt-light', 'Grote lamp', 'Kaarsjes'],
    ['tt-blanket', 'Dekentje', 'Korte broek'],
    ['tt-plants', 'Echte planten', 'Nepplanten'],
  ]),
  ...pairs('seasons', [
    ['tt-summer', 'Zomer', 'Winter'],
    ['tt-rain', 'Regen op het raam', 'Zon op je gezicht'],
    ['tt-sunrise', 'Zonsopgang', 'Zonsondergang'],
    ['tt-snow', 'Sneeuw', 'Hittegolf'],
    ['tt-autumn', 'Herfst', 'Lente'],
  ]),
  ...pairs('style', [
    ['tt-sneakers', 'Sneakers', 'Hakken'],
    ['tt-gold', 'Goud', 'Zilver'],
    ['tt-hoodie', 'Hoodie', 'Blouse'],
    ['tt-nails', 'Lange nagels', 'Korte nagels'],
    ['tt-pink', 'Roze', 'Zwart'],
  ]),
  ...pairs('silly', [
    ['tt-fly', 'Kunnen vliegen', 'Onzichtbaar zijn'],
    ['tt-past', 'Terug in de tijd', 'Naar de toekomst'],
    ['tt-dragon', 'Draak', 'Eenhoorn'],
    ['tt-pirate', 'Piraat', 'Ridder'],
    ['tt-space', 'Ruimte', 'Diepzee'],
    ['tt-tiny', 'Mini-olifant', 'Reuzenkonijn'],
  ]),
  ...pairs('phone', [
    ['tt-voice', 'Spraakbericht', 'Typen'],
    ['tt-dark', 'Dark mode', 'Light mode'],
    ['tt-photos', 'Foto’s maken', 'Video’s maken'],
    ['tt-emoji', 'Emoji’s', 'Stickers'],
  ]),
  ...pairs('party', [
    ['tt-party', 'Groot feest', 'Klein met vrienden'],
    ['tt-dance', 'Dansen', 'Aan de kant kletsen'],
    ['tt-cake', 'Taart', 'Cupcakes'],
    ['tt-wrap', 'Mooi ingepakt', 'Gewoon in een tasje'],
  ]),
];

/** "How much…?" — pick a number from 1 to 10, then guess the other's. */
export interface ScaleQuestion {
  id: string;
  text: string;
  low: string;
  high: string;
  category: Category;
}

const scale = (category: Category, list: [string, string, string, string][]): ScaleQuestion[] =>
  list.map(([id, text, low, high]) => ({ id, text, low, high, category }));

export const SCALES: ScaleQuestion[] = [
  ...scale('food', [
    ['sc-spicy', 'Hoe goed kan ik tegen pittig eten?', 'helemaal niet', '🌶️ vuurspuwer'],
    ['sc-sweet', 'Hoe groot is mijn zoetekauw?', 'mini', 'gigantisch'],
    ['sc-cook', 'Hoe goed kan ik koken?', 'water aanbranden', 'chef'],
    ['sc-hungry', 'Hoe chagrijnig word ik van honger?', 'gaat wel', 'hangry'],
  ]),
  ...scale('habits', [
    ['sc-morning', 'Hoe fit ben ik ’s ochtends?', 'zombie', 'zonnetje'],
    ['sc-tidy', 'Hoe netjes ben ik?', 'chaos', 'alles op z’n plek'],
    ['sc-late', 'Hoe vaak ben ik te laat?', 'nooit', 'altijd'],
    ['sc-plan', 'Hoe goed plan ik dingen?', 'spontaan', 'agenda-koning(in)'],
    ['sc-sleepy', 'Hoe snel val ik in slaap?', 'uren wakker', 'meteen weg'],
  ]),
  ...scale('me', [
    ['sc-stubborn', 'Hoe koppig ben ik?', 'flexibel', 'muurvast'],
    ['sc-ticklish', 'Hoe kittelig ben ik?', 'niks', 'gillend'],
    ['sc-competitive', 'Hoe fanatiek ben ik bij spelletjes?', 'relaxed', 'moet winnen'],
    ['sc-cry', 'Hoe snel moet ik huilen bij een film?', 'nooit', 'altijd'],
    ['sc-scared', 'Hoe snel schrik ik?', 'ijskoud', 'spring op'],
    ['sc-patient', 'Hoe geduldig ben ik?', 'nul', 'engelengeduld'],
    ['sc-chatty', 'Hoe kletserig ben ik?', 'stil', 'non-stop'],
  ]),
  ...scale('us', [
    ['sc-cuddly', 'Hoe knuffelig ben ik?', 'beetje', 'altijd'],
    ['sc-miss', 'Hoe erg mis ik je als we elkaar een week niet zien?', 'gaat prima', 'heel erg'],
    ['sc-romantic', 'Hoe romantisch ben ik?', 'nuchter', 'rozenblaadjes'],
    ['sc-jealous', 'Hoe snel ben ik jaloers?', 'nooit', 'oei'],
    ['sc-cheesy', 'Hoe cheesy mogen liefdesberichtjes van mij zijn?', 'kort', 'extra kaas'],
  ]),
  ...scale('media', [
    ['sc-horror', 'Hoe eng mag een film voor mij zijn?', 'niet eng', 'doodeng'],
    ['sc-sing', 'Hoe hard zing ik mee in de auto?', 'zachtjes', 'concert'],
    ['sc-dance', 'Hoe graag dans ik?', 'nee dank je', 'altijd'],
  ]),
  ...scale('animals', [
    ['sc-coco', 'Hoe verliefd ben ik op Coco?', 'best leuk', 'tot de maan'],
    ['sc-spider', 'Hoe bang ben ik voor spinnen?', 'aai ze', 'ik ben weg'],
  ]),
  ...scale('travel', [
    ['sc-adventure', 'Hoe avontuurlijk ben ik op reis?', 'zwembad', 'bungeejump'],
    ['sc-pack', 'Hoeveel neem ik mee op reis?', 'handbagage', 'drie koffers'],
  ]),
  ...scale('phone', [
    ['sc-phone', 'Hoe verslaafd ben ik aan de telefoon?', 'nauwelijks', 'help'],
    ['sc-selfie', 'Hoeveel selfies maak ik?', 'nooit', 'elke dag'],
  ]),
  ...scale('seasons', [
    ['sc-cold', 'Hoe snel heb ik het koud?', 'nooit', 'altijd'],
    ['sc-rain', 'Hoe erg vind ik regen?', 'gezellig', 'drama'],
  ]),
];

/** "Who of us…?" — pick one of us, then guess who the other picked. Stored as you/partner. */
export interface WhoQuestion {
  id: string;
  text: string;
  category: Category;
}

const who = (category: Category, list: [string, string][]): WhoQuestion[] =>
  list.map(([id, text]) => ({ id, text, category }));

export const WHO_OF_US: WhoQuestion[] = [
  ...who('habits', [
    ['wv-sleep', 'Wie van ons valt als eerste in slaap?'],
    ['wv-late', 'Wie van ons is vaker te laat?'],
    ['wv-snooze', 'Wie van ons drukt vaker op snooze?'],
    ['wv-messy', 'Wie van ons is de grootste sloddervos?'],
    ['wv-lost', 'Wie van ons raakt vaker iets kwijt?'],
    ['wv-phone', 'Wie van ons zit meer op de telefoon?'],
    ['wv-blanket', 'Wie van ons pikt het dekbed?'],
  ]),
  ...who('food', [
    ['wv-cook', 'Wie van ons kookt het lekkerst?'],
    ['wv-hungry', 'Wie van ons heeft altijd honger?'],
    ['wv-snack', 'Wie van ons eet de laatste snack op?'],
    ['wv-order', 'Wie van ons twijfelt het langst bij het bestellen?'],
  ]),
  ...who('us', [
    ['wv-first-text', 'Wie van ons stuurt vaker als eerste een berichtje?'],
    ['wv-sorry', 'Wie van ons zegt als eerste sorry?'],
    ['wv-romantic', 'Wie van ons is het romantischst?'],
    ['wv-cuddle', 'Wie van ons wil vaker knuffelen?'],
    ['wv-plan', 'Wie van ons plant onze dates?'],
    ['wv-miss', 'Wie van ons mist de ander het snelst?'],
    ['wv-iloveyou', 'Wie van ons zei het eerst “ik hou van jou”?'],
    ['wv-jealous', 'Wie van ons is sneller jaloers?'],
  ]),
  ...who('me', [
    ['wv-stubborn', 'Wie van ons is koppiger?'],
    ['wv-funny', 'Wie van ons is grappiger?'],
    ['wv-cry', 'Wie van ons huilt sneller bij een film?'],
    ['wv-scared', 'Wie van ons is banger in het donker?'],
    ['wv-dramatic', 'Wie van ons is dramatischer?'],
    ['wv-patient', 'Wie van ons is geduldiger?'],
    ['wv-ticklish', 'Wie van ons is kitteliger?'],
  ]),
  ...who('silly', [
    ['wv-zombie', 'Wie van ons overleeft langer bij een zombie-apocalyps?'],
    ['wv-famous', 'Wie van ons wordt eerder beroemd?'],
    ['wv-lottery', 'Wie van ons geeft de loterijprijs sneller uit?'],
    ['wv-alien', 'Wie van ons zou meegaan met aliens?'],
    ['wv-dance', 'Wie van ons danst gekker?'],
  ]),
  ...who('party', [
    ['wv-gift', 'Wie van ons geeft de leukste cadeaus?'],
    ['wv-party', 'Wie van ons blijft het langst op een feestje?'],
    ['wv-sing', 'Wie van ons zingt het hardst mee?'],
  ]),
  ...who('animals', [
    ['wv-coco', 'Wie van ons verwent Coco het meest?'],
    ['wv-cocofav', 'Wie vindt Coco het leukst (eerlijk zeggen)?'],
    ['wv-spider', 'Wie van ons haalt de spin weg?'],
  ]),
  ...who('travel', [
    ['wv-pack', 'Wie van ons neemt te veel mee op reis?'],
    ['wv-map', 'Wie van ons verdwaalt sneller?'],
    ['wv-photo', 'Wie van ons maakt de meeste vakantiefoto’s?'],
  ]),
  ...who('media', [
    ['wv-remote', 'Wie van ons kiest de film?'],
    ['wv-spoiler', 'Wie van ons verklapt het einde?'],
    ['wv-asleep-film', 'Wie van ons valt in slaap tijdens een film?'],
  ]),
  ...who('phone', [
    ['wv-voice', 'Wie van ons stuurt de langste spraakberichten?'],
    ['wv-emoji', 'Wie van ons gebruikt de meeste emoji’s?'],
  ]),
];

/** Kind of question, by its id. */
export type QuestionKind = 'open' | 'quick' | 'scale' | 'who';
export const kindOf = (id: string): QuestionKind =>
  id.startsWith('tt-')
    ? 'quick'
    : id.startsWith('sc-')
      ? 'scale'
      : id.startsWith('wv-')
        ? 'who'
        : 'open';

/** The category of any question (custom ones are "own"). */
const BY_ID = new Map<string, Category>([
  ...STARTER_QUESTIONS.map((q) => [q.id, q.category] as const),
  ...THIS_OR_THAT.map((q) => [q.id, q.category] as const),
  ...SCALES.map((q) => [q.id, q.category] as const),
  ...WHO_OF_US.map((q) => [q.id, q.category] as const),
]);
export const categoryOf = (id: string): Category => BY_ID.get(id) ?? 'own';
