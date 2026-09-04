import type { WorldNpcDialogueContent } from './world-npc-dialogue-types';

export const SUNRISE_FOREST_DIALOGUE: Readonly<Record<string, WorldNpcDialogueContent>> = {
  'npc.gilt': {
    opening: [
      '歡迎來到晨光村！等等……今天的晨光是不是少了一點？',
      '我每天早上都會數三次，今天卻只數到兩次半。',
      '我現在有點拿不定主意。',
    ],
    choicePrompt: '你覺得我應該先做什麼？',
    choices: [
      { id: 'help-search', label: '幫你一起找晨光', response: '好勇敢！雖然我其實還沒想好要找什麼。' },
      { id: 'ask-half', label: '問問為什麼是兩次半', response: '因為我打了一個噴嚏，數到一半忘記了。' },
      { id: 'look-around', label: '先看看附近', response: '很好的想法，觀察可是很重要的能力。' },
    ],
    closing: [
      '歐姆和阿卡迪亞常常在村子裡到處玩，說不定牠們知道晨光藏在哪裡。',
      '看來你已經是晨光村的小幫手了。以後想找新夥伴或裝飾，記得再來找我。',
    ],
    repeat: [
      { id: 'gilt-completed-today', text: '我聽見村口的鐘聲了！這通常表示有人完成了一件不容易的事。', condition: 'completed_adventure_today' },
      { id: 'gilt-not-completed-today', text: '今天還沒有找到適合你的冒險嗎？沒關係，晨光不會催你。', condition: 'not_completed_adventure_today' },
      { id: 'gilt-oum-owned', text: '歐姆已經開始研究你家的每一個角落了。記得檢查床底下。', condition: 'owns_oum' },
      { id: 'gilt-arcadia-owned', text: '阿卡迪亞喜歡看遠方。牠說你家是目前最值得觀察的地方。', condition: 'owns_arcadia' },
      { id: 'gilt-sneeze', text: '我決定今天不打噴嚏，這樣數晨光時就不會又變成兩次半。' },
      { id: 'gilt-weather', text: '晨光村的天氣每天都不一樣，但我每天都會準時把門打開。' },
    ],
  },
  'npc.oum': {
    opening: [
      '你好，我是歐姆。我很喜歡晨光村，因為這裡每天都有新的東西可以發現。',
      '我最近正在收集亮晶晶的東西，目前已經有一片葉子、兩顆小石頭，還有一個不知道是什麼的圓形東西。',
      '我正在想，下一個應該找什麼才好。',
    ],
    choicePrompt: '你覺得我下一個應該找什麼？',
    choices: [
      { id: 'special-stone', label: '找一顆特別的石頭', response: '好主意！石頭通常比看起來更有故事。' },
      { id: 'pretty-leaf', label: '找一片漂亮的葉子', response: '葉子會隨著風旅行，聽起來很適合我。' },
      { id: 'mystery-item', label: '找一個神秘的東西', response: '神秘的東西最好了，但希望它不要突然打噴嚏。' },
    ],
    closing: [
      '吉爾特說你是晨光村的小幫手，我覺得他說得沒錯。',
      '如果你想要一個喜歡一起發現新東西的夥伴，可以再來找我。',
    ],
    repeat: [
      { id: 'oum-completed-today', text: '你今天看起來很有精神！一定是發現了什麼厲害的事。', condition: 'completed_adventure_today' },
      { id: 'oum-not-completed-today', text: '沒關係，今天也可以只走一小步。我會在這裡等你。', condition: 'not_completed_adventure_today' },
      { id: 'oum-owned', text: '原來我真的要跟你一起回家了！我會努力不把東西藏到奇怪的地方。', condition: 'owns_oum' },
      { id: 'oum-gilt', text: '吉爾特說他很會數晨光，但我覺得他只是很會數錯。' },
      { id: 'oum-button', text: '我找到一顆圓圓的東西。後來才發現，那是吉爾特的鈕扣。' },
      { id: 'oum-shiny', text: '我今天沒有找到亮晶晶的東西，所以我決定把自己的眼睛算進去。' },
    ],
  },
  'npc.arcadia': {
    opening: [
      '你好，我是阿卡迪亞。我喜歡看天空，也喜歡觀察來到晨光村的人。',
      '你有沒有發現，天空每天都不太一樣？',
      '每個人看到的天空，可能都不太一樣。',
    ],
    choicePrompt: '你覺得今天的天空比較像什麼？',
    choices: [
      { id: 'gold-sky', label: '像金色', response: '金色的天空通常代表今天會有好事情發生。' },
      { id: 'blue-sky', label: '像藍色', response: '藍色的天空很適合慢慢想事情。' },
      { id: 'not-noticed', label: '我還沒有注意', response: '那你下次可以抬頭看看，天空很喜歡被注意。' },
    ],
    closing: [
      '歐姆喜歡收集地上的東西，我喜歡收集天空的樣子。',
      '如果你想找一個喜歡安靜看風景的夥伴，可以再來找我。',
    ],
    repeat: [
      { id: 'arcadia-completed-today', text: '我看見一顆很亮的星星。也許它知道你今天完成了什麼。', condition: 'completed_adventure_today' },
      { id: 'arcadia-not-completed-today', text: '今天不用急著走很遠，有時候先抬頭看看，也是一個很好的開始。', condition: 'not_completed_adventure_today' },
      { id: 'arcadia-owned', text: '我很高興可以和你一起看風景。你家的天空一定也很漂亮。', condition: 'owns_arcadia' },
      { id: 'arcadia-oum', text: '歐姆說牠在收集亮晶晶的東西，但我覺得牠只是把東西藏起來。' },
      { id: 'arcadia-cloud', text: '我剛剛看到一朵像兔子的雲。過了一會兒，它變成了一顆馬鈴薯。' },
      { id: 'arcadia-sky', text: '天空不會把同一幅畫畫兩次，所以每次抬頭都值得看看。' },
    ],
  },
  'npc.moss': {
    opening: [
      '歡迎來到森語谷！我是莫斯，負責照顧這裡的小樹苗。',
      '森林裡的種子不會同一天發芽，但每天都在悄悄準備。',
      '我每天都在想，怎麼樣才能讓它們長得更健康。',
    ],
    choicePrompt: '你覺得照顧一件事情，最重要的是什麼？',
    choices: [
      { id: 'moss-small', label: '每天做一點', response: '這是最可靠的魔法，森林最喜歡這種魔法。' },
      { id: 'moss-rest', label: '需要時休息一下', response: '會休息的種子，才有力氣長出漂亮的葉子。' },
      { id: 'moss-start', label: '先從簡單的開始', response: '很好的方法，大樹也是從一顆小種子開始的。' },
    ],
    closing: [
      '如果你在谷裡遇到茉莉和齊福爾，記得跟牠們打聲招呼。',
      '你完成的每一次冒險，都會讓這片森林長出新的葉子。',
    ],
    repeat: [
      { id: 'moss-completed-today', text: '今天的森林比昨天多了一片新葉子，也許是你的冒險帶來的。', condition: 'completed_adventure_today' },
      { id: 'moss-not-completed-today', text: '種子不會催你長大，今天慢慢來也很好。', condition: 'not_completed_adventure_today' },
      { id: 'moss-jasmine-owned', text: '茉莉最近很會照顧花朵，只是偶爾會把花香帶到不該去的地方。', condition: 'owns_jasmine' },
      { id: 'moss-qifu-owned', text: '齊福爾說牠找到了一片幸運的葉子，我還在想要不要相信牠。', condition: 'owns_qifu_er' },
      { id: 'moss-tree', text: '我剛剛和一棵樹聊了很久，牠今天的回答是「沙沙沙」。' },
      { id: 'moss-seed', text: '有些努力看不見，但它們會藏在未來的葉子裡。' },
    ],
  },
  'npc.lunalia': {
    opening: [
      '你好，我是露娜莉亞。我喜歡在月光下照顧森語谷的水池。',
      '水面會記住天空的顏色，也會記住每個來到這裡的人。',
      '我很想知道，你今天最想留下哪一個瞬間。',
    ],
    choicePrompt: '如果你要把今天的一件事留在水面上，你會選什麼？',
    choices: [
      { id: 'lunalia-happy', label: '一件開心的事', response: '那它一定會變成一圈溫柔的波紋。' },
      { id: 'lunalia-brave', label: '一件勇敢的事', response: '勇敢的事情會在月光下閃閃發亮。' },
      { id: 'lunalia-small', label: '一件小小的事', response: '小事也值得被記住，星星就是一點一點亮起來的。' },
    ],
    closing: [
      '莫斯照顧種子，我照顧水面的月光，而你可以照顧自己的每一步。',
      '下次來到森語谷，也許水池會替你保留一圈新的波紋。',
    ],
    repeat: [
      { id: 'lunalia-completed-today', text: '今天的水面很亮，它好像知道你完成了一件事情。', condition: 'completed_adventure_today' },
      { id: 'lunalia-not-completed-today', text: '月亮有時被雲遮住，但它沒有消失。今天慢一點也沒關係。', condition: 'not_completed_adventure_today' },
      { id: 'lunalia-jasmine-owned', text: '茉莉的花香飄到水池邊，連月光都變得香香的。', condition: 'owns_jasmine' },
      { id: 'lunalia-qifu-owned', text: '齊福爾說牠在水裡看見幸運，我只看見牠自己的倒影。', condition: 'owns_qifu_er' },
      { id: 'lunalia-fountain', text: '水池今天說了很多話，可惜我只聽懂其中的「滴答」。' },
      { id: 'lunalia-moon', text: '如果不知道要往哪裡走，可以先看看月亮，再走一小步。' },
    ],
  },
  'npc.jasmine': {
    opening: [
      '你好，我是茉莉。我最喜歡森語谷裡清晨的花香。',
      '每一朵花都有自己的味道，有的甜甜的，有的像雨剛下過。',
      '我也想聽聽你覺得哪一種味道最特別。',
    ],
    choicePrompt: '你覺得我下一個應該認識什麼味道？',
    choices: [
      { id: 'jasmine-flower', label: '花朵的香味', response: '好選擇！花朵總是有很多秘密。' },
      { id: 'jasmine-leaf', label: '葉子的味道', response: '葉子聞起來像森林正在呼吸。' },
      { id: 'jasmine-rain', label: '雨後的味道', response: '我也喜歡！雨後的泥土會讓新的種子醒來。' },
    ],
    closing: [
      '莫斯說，只要每天照顧一點點，花朵就會記得你。',
      '如果你想找一個喜歡一起照顧小事的夥伴，可以再來找我。',
    ],
    repeat: [
      { id: 'jasmine-completed-today', text: '我聞到今天有一種特別的香味，可能是完成冒險的味道。', condition: 'completed_adventure_today' },
      { id: 'jasmine-not-completed-today', text: '今天還沒有開花也沒關係，花朵知道什麼時候才是適合的時間。', condition: 'not_completed_adventure_today' },
      { id: 'jasmine-owned', text: '原來我真的可以和你一起回家了！我會記得每天照顧一點點。', condition: 'owns_jasmine' },
      { id: 'jasmine-moss', text: '莫斯說我今天照顧花朵做得很好，我覺得是因為花朵自己很努力。' },
      { id: 'jasmine-scent', text: '我剛剛聞到一種很特別的味道，結果發現是自己的尾巴。' },
      { id: 'jasmine-grow', text: '小小的照顧累積起來，就會變成一座很漂亮的花園。' },
    ],
  },
  'npc.qifu-er': {
    opening: [
      '你好，我是齊福爾。我喜歡把好運藏在森語谷的小事情裡。',
      '一顆剛好落在腳邊的果實、一陣剛好吹來的風，都可能是森林送來的禮物。',
      '也許你能幫我選一種今天的好運。',
    ],
    choicePrompt: '你今天想找哪一種好運？',
    choices: [
      { id: 'qifu-er-found', label: '找到想找的東西', response: '那就從仔細看看身邊開始，好運常常躲在附近。' },
      { id: 'qifu-er-help', label: '遇到願意幫忙的人', response: '願意互相幫忙的時候，好運會變成兩份。' },
      { id: 'qifu-er-brave', label: '鼓起勇氣試一次', response: '這種好運最閃亮，因為它也需要你先踏出一步。' },
    ],
    closing: [
      '茉莉說花香能帶來好心情，我覺得她說得很有道理。',
      '如果你想找一個一起尋找小幸運的夥伴，可以再來找我。',
    ],
    repeat: [
      { id: 'qifu-er-completed-today', text: '你今天已經找到一份好運了，它的名字叫做「完成」。', condition: 'completed_adventure_today' },
      { id: 'qifu-er-not-completed-today', text: '好運有時候走得比較慢，今天等一等也沒有關係。', condition: 'not_completed_adventure_today' },
      { id: 'qifu-er-owned', text: '我決定把好運帶到你家，這樣我們每天都可以一起尋找。', condition: 'owns_qifu_er' },
      { id: 'qifu-er-moss', text: '莫斯撿到一片葉子，說它很幸運。我覺得只要是他撿到的都會被照顧得很好。' },
      { id: 'qifu-er-lucky', text: '我找到一顆幸運的小石頭，後來發現它只是普通的小石頭，但我還是喜歡它。' },
      { id: 'qifu-er-small', text: '有時候好運不會發光，只是剛好讓今天順利一點。' },
    ],
  },
};
