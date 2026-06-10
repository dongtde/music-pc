export const discoverTabs = [
  { label: '个性推荐', value: 'recommend' },
  { label: '歌单', value: 'playlists' },
  { label: '排行榜', value: 'charts' },
  { label: '歌手', value: 'artists' },
  { label: '最新音乐', value: 'latest' },
];

export const sidebarGroups = [
  {
    title: '发现',
    items: [
      { label: '发现音乐', to: '/home', icon: 'House' },
      {
        label: '音乐厅',
        to: '/discover/recommend',
        icon: 'Compass',
        activeMatch: '/discover',
      },
      { label: '播客', to: '/podcast', icon: 'MicVocal', activeMatch: '/podcast' },
      { label: '视频', to: '/mv', icon: 'Video' },
      { label: '朋友', to: '/friends', icon: 'Users' },
    ],
  },
  {
    title: '我的音乐',
    items: [
      { label: '本地与下载', to: '/library/local', icon: 'CloudDownload' },
      { label: '最近播放', to: '/library/recent', icon: 'History' },
      {
        label: '我喜欢的音乐',
        to: '/library/liked',
        icon: 'Heart',
        badge: '1,284',
      },
    ],
  },
  {
    title: '创建的歌单',
    action: '+',
    items: [
      { label: '深夜emo专用', to: '/playlist/emo', icon: 'Music2' },
      { label: 'Coding Focus', to: '/playlist/coding', icon: 'Music2' },
    ],
  },
  {
    title: '收藏的歌单',
    items: [
      { label: '2024年度热歌', to: '/playlist/hot-2024', icon: 'Music2' },
      { label: '华语流行金曲', to: '/playlist/cpop', icon: 'Music2' },
    ],
  },
];

export const playlists = [
  {
    id: 'daily',
    title: '每日歌曲推荐',
    desc: '根据你的口味生成',
    listeners: '1.2M',
    type: 'sunset',
  },
  {
    id: 'electric',
    title: '飙升榜：本周最火电子乐',
    desc: '编辑精选',
    listeners: '856K',
    type: 'neon',
  },
  {
    id: 'lofi',
    title: '深夜自习室 | Lofi Beats',
    desc: '专注与放松',
    listeners: '2.4M',
    type: 'lofi',
  },
  {
    id: 'rock',
    title: '独立音乐精选集',
    desc: '发现小众宝藏',
    listeners: '432K',
    type: 'stage',
  },
  {
    id: 'classic',
    title: '古典音乐入门指南',
    desc: '静心聆听',
    listeners: '120K',
    type: 'piano',
  },
];

export const curatedPlaylists = [
  ...playlists,
  {
    id: 'city-pop',
    title: '都市夜行 City Pop',
    desc: '霓虹、晚风和复古鼓机',
    listeners: '742K',
    type: 'neon',
  },
  {
    id: 'morning',
    title: '清晨通勤能量站',
    desc: '把一天调到明亮频段',
    listeners: '690K',
    type: 'sunset',
  },
  {
    id: 'indie-room',
    title: '卧室独立创作合集',
    desc: '低保真、吉他和一盏台灯',
    listeners: '318K',
    type: 'lofi',
  },
  {
    id: 'livehouse',
    title: 'Livehouse 热浪现场',
    desc: '主唱开口前的那一秒',
    listeners: '508K',
    type: 'stage',
  },
  {
    id: 'piano-sleep',
    title: '睡前钢琴缓冲带',
    desc: '柔软旋律，慢慢降噪',
    listeners: '264K',
    type: 'piano',
  },
  {
    id: 'weekend-groove',
    title: '周末松弛律动',
    desc: '轻快节拍，慢慢回血',
    listeners: '386K',
    type: 'sunset',
  },
  {
    id: 'midnight-synth',
    title: '午夜合成器漫游',
    desc: '适合夜车和耳机的电子声场',
    listeners: '512K',
    type: 'neon',
  },
];

export const playlistMoods = [
  '全部',
  '华语',
  '流行',
  '电子',
  '民谣',
  '摇滚',
  '学习',
  '古典',
];

export const chartBoards = [
  {
    id: 'hot',
    title: '热歌榜',
    label: '全站播放热度',
    trend: '+18%',
    tracks: [
      { rank: '01', name: '夜空中最亮的星', artist: '逃跑计划', change: 'NEW' },
      { rank: '02', name: '暮色回声', artist: '南屿', change: '+3' },
      { rank: '03', name: '悬浮城市', artist: 'Pixel River', change: '+1' },
      { rank: '04', name: '蓝色温室', artist: 'Luna Lane', change: '-2' },
      { rank: '05', name: '风经过的地方', artist: '林小岸', change: '+7' },
    ],
  },
  {
    id: 'new',
    title: '新歌榜',
    label: '近 7 日新发行',
    trend: '+42%',
    tracks: [
      { rank: '01', name: '雾色轨迹', artist: 'Echo Frame', change: 'NEW' },
      { rank: '02', name: 'Orbit of Us', artist: 'Mira Vale', change: 'NEW' },
      { rank: '03', name: '雨停以后', artist: '北岸合唱团', change: '+6' },
      { rank: '04', name: '星河入口', artist: '陈屿白', change: '+2' },
      { rank: '05', name: '再见之前', artist: '沈知夏', change: '-1' },
    ],
  },
  {
    id: 'original',
    title: '原创榜',
    label: '独立音乐人作品',
    trend: '+9%',
    tracks: [
      { rank: '01', name: '潮湿月光', artist: '纸船计划', change: '+2' },
      { rank: '02', name: '便利店诗人', artist: '灰蓝', change: '+5' },
      { rank: '03', name: '无人区玫瑰', artist: '七月样本', change: 'NEW' },
      { rank: '04', name: '慢速公路', artist: '岩井', change: '-1' },
      { rank: '05', name: '海盐气泡', artist: 'Pearl Low', change: '+4' },
    ],
  },
];

export const globalCharts = [
  {
    title: '欧美流行榜',
    desc: 'Billboard 风向精选',
    type: 'stage',
    listeners: '932K',
  },
  {
    title: '华语新势力榜',
    desc: '年轻创作者上升中',
    type: 'sunset',
    listeners: '1.1M',
  },
  {
    title: '电子舞曲榜',
    desc: '俱乐部和耳机都适合',
    type: 'neon',
    listeners: '765K',
  },
  {
    title: '古典收藏榜',
    desc: '高分演奏与名家版本',
    type: 'piano',
    listeners: '188K',
  },
];

export const artistCategories = [
  '全部',
  '华语男',
  '华语女',
  '乐队组合',
  '欧美',
  '日韩',
  '独立音乐人',
];

export const featuredArtists = [
  { name: '沈知夏', tag: '华语流行', followers: '326万', color: '#ff7a9b' },
  {
    name: 'Echo Frame',
    tag: '电子 / Synthwave',
    followers: '118万',
    color: '#8a5cff',
  },
  { name: '北岸合唱团', tag: '独立乐队', followers: '84万', color: '#2dbf9d' },
  { name: 'Mira Vale', tag: '欧美唱作', followers: '203万', color: '#6aa9ff' },
  { name: '陈屿白', tag: '民谣', followers: '156万', color: '#ffb347' },
  { name: 'Pixel River', tag: '电子摇滚', followers: '96万', color: '#f05fff' },
  { name: 'Luna Lane', tag: 'R&B', followers: '141万', color: '#7fc6a4' },
  { name: '纸船计划', tag: '卧室流行', followers: '62万', color: '#c893ff' },
];

export const newSongs = [
  {
    name: '雾色轨迹',
    artist: 'Echo Frame',
    album: 'Static Garden',
    rank: '01',
    type: 'neon',
    time: '03:42',
  },
  {
    name: '海风经过凌晨',
    artist: '沈知夏',
    album: '沿海公路',
    rank: '02',
    type: 'sunset',
    time: '04:05',
  },
  {
    name: 'Orbit of Us',
    artist: 'Mira Vale',
    album: 'Low Light',
    rank: '03',
    type: 'stage',
    time: '03:28',
  },
  {
    name: '雨停以后',
    artist: '北岸合唱团',
    album: '灰蓝天气',
    rank: '04',
    type: 'lofi',
    time: '04:11',
  },
  {
    name: '潮汐来信',
    artist: '陈屿白',
    album: '岛屿夜航',
    rank: '05',
    type: 'piano',
    time: '03:57',
  },
  {
    name: 'Neon Lake',
    artist: 'Pixel River',
    album: 'After City',
    rank: '06',
    type: 'neon',
    time: '03:36',
  },
  {
    name: '便利店诗人',
    artist: '灰蓝',
    album: '凌晨两点半',
    rank: '07',
    type: 'lofi',
    time: '04:20',
  },
  {
    name: 'Light Years',
    artist: 'Luna Lane',
    album: 'Room 808',
    rank: '08',
    type: 'stage',
    time: '03:19',
  },
  {
    name: '玻璃晴天',
    artist: '林小岸',
    album: '透明街角',
    rank: '09',
    type: 'sunset',
    time: '03:44',
  },
];

export const recommendedSingles = newSongs.slice(0, 9);

export const recommendedMvs = [
  {
    id: 'fog-track',
    title: '雾色轨迹 Live Session',
    artist: 'Echo Frame',
    views: '128万播放',
    duration: '04:12',
    type: 'neon',
  },
  {
    id: 'coast-night',
    title: '海风经过凌晨',
    artist: '沈知夏',
    views: '86万播放',
    duration: '03:58',
    type: 'sunset',
  },
  {
    id: 'orbit-us',
    title: 'Orbit of Us',
    artist: 'Mira Vale',
    views: '64万播放',
    duration: '03:34',
    type: 'stage',
  },
  {
    id: 'rain-after',
    title: '雨停以后',
    artist: '北岸合唱团',
    views: '51万播放',
    duration: '04:26',
    type: 'lofi',
  },
  {
    id: 'glass-sky',
    title: '玻璃晴天',
    artist: '林小岸',
    views: '42万播放',
    duration: '03:48',
    type: 'piano',
  },
];

export const recommendedRadios = [
  {
    id: 'daily-fm',
    title: '每日私人 FM',
    desc: '根据最近播放持续更新',
    listeners: '92.4K',
  },
  {
    id: 'sleep-radio',
    title: '睡前轻音乐电台',
    desc: '低音量、慢节奏、少打扰',
    listeners: '46.8K',
  },
  {
    id: 'work-focus',
    title: '工作专注电台',
    desc: '稳定节拍陪你进入状态',
    listeners: '73.1K',
  },
  {
    id: 'city-night',
    title: '城市夜行电台',
    desc: '夜车、街灯和电子氛围',
    listeners: '58.6K',
  },
];

export const latestAlbums = [
  {
    id: 'static-garden',
    title: 'Static Garden',
    artist: 'Echo Frame',
    type: 'neon',
    listeners: '88K',
  },
  {
    id: 'low-light',
    title: 'Low Light',
    artist: 'Mira Vale',
    type: 'stage',
    listeners: '61K',
  },
  {
    id: 'coast-road',
    title: '沿海公路',
    artist: '沈知夏',
    type: 'sunset',
    listeners: '104K',
  },
  {
    id: 'room-808',
    title: 'Room 808',
    artist: 'Luna Lane',
    type: 'lofi',
    listeners: '47K',
  },
  {
    id: 'night-piano',
    title: '雨夜钢琴速写',
    artist: '林川',
    type: 'piano',
    listeners: '33K',
  },
];

export const currentTrack = {
  name: '夜空中最亮的星',
  artist: '逃跑计划',
  elapsed: '1:24',
  duration: '4:12',
  coverPalette: {
    primary: '#213245',
    secondary: '#8bbad5',
    tertiary: '#e7a976',
  },
};
