export type Anime = {
  id: number;
  title: string;
  kicker: string;
  cover: string;
  banner: string;
  score: number;
  episodes: number | string;
  year: number;
  genres: string[];
  summary: string;
  trailerId?: string;
};

export const anime: Anime[] = [
  {
    id: 185874,
    title: "BLEACH: Thousand-Year Blood War — The Calamity",
    kicker: "Final cour · arriving 2026",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx185874-aU3e6tBT6wwA.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/185874-IdGyh1EBG91I.jpg",
    score: 88,
    episodes: 10,
    year: 2026,
    genres: ["Action", "Adventure", "Supernatural"],
    summary: "The last battle enters its final movement. Soul Society makes its stand while Ichigo faces the future he has been fighting toward.",
    trailerId: "IJONbpfIlUg",
  },
  {
    id: 195600,
    title: "Daemons of the Shadow Realm",
    kicker: "New transmission",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx195600-moI0UFArtOme.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/195600-UxHvDXwzJxlP.jpg",
    score: 78,
    episodes: 24,
    year: 2026,
    genres: ["Action", "Fantasy", "Mystery"],
    summary: "A secluded village, a stolen identity, and twin powers that should never have awakened. The truth waits beyond the mountain.",
    trailerId: "XCyj9KKKjUI",
  },
  {
    id: 182205,
    title: "That Time I Got Reincarnated as a Slime Season 4",
    kicker: "Returning favorite",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx182205-q2AeO1owuQbO.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/182205-fRUoKv6f2JAq.jpg",
    score: 83,
    episodes: "TBA",
    year: 2026,
    genres: ["Adventure", "Comedy", "Fantasy"],
    summary: "Tempest’s story continues as Rimuru’s growing nation attracts new allies, old rivals, and consequences on a much larger scale.",
    trailerId: "ikxIrDr72iA",
  },
  {
    id: 21,
    title: "ONE PIECE",
    kicker: "The great voyage continues",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-ELSYx3yMPcKM.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VakJmZqs.jpg",
    score: 87,
    episodes: "∞",
    year: 1999,
    genres: ["Action", "Adventure", "Fantasy"],
    summary: "Luffy and the Straw Hats chase the world’s greatest treasure, one island and one impossible promise at a time.",
  },
  {
    id: 187538,
    title: "BLACK TORCH",
    kicker: "Staff selection",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx187538-fXVXKYUA3VV6.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/187538-287evzCezNl0.jpg",
    score: 71,
    episodes: "TBA",
    year: 2026,
    genres: ["Action", "Supernatural"],
    summary: "A shinobi with a gift for speaking to animals crosses paths with a legendary mononoke—and becomes something neither world expected.",
    trailerId: "2clp09dITKY",
  },
  {
    id: 190569,
    title: "Jaadugar: A Witch in Mongolia",
    kicker: "Hidden signal",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx190569-KnCQLI3Z8hPX.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/190569-fQrApHKs9PIz.jpg",
    score: 82,
    episodes: "TBA",
    year: 2026,
    genres: ["Drama", "Historical"],
    summary: "A gifted young healer is swept into the politics of the Mongol Empire, where knowledge can be more dangerous than any blade.",
    trailerId: "GBHYXPp1lt8",
  },
];

export const days = ["Mon 24", "Tue 25", "Wed 26", "Thu 27", "Fri 28", "Sat 29", "Sun 30"];

export const schedule = [
  { id: 21, day: 0, time: "09:00", title: "One Piece", episode: "EP 1147", language: "Sub", cover: anime[3].cover },
  { id: 195600, day: 0, time: "11:30", title: "Daemons of the Shadow Realm", episode: "EP 10", language: "Dub", cover: anime[1].cover },
  { id: 187538, day: 1, time: "12:30", title: "BLACK TORCH", episode: "EP 08", language: "Sub", cover: anime[4].cover },
  { id: 182205, day: 1, time: "19:00", title: "Slime Season 4", episode: "EP 02", language: "Dub", cover: anime[2].cover },
  { id: 195600, day: 2, time: "10:00", title: "Daemons of the Shadow Realm", episode: "EP 11", language: "Sub", cover: anime[1].cover },
  { id: 185874, day: 2, time: "20:30", title: "BLEACH: The Calamity", episode: "EP 06", language: "Dub", cover: anime[0].cover },
  { id: 21, day: 3, time: "09:00", title: "One Piece", episode: "EP 1147", language: "Dub", cover: anime[3].cover },
  { id: 187538, day: 3, time: "14:00", title: "BLACK TORCH", episode: "EP 08", language: "Dub", cover: anime[4].cover },
  { id: 190569, day: 4, time: "21:00", title: "Jaadugar", episode: "EP 04", language: "Sub", cover: anime[5].cover },
  { id: 185874, day: 4, time: "22:30", title: "BLEACH: The Calamity", episode: "EP 07", language: "Sub", cover: anime[0].cover },
  { id: 182205, day: 5, time: "18:30", title: "Slime Season 4", episode: "EP 03", language: "Sub", cover: anime[2].cover },
  { id: 190569, day: 5, time: "22:00", title: "Jaadugar", episode: "EP 04", language: "Dub", cover: anime[5].cover },
  { id: 21, day: 6, time: "09:00", title: "One Piece", episode: "EP 1148", language: "Sub", cover: anime[3].cover },
  { id: 195600, day: 6, time: "16:00", title: "Daemons of the Shadow Realm", episode: "EP 11", language: "Dub", cover: anime[1].cover },
];
