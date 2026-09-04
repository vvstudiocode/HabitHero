import type { WorldNpcDialogueContent } from './world-npc-dialogue-types';

export const STAR_SAND_DIALOGUE: Readonly<Record<string, WorldNpcDialogueContent>> = {
  'npc.violette': {
    opening: [
      '歡迎來到星砂荒原！我是薇歐莉特，負責保管這裡的星光故事。',
      '每一粒星砂都像一本很小的書，記錄著某個人曾經努力走過的路。',
      '我想把你的答案記進今天的故事裡。',
    ],
    choicePrompt: '如果你累了，你會用什麼方式讓自己重新有力氣？',
    choices: [
      { id: 'violette-read', label: '讀一個故事', response: '故事會提醒我們，前面的人也曾經走得很慢。' },
      { id: 'violette-ask', label: '找人聊一聊', response: '把心裡的事情說出來，通常就不會那麼重了。' },
      { id: 'violette-stars', label: '看看星星', response: '很好，星星雖然很遠，卻總是願意陪人安靜一會兒。' },
    ],
    closing: [
      '卡爾多喜歡追著星星走，莫可則喜歡在星砂底下找安靜的地方。',
      '你的每一段冒險，也會成為星砂荒原裡值得收藏的故事。',
    ],
    repeat: [
      { id: 'violette-completed-today', text: '我今天收到一粒新的星砂，它記錄著你完成冒險的光。', condition: 'completed_adventure_today' },
      { id: 'violette-not-completed-today', text: '故事不會因為今天讀得慢就結束，休息一下也可以。', condition: 'not_completed_adventure_today' },
      { id: 'violette-kaldo-owned', text: '卡爾多又找到一條新的星路，這次它沒有迷路太久。', condition: 'owns_kaldo' },
      { id: 'violette-moko-owned', text: '莫可在我的書架旁邊找到一個陰涼的位置，牠說那裡很適合讀書。', condition: 'owns_moko' },
      { id: 'violette-book', text: '我今天整理了一本書，書名是《如何整理一本書》。' },
      { id: 'violette-stars', text: '星星不會催促彼此，所以我們也不用急著和別人比較。' },
    ],
  },
  'npc.kaldo': {
    opening: [
      '你好，我是卡爾多。我喜歡在星砂荒原追蹤星星留下的路。',
      '星星不會直接告訴你答案，但它們會讓你知道天空還有很多方向。',
      '我想知道你會選哪一顆星星出發。',
    ],
    choicePrompt: '如果要選一顆星星出發，你會選哪一顆？',
    choices: [
      { id: 'kaldo-bright', label: '最亮的那顆', response: '亮的星星很適合當作第一個方向。' },
      { id: 'kaldo-far', label: '最遠的那顆', response: '很有勇氣！遠方的星星通常藏著很棒的故事。' },
      { id: 'kaldo-lost', label: '好像迷路的那顆', response: '那可能是它正在找一個願意陪它走的人。' },
    ],
    closing: [
      '薇歐莉特會把我們找到的星路寫進故事裡，莫可則會在旁邊打瞌睡。',
      '如果你想找一個一起看星星、一起找方向的夥伴，可以再來找我。',
    ],
    repeat: [
      { id: 'kaldo-completed-today', text: '我看見你的星路亮了一下，那一定是完成冒險留下的光。', condition: 'completed_adventure_today' },
      { id: 'kaldo-not-completed-today', text: '今天找不到方向也沒關係，先抬頭看看，星星還在。', condition: 'not_completed_adventure_today' },
      { id: 'kaldo-owned', text: '我會陪你一起看星星，也會記得不要把你的家認成荒原。', condition: 'owns_kaldo' },
      { id: 'kaldo-violette', text: '薇歐莉特說我走路的路線很像一個問號，我覺得那代表我很有想法。' },
      { id: 'kaldo-moko', text: '莫可說星砂底下有一座花園，但牠每次都在說到一半睡著。' },
      { id: 'kaldo-trail', text: '方向不一定要一次決定，走幾步之後再看看也可以。' },
    ],
  },
  'npc.moko': {
    opening: [
      '你好，我是莫可。我喜歡星砂荒原，因為沙子底下藏著一座安靜的小花園。',
      '那裡的星砂會讓小小的蘑菇發光，但它們只在有人耐心等待時出現。',
      '我想聽聽你覺得什麼能讓一件事情慢慢長大。',
    ],
    choicePrompt: '你覺得讓一件事情慢慢長大，需要什麼？',
    choices: [
      { id: 'moko-light', label: '一點光', response: '光可以讓我們看見下一步，這很重要。' },
      { id: 'moko-water', label: '一點照顧', response: '沒錯，被好好照顧的事情，會慢慢變得更有力量。' },
      { id: 'moko-patience', label: '一點耐心', response: '最重要的答案！有些好事情就是需要慢慢等。' },
    ],
    closing: [
      '卡爾多負責找星星，薇歐莉特負責寫故事，我負責提醒大家不要踩到小蘑菇。',
      '如果你想找一個願意陪你慢慢成長的夥伴，可以再來找我。',
    ],
    repeat: [
      { id: 'moko-completed-today', text: '今天有一朵小蘑菇亮了起來，它知道你完成了一件事。', condition: 'completed_adventure_today' },
      { id: 'moko-not-completed-today', text: '小蘑菇今天還沒發光，但它正在準備。你也可以慢慢來。', condition: 'not_completed_adventure_today' },
      { id: 'moko-owned', text: '我想把一小片星砂花園帶到你家，陪你一起慢慢長大。', condition: 'owns_moko' },
      { id: 'moko-kaldo', text: '卡爾多又迷路了，但他說那是一次很有創意的繞路。' },
      { id: 'moko-violette', text: '薇歐莉特讀書的時候很安靜，只有翻頁聲會把我叫醒。' },
      { id: 'moko-mushroom', text: '有些事情看起來沒有變，其實正在地下努力。' },
    ],
  },
};
