import type { WorldNpcDialogueContent } from './world-npc-dialogue-types';

export const CLOUD_TIDE_DIALOGUE: Readonly<Record<string, WorldNpcDialogueContent>> = {
  'npc.noah': {
    opening: [
      '歡迎來到雲工房！我是諾亞，這裡每個齒輪都為一件事情轉動。',
      '今天的專注風車轉得比平常慢一點，可能是它也需要休息。',
      '我很想聽聽你的實驗建議。',
    ],
    choicePrompt: '你覺得遇到卡住的事情時，應該怎麼做？',
    choices: [
      { id: 'noah-restart', label: '重新試一次', response: '重新開始不是回到原點，而是帶著剛才學到的東西再出發。' },
      { id: 'noah-help', label: '找人一起想', response: '好方法！兩個腦袋通常比一個腦袋更容易找到奇怪又有用的答案。' },
      { id: 'noah-rest', label: '先休息一下', response: '連機器都需要充電，休息也是讓想法重新轉動的方法。' },
    ],
    closing: [
      '尼布斯和奧利安常常在工房附近測試新發明，記得不要站在風口上。',
      '你的每一次嘗試，都會讓雲工房多一個新的好點子。',
    ],
    repeat: [
      { id: 'noah-completed-today', text: '今天的專注風車轉得很快，看來有人完成了一件重要的事。', condition: 'completed_adventure_today' },
      { id: 'noah-not-completed-today', text: '今天還沒有啟動引擎嗎？沒關係，先按下開始就已經很厲害了。', condition: 'not_completed_adventure_today' },
      { id: 'noah-nibus-owned', text: '尼布斯已經把我的工具箱當成自己的房間了，至少牠整理得比我好。', condition: 'owns_nibus' },
      { id: 'noah-orian-owned', text: '奧利安剛剛測試了一陣新風，結果把我的圖紙吹到了屋頂。', condition: 'owns_orian' },
      { id: 'noah-invention', text: '我發明了一台會提醒我休息的機器，結果它比我更早睡著了。' },
      { id: 'noah-gear', text: '小齒輪也很重要，少了一個，整座工房都會發現。' },
    ],
  },
  'npc.nibus': {
    opening: [
      '你好，我是尼布斯。我喜歡雲工房，因為這裡的雲摸起來都很柔軟。',
      '我每天都會觀察一朵雲，看看它今天像不像一個新的東西。',
      '我想聽聽你覺得雲最適合變成什麼。',
    ],
    choicePrompt: '你覺得雲最適合變成什麼？',
    choices: [
      { id: 'nibus-animal', label: '一隻動物', response: '好可愛！雲做的動物一定很適合在天空散步。' },
      { id: 'nibus-house', label: '一座房子', response: '那一定是一座很舒服的房子，床可以直接躺在雲裡。' },
      { id: 'nibus-anything', label: '什麼都可以', response: '我也這麼想！雲最厲害的地方就是還沒有決定。' },
    ],
    closing: [
      '諾亞說我常常把雲看太久，但我覺得慢慢看也是一種研究。',
      '如果你想要一個柔軟又願意陪你想像的夥伴，可以再來找我。',
    ],
    repeat: [
      { id: 'nibus-completed-today', text: '我找到一朵像勳章的雲，送給今天完成冒險的你。', condition: 'completed_adventure_today' },
      { id: 'nibus-not-completed-today', text: '今天的雲很柔軟，適合慢慢來，不用急著飛。', condition: 'not_completed_adventure_today' },
      { id: 'nibus-owned', text: '我真的要和你一起回家了！希望你家有一個適合看雲的位置。', condition: 'owns_nibus' },
      { id: 'nibus-noah', text: '諾亞又在找工具了，我猜它們可能藏在他的口袋裡。' },
      { id: 'nibus-cloud', text: '我剛剛看到一朵像諾亞的雲，但它看起來比諾亞更會休息。' },
      { id: 'nibus-soft', text: '有時候把事情想得柔軟一點，就比較容易找到下一步。' },
    ],
  },
  'npc.orian': {
    opening: [
      '你好，我是奧利安。我負責把雲工房的風送到正確的地方。',
      '風看不見，但它會留下方向。只要仔細感覺，就知道它從哪裡來。',
      '我想知道你會用什麼方式開始一段探索。',
    ],
    choicePrompt: '如果你要出發探索，你會怎麼開始？',
    choices: [
      { id: 'orian-slow', label: '先慢慢看看', response: '很好的開始，知道身邊有什麼，才能知道要往哪裡走。' },
      { id: 'orian-route', label: '選一條新路', response: '新路不一定比較近，但通常會遇到新的故事。' },
      { id: 'orian-guide', label: '找人一起走', response: '有夥伴的風會更穩，也更容易一起回到家。' },
    ],
    closing: [
      '尼布斯喜歡看雲，我喜歡追風，我們都知道雲工房每天都會有新方向。',
      '如果你想要一個喜歡一起探索的夥伴，可以再來找我。',
    ],
    repeat: [
      { id: 'orian-completed-today', text: '我看見一陣向上的風，那是完成冒險的人才會遇到的風。', condition: 'completed_adventure_today' },
      { id: 'orian-not-completed-today', text: '風還在這裡，等你準備好再出發。', condition: 'not_completed_adventure_today' },
      { id: 'orian-owned', text: '我會把最舒服的風帶到你家，讓我們一起找到新的方向。', condition: 'owns_orian' },
      { id: 'orian-nibus', text: '尼布斯說今天的雲像一艘船，我覺得比較像一隻打瞌睡的魚。' },
      { id: 'orian-route', text: '我今天走了一條新路，最後發現它通往諾亞的工具箱。' },
      { id: 'orian-wind', text: '看不見的努力也會留下方向，慢慢走就會知道。' },
    ],
  },
  'npc.collette': {
    opening: [
      '歡迎來到潮光群島！我是柯蕾特，負責照看這裡的潮汐和航線。',
      '海水每天都會來來回回，退潮不是失敗，而是在準備下一次前進。',
      '我想聽聽你出發前最重視的準備。',
    ],
    choicePrompt: '如果你要出發旅行，會先準備什麼？',
    choices: [
      { id: 'collette-map', label: '一張地圖', response: '好選擇！知道自己在哪裡，就比較不容易在海上迷路。' },
      { id: 'collette-courage', label: '一點勇氣', response: '勇氣不需要很大，一點點就能讓船離開岸邊。' },
      { id: 'collette-snack', label: '好吃的點心', response: '非常重要！探索世界的時候，肚子也需要被照顧。' },
    ],
    closing: [
      '克里斯多很熟悉潮池裡的小路，說不定牠能帶你看到海邊的秘密。',
      '只要願意往前一點點，每一次冒險都能帶你看見新的海岸。',
    ],
    repeat: [
      { id: 'collette-completed-today', text: '今天的潮水正在往前，和完成冒險的你一樣。', condition: 'completed_adventure_today' },
      { id: 'collette-not-completed-today', text: '海浪不會每次都很大，今天從一個小小的浪花開始也很好。', condition: 'not_completed_adventure_today' },
      { id: 'collette-christo-owned', text: '克里斯多把潮池當成自己的秘密基地了，牠邀請你一起參觀。', condition: 'owns_christo' },
      { id: 'collette-map', text: '我今天畫了一張新的地圖，結果發現上面有一個地方叫「點心桌」。' },
      { id: 'collette-tide', text: '潮水來了又走，重要的是我們知道它還會再回來。' },
      { id: 'collette-sea', text: '每一段航程都有休息的港口，不需要一直往前衝。' },
    ],
  },
  'npc.christo': {
    opening: [
      '你好，我是克里斯多。我最喜歡潮光群島的潮池，裡面每天都有新的小發現。',
      '有時候是一顆漂亮的石頭，有時候是一道只出現一下子的彩色水光。',
      '我想聽聽你最想先發現哪一種海邊寶物。',
    ],
    choicePrompt: '你想先看看哪一種海邊的寶物？',
    choices: [
      { id: 'christo-shell', label: '漂亮的貝殼', response: '貝殼會把海浪的聲音藏在裡面，記得仔細聽。' },
      { id: 'christo-stone', label: '奇怪的石頭', response: '奇怪的石頭最有趣，因為它們通常有一段旅行故事。' },
      { id: 'christo-water', label: '彩色水光', response: '那要快一點，水光很害羞，不會停留太久。' },
    ],
    closing: [
      '柯蕾特說海邊最重要的是保持好奇，我覺得她說得很對。',
      '如果你想找一個一起發現小寶物的夥伴，可以再來找我。',
    ],
    repeat: [
      { id: 'christo-completed-today', text: '我找到一顆像星星的石頭，送給今天完成冒險的你。', condition: 'completed_adventure_today' },
      { id: 'christo-not-completed-today', text: '潮池今天很安靜，適合先看看，再決定要不要往前走。', condition: 'not_completed_adventure_today' },
      { id: 'christo-owned', text: '我想把潮池裡最好看的水光帶給你，當作一起回家的禮物。', condition: 'owns_christo' },
      { id: 'christo-collette', text: '柯蕾特又畫了一張地圖，這次把我畫成了三角形。' },
      { id: 'christo-shell', text: '我找到一個貝殼，裡面沒有海浪，只有一個很小的哈欠。' },
      { id: 'christo-tidepool', text: '小小的潮池裡，也可以看見很大的海。' },
    ],
  },
};
