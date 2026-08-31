# HabitHero 產品架構圖

> 狀態：`[草稿]`。這是產品能力圖，不是目前 TypeScript 檔案的 import graph。

## 產品能力關係

```mermaid
flowchart TB
    PURPOSE[產品目的：讓孩子透過真實行動建立習慣]

    PURPOSE --> FAMILY[家庭關係]
    PURPOSE --> HABIT[習慣與冒險]
    PURPOSE --> GAME[遊戲回饋]
    PURPOSE --> STORY[劇情與世界]
    PURPOSE --> SOCIAL[好友與合作]

    FAMILY --> PARENT[家長端]
    FAMILY --> CHILD[孩子端]
    PARENT --> SET_GOAL[設定目標與冒險]
    PARENT --> REVIEW[審核完成結果]
    PARENT --> OBSERVE[查看成長]
    CHILD --> TODAY[查看今日冒險]
    CHILD --> SUBMIT[完成並回報]
    CHILD --> WORLD[探索自己的世界]

    HABIT --> SET_GOAL
    SET_GOAL --> TODAY
    TODAY --> SUBMIT
    SUBMIT --> REVIEW
    REVIEW --> LEDGER[點數與成長紀錄]

    LEDGER --> REWARD[獎勵與解鎖]
    REWARD --> WORLD
    REWARD --> STORY
    WORLD --> SOCIAL
    SOCIAL --> COOP[合作冒險]
    COOP --> HABIT
```

## 核心循環

```mermaid
flowchart LR
    A[家長設定任務] --> B[孩子執行真實行動]
    B --> C[孩子提交完成結果]
    C --> D[家長審核]
    D -->|通過| E[點數與進度更新]
    D -->|退回| B
    E --> F[取得遊戲回饋]
    F --> G[世界或劇情前進]
    G --> A
```

## 產品與技術邊界

```mermaid
flowchart TB
    CONTENT[產品內容定義]
    APP[React / Capacitor App]
    WORLD[Three.js 世界 Runtime]
    DATA[Supabase 資料與權限]
    PLATFORM[iOS / Android / Web]

    CONTENT --> APP
    APP --> WORLD
    APP --> DATA
    APP --> PLATFORM

    DATA --> STATE[玩家狀態、進度、點數、解鎖]
    DATA --> SOCIAL_DATA[好友、合作、聊天資料]
    CONTENT --> STORY_DATA[劇情、冒險、NPC、獎勵定義]
    STORY_DATA -. 不應和玩家狀態混為一談 .-> STATE
```

## 每次新增功能前要回答

- 它服務家長、孩子，還是好友？
- 它是否強化核心循環？
- 它是內容、規則、玩家狀態，還是畫面呈現？
- 它需要永久保存，還是可以由內容檔重新產生？
- 它是否會影響點數、VIP、隱私或孩子安全？
- 沒有這個功能，核心產品是否仍然成立？
