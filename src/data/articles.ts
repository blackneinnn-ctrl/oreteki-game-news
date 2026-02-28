export interface Article {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  imageUrl: string;
  content: string;
  tags: string[];
  views: number;
  featured?: boolean;
}

export const articles: Article[] = [
  {
    id: 1,
    slug: "switch2-officially-announced",
    title: "【速報】任天堂、ついに『Nintendo Switch 2』を正式発表！！スペックがヤバすぎるwwwww",
    excerpt: "任天堂がついにSwitch後継機を公式発表。噂されていたスペックが全部本当だった模様。",
    author: "管理人",
    publishedAt: "2026-02-28",
    imageUrl: "https://picsum.photos/seed/switch2news/1200/630",
    content: `<p>任天堂は本日、Nintendo Switchの後継機となる「Nintendo Switch 2」を正式に発表した。</p>
<h2>気になるスペック</h2>
<p>NVIDIAの最新カスタムチップ搭載で、携帯モードでもPS5並みのグラフィックを実現するらしい。8インチ有機ELディスプレイに、内蔵ストレージは256GB。これはガチでヤバい。</p>
<h2>ネットの反応</h2>
<p>「まじかよ、予約開始いつだ」<br>「スペックおばけじゃん」<br>「ゼルダのローンチタイトル頼む」<br>「携帯機でPS5級って時代すごいな」<br>「財布が持たない」</p>
<p>発売は2026年秋を予定。価格は未定だが、4万円台後半との情報もある。続報が入り次第お届けする。</p>`,
    tags: ["Nintendo Switch", "任天堂", "ハードウェア"],
    views: 250000,
    featured: true,
  },
  {
    id: 2,
    slug: "elden-ring-sequel-leak",
    title: "【リーク】フロム・ソフトウェアの新作、『エルデンリング』の続編ではなく完全新規IPだった！！",
    excerpt: "フロムの次回作はソウル系でもエルデンでもない、まったく新しいジャンルに挑戦する模様。",
    author: "管理人",
    publishedAt: "2026-02-27",
    imageUrl: "https://picsum.photos/seed/fromnewip/1200/630",
    content: `<p>フロム・ソフトウェアの宮崎英高ディレクターが海外メディアのインタビューで、次回作について衝撃の発言をした。</p>
<h2>「死にゲーではない」</h2>
<p>宮崎氏いわく、「同じことを繰り返すのはクリエイターとして敗北」とのこと。次回作は高難度アクションRPGではなく、全く新しいジャンルに挑戦するらしい。</p>
<h2>ネットの反応</h2>
<p>「フロムが死にゲーやめるとか信じられん」<br>「でもフロムなら何作っても面白いだろ」<br>「まさかのほのぼの牧場ゲー来たら笑う」<br>「宮崎さんが作るなら何でも買う」<br>「結局難しいんでしょ？知ってる」</p>
<p>正式発表は今年中に行われるとの見方が強い。</p>`,
    tags: ["フロム・ソフトウェア", "リーク", "新作"],
    views: 198000,
    featured: true,
  },
  {
    id: 3,
    slug: "steam-sale-best-games",
    title: "Steamウィンターセールで買うべきゲーム20選がこちらwww 全部合わせても5000円以下",
    excerpt: "年に一度の大セール、おすすめタイトルをまとめてみた。",
    author: "管理人",
    publishedAt: "2026-02-26",
    imageUrl: "https://picsum.photos/seed/steamsale/1200/630",
    content: `<p>Steamウィンターセールが本日開始！ 今回も大量のゲームが割引対象になっている。</p>
<h2>おすすめ20選</h2>
<p>1. Hollow Knight - 80%OFF（¥308）<br>2. Hades - 75%OFF（¥620）<br>3. Stardew Valley - 60%OFF（¥592）<br>4. Celeste - 75%OFF（¥495）<br>5. Terraria - 50%OFF（¥490）</p>
<p>...他15本は記事内で紹介中。全部買っても5000円切ります。</p>
<h2>ネットの反応</h2>
<p>「毎回セールで買って積むだけなんだが」<br>「Hollow Knightこの値段は犯罪」<br>「ライブラリが肥大化していく...」<br>「結局セール関係なく買うよね」</p>`,
    tags: ["Steam", "セール", "PC"],
    views: 156000,
    featured: true,
  },
  {
    id: 4,
    slug: "monster-hunter-wilds-sales",
    title: "『モンハンワイルズ』、発売3日で全世界1000万本突破！！カプコン株も爆上げ",
    excerpt: "モンスターハンター最新作が歴代最速で1000万本を突破。シリーズ最高記録を大幅更新。",
    author: "管理人",
    publishedAt: "2026-02-25",
    imageUrl: "https://picsum.photos/seed/mhwilds2/1200/630",
    content: `<p>カプコンは本日、『モンスターハンター ワイルズ』の全世界累計出荷本数が1000万本を突破したと発表した。発売からわずか3日での達成となる。</p>
<h2>前作を大幅に上回るペース</h2>
<p>前作『モンスターハンター：ワールド』が1000万本に到達するまでに約1ヶ月かかったことを考えると、驚異的なペースと言える。</p>
<h2>ネットの反応</h2>
<p>「モンハンは化物コンテンツ」<br>「サーバー落ちまくったのも納得の数字」<br>「カプコン株買っておけばよかった」<br>「マルチで遊ぶの楽しすぎる」<br>「ワールドの記録抜くの早すぎんだろ」</p>`,
    tags: ["モンスターハンター", "カプコン", "PS5"],
    views: 187000,
  },
  {
    id: 5,
    slug: "ps5-pro-worth-buying",
    title: "PS5 Pro、結局買う価値あるの？ 3ヶ月使ってみた正直な感想がこちら",
    excerpt: "PS5 Proを発売日に買って3ヶ月。正直に言うとうーんという気持ちも...",
    author: "管理人",
    publishedAt: "2026-02-24",
    imageUrl: "https://picsum.photos/seed/ps5proreview/1200/630",
    content: `<p>PS5 Proを発売日に購入して3ヶ月が経った。正直な感想を書く。</p>
<h2>良かった点</h2>
<p>4K/120fpsの安定感は素晴らしい。対応タイトルでは明確に違いが分かる。ロード時間も体感で速くなっている。</p>
<h2>微妙だった点</h2>
<p>正直、通常PS5との差が分かりにくいゲームも多い。価格差を考えると万人におすすめとは言えない。</p>
<h2>ネットの反応</h2>
<p>「4Kテレビ持ってない人には意味ないよな」<br>「金持ちの道楽」<br>「対応タイトル増えたらまた評価変わりそう」<br>「通常PS5で十分派のワイ、高みの見物」</p>`,
    tags: ["PS5", "レビュー", "ハードウェア"],
    views: 134000,
  },
  {
    id: 6,
    slug: "indie-game-hollow-depths",
    title: "一人で6年かけて作ったインディーゲームがSteamで「圧倒的に好評」を獲得してしまうwww",
    excerpt: "個人開発のメトロイドヴァニアが120時間超えのボリュームで大絶賛。",
    author: "管理人",
    publishedAt: "2026-02-23",
    imageUrl: "https://picsum.photos/seed/hollowdepths2/1200/630",
    content: `<p>たった一人の開発者が6年をかけて制作したメトロイドヴァニア『Hollow Depths』が、Steamで「圧倒的に好評」を獲得した。</p>
<h2>120時間超えのボリューム</h2>
<p>メインストーリーだけで40時間、サブクエストや隠しエリアを含めると120時間以上のプレイ時間が報告されている。インディーゲームの概念を覆すボリューム。</p>
<h2>ネットの反応</h2>
<p>「一人で作ったとか嘘だろ...」<br>「Hollow Knightリスペクトらしいけど完全に超えてる」<br>「6年の執念が生んだ傑作」<br>「このクオリティで2000円は安すぎ」<br>「大手メーカーは見習って」</p>`,
    tags: ["Steam", "インディー", "PC"],
    views: 112000,
  },
  {
    id: 7,
    slug: "zelda-new-game-teaser",
    title: "【動画あり】『ゼルダの伝説』完全新作のティザー映像が公開！！ 舞台は海底世界か！？",
    excerpt: "Nintendo Directで公開されたゼルダ新作の映像を徹底分析。",
    author: "管理人",
    publishedAt: "2026-02-22",
    imageUrl: "https://picsum.photos/seed/zeldanew/1200/630",
    content: `<p>本日放送されたNintendo Directにて、ゼルダの伝説シリーズの完全新作がティザー映像と共に発表された。</p>
<h2>海底世界が舞台？</h2>
<p>ティザー映像ではこれまでのシリーズにはなかった幻想的な海底世界が映し出されていた。青沼プロデューサーは「オープンエアの先にあるもの」とコメント。</p>
<h2>ネットの反応</h2>
<p>「海底ゼルダとか最高かよ」<br>「Switch 2のローンチに合わせてくるんだろうな」<br>「ティアキンの続きかと思ったら新規IPかよ！」<br>「青沼さんの『まだ一部しか描けていない』って台詞が激アツ」<br>「2027年まで待てない...」</p>`,
    tags: ["ゼルダの伝説", "任天堂", "Nintendo Switch"],
    views: 203000,
  },
  {
    id: 8,
    slug: "ai-game-music-future",
    title: "ゲーム音楽の作曲家3人に聞いた「AIに仕事を奪われると思いますか？」 → 意外な回答がこちら",
    excerpt: "植松伸夫氏ら3名の作曲家がAIとゲーム音楽の未来について語った。",
    author: "管理人",
    publishedAt: "2026-02-21",
    imageUrl: "https://picsum.photos/seed/aigamemusic/1200/630",
    content: `<p>AIの急速な進化によって「作曲家の仕事がなくなるのでは」という議論が活発化している。実際のところどうなのか、ゲーム音楽のトップクリエイター3名に聞いてみた。</p>
<h2>3人とも「奪われない」</h2>
<p>意外にも3名全員が同じ回答だった。AIは「ツール」であり、最終的な判断やクリエイティビティは人間にしかできないとのこと。</p>
<blockquote>「100のアイデアをAIに出してもらって、その中からインスピレーションを得る。そういう使い方なら創作の幅が広がる」</blockquote>
<h2>ネットの反応</h2>
<p>「プロがそう言うなら安心」<br>「道具として使うのが正解よな」<br>「AIの作曲、まだ感情がないんだよな」<br>「植松さんの曲はAIには作れない」</p>`,
    tags: ["AI", "ゲーム音楽", "コラム"],
    views: 89000,
  },
  {
    id: 9,
    slug: "vr-gaming-finally-mainstream",
    title: "Quest 4とPSVR3が同時期に発売決定！ ← これもうVR元年でいいだろ...",
    excerpt: "Meta Quest 4とPSVR3の同時期発売で、今度こそVRが主流になるのか議論に。",
    author: "管理人",
    publishedAt: "2026-02-20",
    imageUrl: "https://picsum.photos/seed/vrfuture/1200/630",
    content: `<p>MetaのQuest 4とソニーのPSVR3が2026年秋に同時期発売されることが判明した。</p>
<h2>今度こそ「VR元年」なのか？</h2>
<p>毎年言われ続けた「VR元年」。しかし今回はデバイスの性能が段違いに進化している。Quest 4のパススルーMRは現実と区別がつかないレベルらしい。</p>
<h2>ネットの反応</h2>
<p>「何回目のVR元年だよ」<br>「でも今回はガチっぽい」<br>「Quest 4の性能が本当ならすごい」<br>「PSVR3でグランツーリスモやりたすぎる」<br>「VR酔いが治らない限り無理」</p>`,
    tags: ["VR", "Meta Quest", "PSVR"],
    views: 76000,
  },
  {
    id: 10,
    slug: "roguelike-too-many-2026",
    title: "2026年のローグライク新作、50本超えてて草wwwww もう飽和しすぎだろ...",
    excerpt: "Steamだけで50本以上のローグライクが発売予定。さすがに多すぎでは？",
    author: "管理人",
    publishedAt: "2026-02-19",
    imageUrl: "https://picsum.photos/seed/roguelike2/1200/630",
    content: `<p>2026年にSteamでリリース予定のローグライク・ローグライト作品が50本を超えていることが判明した。</p>
<h2>なぜここまで増えた？</h2>
<p>少人数チームで作れること、配信者との相性が良いこと、リプレイ性の高さ。この3つの要因がローグライクブームを生んでいる。</p>
<h2>ネットの反応</h2>
<p>「Hadesが成功しすぎたんだよ」<br>「もう食傷気味なんだが」<br>「でも面白いのは面白いからやっちゃう」<br>「インディーの逃げ道みたいになってる」<br>「差別化できてるやつだけ生き残る」</p>`,
    tags: ["ローグライク", "Steam", "インディー"],
    views: 67000,
  },
];

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}

export function getFeaturedArticles(): Article[] {
  return articles.filter((a) => a.featured);
}

export function getPopularArticles(limit: number = 5): Article[] {
  return [...articles].sort((a, b) => b.views - a.views).slice(0, limit);
}
