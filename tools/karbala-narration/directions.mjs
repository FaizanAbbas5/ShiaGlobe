// How particular lines are read: ‖ = a pause, *words* = stressed, lead = silence before the line (seconds).
// Each entry finds an exact phrase in a narration line (names as the app marks them, e.g. ⟦hussain⟧) and rewrites it for speech only;
// the recording is still filed under the line's own text. General rules (dates, colons, quotes) are in speak.mjs.
export const DIRECTIONS = [
  ['in Rajab 60 A H and his son', 'in Rajab 60 A H, ‖ and his son'],
  ['"A man like me does not pledge allegiance to a man like him."', '"A man like *me* ‖ does not pledge allegiance ‖ to a man like *him*."'],
  ['"Their hearts are with you, but their swords are with Banu Umayya."', '"Their *hearts* are with you, ‖ but their *swords* are with Banu Umayya."'],
  ['Those who had come with him from Medina stayed.', 'Those who had come with him from Medina ‖ *stayed*.', .3],
  ['to water them all, men and horses alike.', 'to water them all, ‖ men and horses alike.'],
  ['here their mounts would kneel, and here their blood would be shed.', 'here their mounts would kneel, ‖ and here their blood would be shed.'],
  ['asked its name and was told ⟦karbala⟧.', 'asked its name, ‖ and was told: *⟦karbala⟧*.'],
  ['The tents were pitched.', 'The tents were pitched.', .3],
  ['For three days the camp, children included, went without water.', 'For three days, ‖ the camp, children included, ‖ went without water.'],
  ['Now imagine three days in the desert heat.', 'Now imagine *three days* ‖ in the desert heat.'],
  ['the enemy wanted only him.', 'the enemy wanted *only him*.'],
  ['He had the lamps put out so that anyone could slip away unseen.', 'He had the lamps put out, ‖ so that anyone could slip away unseen.'],
  ['None did.', '*None did.*', .6],
  ['"You are al-⟦hurr⟧, free, as your mother named you: free in this world and in the Hereafter."', '"You are al-⟦hurr⟧, ‖ *free*, as your mother named you: ‖ *free* in this world, ‖ and in the Hereafter."'],
  ['fell by the river, trying to bring water', 'fell by the river, ‖ trying to bring water'],
  ['By the time of Asr, ⟦hussain⟧ stood alone.', 'By the time of Asr, ‖ ⟦hussain⟧ stood *alone*.', .4],
  ['Imam al-⟦hussain⟧ ⟦ibn⟧ Ali, peace be upon him. Grandson', 'Imam al-⟦hussain⟧ ⟦ibn⟧ Ali, peace be upon him. ‖ Grandson', .5],
  ['was killed, thirsty, on the plain of ⟦karbala⟧, having refused to the last to give his hand to ⟦yazid⟧.', '‖ was killed, ‖ thirsty, ‖ on the plain of ⟦karbala⟧, ‖ having refused to the last ‖ to give his hand to ⟦yazid⟧.', .4],
  ['returned to the tents without its rider, and the women knew', 'returned to the tents without its rider, ‖ and the women knew'],
  ['"I see death as nothing but happiness, and life with oppressors as nothing but misery."', '"I see death as nothing but *happiness*, ‖ and life with oppressors ‖ as nothing but *misery*."'],
  ['On the evening of ⟦ashura⟧ the camp', 'On the evening of ⟦ashura⟧, ‖ the camp'],
  ['spent the night in the open.', '‖ spent the night in the open.'],
  ['remembered as Shaam-e Ghareebaan, the evening', 'remembered as Shaam-e Ghareebaan, ‖ the evening'],
  ['She replied: "I saw nothing but beauty."', 'She replied: ‖ "I saw nothing but *beauty*."', .3],
  ['So weep much, and laugh little.', 'So weep *much*, ‖ and laugh *little*.'],
  ['So plot your plots, strive your utmost, spare no effort:', 'So plot your plots, ‖ strive your utmost, ‖ spare no effort:'],
  ['by God, you will never erase our remembrance, nor kill our revelation.', 'by God, ‖ you will *never* erase our remembrance, ‖ nor kill our revelation.'],
  ['Is your judgement anything but folly, your days anything but numbered, your gathering anything but scattered?', 'Is your judgement anything but *folly*, ‖ your days anything but *numbered*, ‖ your gathering anything but *scattered*?'],
  ['the first pilgrim of ⟦arbaeen⟧.', 'the first pilgrim of ⟦arbaeen⟧.', .2],
  ['Today ⟦arbaeen⟧ draws millions', 'Today, ‖ ⟦arbaeen⟧ draws *millions*'],
];

// the line as it should be read, and any silence before it
export function directed(say) {
  let text = say, lead = 0;
  for (const [find, rep, ld] of DIRECTIONS) if (text.includes(find)) { text = text.replace(find, rep); if (ld) lead = Math.max(lead, ld); }
  return { text, lead };
}
