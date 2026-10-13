// How each name is said, in the phonetic alphabet Kokoro speaks (stress mark before the stressed vowel).
// Marked in the text as ⟦id⟧ by the app's narration script; everything else is phonemized normally.
export const NAME_IPA = {
  yazid: 'jəzˈiːd', muawiya: 'mʊˈɑːwɪjə', hussain: 'hʊsˈɛn', zaynab: 'zˈeɪnəb', sayyida: 'sˈeɪjɪdə',
  abbas: 'ɐbˈɑːs', abidin: 'zˈeɪn ʊl ˌɑːbɪdˈiːn', akbar: 'ˈɑːli ˈækbɐɹ', qasim: 'æl kˈɑːsɪm', aqil: 'ɐkˈiːl',
  ziyad: 'zɪjˈɑːd', ubaydullah: 'ʊbˌeɪdʊlˈɑː', hurr: 'hˈʊɹ', zuhayr: 'zʊhˈɛɹ', qayn: 'æl kˈeɪn', farazdaq: 'fɐɹˈæzdæk',
  jabir: 'dʒˈɑːbɪɹ', kufa: 'kˈuːfə', karbala: 'kˈɑːɹbəlɑː', ashura: 'ɑːʃˈuːɹɑː', muharram: 'mʊhˈʌɹəm',
  arbaeen: 'ɑːɹbəˈiːn', zuljanah: 'zʊldʒɐnˈɑː', said: 'sɐˈiːd', saad: 'sˈɑːd', zarud: 'zɐɹˈuːd', zubala: 'zʊbˈɑːlə',
  thalabiyya: 'θɐlɐbˈiːjə',
  // further names, marked by the generator itself
  medina: 'mɛdˈiːnə', imam: 'ɪmˈɑːm', muslim: 'mˈʊslɪm', hasan: 'hˈæsən', iraq: 'ɪɹˈɑːk', hejaz: 'hɪdʒˈɑːz', kaaba: 'kˈɑːbə',
  quran: 'kʊɹˈɑːn', adhan: 'ɐðˈɑːn', shaban: 'ʃɐbˈɑːn', umra: 'ˈʊmɹə', mina: 'mˈiːnə', hajj: 'hˈædʒ', ibn: 'ˈɪbn',
  burayr: 'bʊɹˈeɪɹ', khudayr: 'kʊdˈeɪɹ', habib: 'hɐbˈiːb', muzahir: 'mʊzˈɑːhɪɹ', wahb: 'wˈɑːb', thumama: 'θʊmˈɑːmə',
  saidi: 'æs sɑːˈiːdi', nafi: 'nˈɑːfi', hilal: 'hɪlˈɑːl', abis: 'ˈɑːbɪs', shabib: 'ʃɐbˈiːb', shakiri: 'æʃ ʃˈɑːkɪɹi',
  jawn: 'dʒˈaʊn', awn: 'ˈaʊn', abdullah: 'ɐbdʊlˈɑː', atiyya: 'ɐtˈiːjə', awfi: 'æl ˈaʊfi', ansari: 'æl ænsˈɑːɹi',
  walid: 'æl wɐlˈiːd', utba: 'ˈʊtbə', zubayr: 'æz zʊbˈeɪɹ', yaqtur: 'jɐktˈuːɹ', hani: 'hˈɑːni', urwa: 'ˈʊɹwə',
  shabath: 'ʃˈæbæθ', ribi: 'ɹˈɪbi', hajjar: 'hɐdʒˈɑːɹ', abjar: 'ˈæbdʒɐɹ', amr: 'ˈæmɹ', hajjaj: 'æl hɐdʒˈɑːdʒ',
  umayya: 'bˈɑːnuː ʊmˈæjə', riyahi: 'æɹ ɹɪjˈɑːhi', kalbi: 'æl kˈælbi', awsaja: 'ˈaʊsædʒə', hanafi: 'æl hˈænæfi',
  ali: 'ɐlˈiː', saffah: 'æs sæfˈɑː', sharaf: 'ʃˈæɹæf', baydha: 'æl bˈeɪdə', muqatil: 'mʊkˈɑːtɪl', zayn: 'zˈeɪn',
  rajab: 'ɹˈædʒæb', safar: 'sˈæfɐɹ', hijja: 'ðʊl hˈɪdʒə', ghariban: 'ʃˈɑːm ɛ ɡɐɹiːbˈɑːn', umar: 'ˈʊmɐɹ',
  ah: 'ˈeɪ ˈeɪtʃ', none: 'nˈʌn', al: 'æl', asr: 'ˈæsəɹ', qasr: 'kˈæsɹ', bani: 'bˈæni', abu: 'ɐbˈuː', abi: 'ɐbˈiː', dharr: 'ðˈæɹ', ghifari: 'æl ɡɪfˈɑːɹi',
  asghar: 'æl ˈæsɡɐɹ', muhammad: 'mʊhˈæməd', umayyad: 'ʊmˈaɪjæd', kufans: 'kˈuːfənz', kufan: 'kˈuːfən', karb: 'kˈɑːɹb', balaa: 'bɐlˈɑː',
};
// Plain words in the narration that should be said a particular way; applied before phonemizing.
export const WORD_MARKS = [
  [/\bMedina\b/g, 'medina'], [/\bImam\b/g, 'imam'], [/\bMuslim\b/g, 'muslim'], [/\bal-Hasan\b|\bHasan\b/g, 'hasan'], [/\bIraq\b/g, 'iraq'],
  [/\bHejaz\b/g, 'hejaz'], [/\bKaaba\b/g, 'kaaba'], [/\bQuran\b/g, 'quran'], [/\bShaabaan\b/g, 'shaban'], [/\bUmra\b/g, 'umra'],
  [/\bMina\b/g, 'mina'], [/\bHajj\b/g, 'hajj'], [/\b[Ii]bn\b/g, 'ibn'], [/\bBurayr\b/g, 'burayr'], [/\bKhudayr\b/g, 'khudayr'],
  [/\bHabib\b/g, 'habib'], [/\bMuzahir\b/g, 'muzahir'], [/\bWahb\b/g, 'wahb'], [/\bThumama\b/g, 'thumama'], [/\bal-Saidi\b/g, 'saidi'],
  [/\bNafi\b/g, 'nafi'], [/\bHilal\b/g, 'hilal'], [/\bAbis\b/g, 'abis'], [/\bShabib\b/g, 'shabib'], [/\bal-Shakiri\b/g, 'shakiri'],
  [/\bJawn\b/g, 'jawn'], [/\bAwn\b/g, 'awn'], [/\bAbdullah\b/g, 'abdullah'], [/\bAtiyya\b/g, 'atiyya'], [/\bal-Awfi\b/g, 'awfi'],
  [/\bal-Ansari\b/g, 'ansari'], [/\bal-Walid\b/g, 'walid'], [/\bUtba\b/g, 'utba'], [/\bal-Zubayr\b/g, 'zubayr'], [/\bYaqtur\b/g, 'yaqtur'],
  [/\bHani\b/g, 'hani'], [/\bUrwa\b/g, 'urwa'], [/\bShabath\b/g, 'shabath'], [/\bRibi\b/g, 'ribi'], [/\bHajjar\b/g, 'hajjar'],
  [/\bAbjar\b/g, 'abjar'], [/\bAmr\b/g, 'amr'], [/\bal-Hajjaj\b/g, 'hajjaj'], [/\bBanu Umayya\b/g, 'umayya'], [/\bal-Riyahi\b/g, 'riyahi'],
  [/\bal-Kalbi\b/g, 'kalbi'], [/\bAwsaja\b/g, 'awsaja'], [/\bal-Hanafi\b/g, 'hanafi'], [/\bAli\b/g, 'ali'], [/\bal-Saffah\b/g, 'saffah'],
  [/\bSharaf\b/g, 'sharaf'], [/\bal-Baydha\b/g, 'baydha'], [/\bMuqatil\b/g, 'muqatil'], [/\bRajab\b/g, 'rajab'], [/\bSafar\b/g, 'safar'],
  [/\bDhul Hijja\b/g, 'hijja'], [/\bShaam-e Ghareebaan\b/g, 'ghariban'], [/\bUmar\b/g, 'umar'],
  [/\bA H\b/g, 'ah'], [/\bNone\b/g, 'none'], [/\bAsr\b/g, 'asr'], [/\bQasr\b/g, 'qasr'], [/\bBani\b/g, 'bani'], [/\bAbu\b/g, 'abu'], [/\bAbi\b/g, 'abi'],
  [/\bDharr\b/g, 'dharr'], [/\bal-Ghifari\b/g, 'ghifari'], [/\bal-Asghar\b/g, 'asghar'], [/\bMuhammad\b/g, 'muhammad'], [/\bUmayyad\b/g, 'umayyad'],
  [/\bKufans\b/g, 'kufans'], [/\bKufan\b/g, 'kufan'], [/\bkarb\b/g, 'karb'], [/\bbalaa\b/g, 'balaa'], [/\badhan\b/g, 'adhan'],
  // 'al-' joined to a name the app has already marked
  [/\bal-(?=⟦)/g, 'al'],
];
