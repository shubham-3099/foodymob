// SAMPLE DATA — illustrative only. No live restaurant, pricing or user data.

export type Recommendation = "MUST TRY" | "Should Try" | "Avoid";

export type Review = {
  id: string;
  author: string;
  authorType: "vlogger" | "user";
  vloggerId?: string;
  recommendation: Recommendation;
  text: string;
  links?: { label: string; platform: string }[];
};

export type Dish = {
  id: string;
  name: string;
  restaurant: string;
  price: number;
  calories: number;
  distanceKm: number;
  address: string;
  hours: string;
  category: string;
  city: string;
  image: string;
  reviews: Review[];
};

export type Vlogger = {
  premium?: boolean;
  socials?: { youtube?: string; instagram?: string };
  id: string;
  name: string;
  handle: string;
  bio: string;
  avatar: string;
  cover: string;
  reviewsCount: number;
  followers: string;
  visited: string[];
};

const u = (id: string, w = 600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

export const IMG = {
  momos: u("photo-1496116218417-1a781b1c416c"),
  noodles: u("photo-1552611052-33e04de081de"),
  poke: u("photo-1546069901-ba9599a7e63c"),
  burger: u("photo-1568901346375-23c9450c58cd"),
  pizza: u("photo-1513104890138-7c749659a591"),
  iceCream: u("photo-1497034825429-c343d7c6a68f"),
  biryani: u("photo-1563379091339-03b21ab4a4f8"),
  tacos: u("photo-1565299585323-38d6b0865b47"),
  cover: u("photo-1507525428034-b723cf961d3e", 1200),
};

export const AVATARS = {
  anna: u("photo-1494790108377-be9c29b29330", 200),
  ajay: u("photo-1500648767791-00dcc994a43e", 200),
  anil: u("photo-1507003211169-0a1dd7228f2d", 200),
  meera: u("photo-1438761681033-6461ffad8d80", 200),
  rohit: u("photo-1544005313-94ddf0286df2", 200),
  sara: u("photo-1517841905240-472988babdf9", 200),
};

const vlogReview = (
  id: string,
  author: string,
  vloggerId: string,
  recommendation: Recommendation,
  text: string,
): Review => ({
  id,
  author,
  authorType: "vlogger",
  vloggerId,
  recommendation,
  text,
  links: [
    { label: "Youtube", platform: "Youtube" },
    { label: "Instagram", platform: "Instagram" },
  ],
});

export const DISHES: Dish[] = [
  {
    id: "momos",
    name: "Momos",
    restaurant: "Desi Zaika Dhaba",
    price: 200,
    calories: 200,
    distanceKm: 1.5,
    address: "Sector 29, Gurugram, Haryana, India",
    hours: "11:00 AM - 11:30 PM Mon-Fri",
    category: "Dumplings",
    city: "Sector 29, Gurugram",
    image: IMG.momos,
    reviews: [
      vlogReview(
        "r1",
        "Anil Kumar",
        "anil-kumar",
        "MUST TRY",
        "Awesome! Food was still warm and the filling was extremely juicy. The chilli chutney alone is worth the trip.",
      ),
      vlogReview(
        "r2",
        "Meera Iyer",
        "meera-iyer",
        "MUST TRY",
        "Steamed to order and served fast. Portions are generous for the price.",
      ),
      {
        id: "r3",
        author: "Jam House",
        authorType: "user",
        recommendation: "MUST TRY",
        text: "Awesome! Food was still warm and chicken was extremely crispy.",
      },
      {
        id: "r4",
        author: "Sharma Dhaba",
        authorType: "user",
        recommendation: "Should Try",
        text: "Awesome fast service. Slightly oily but the flavour is solid.",
      },
      {
        id: "r5",
        author: "Kiran P.",
        authorType: "user",
        recommendation: "Avoid",
        text: "Too crowded in the evening, had to wait 40 minutes.",
      },
    ],
  },
  {
    id: "salmon-poke-bowl",
    name: "Salmon Poke Bowl",
    restaurant: "Healthy Greens Cafe",
    price: 220,
    calories: 410,
    distanceKm: 0.5,
    address: "12 Outer Circle, New York, USA",
    hours: "10:00 AM - 10:00 PM Mon-Sun",
    category: "Bowls",
    city: "72 Outer Circle, New York",
    image: IMG.poke,
    reviews: [
      vlogReview(
        "p1",
        "Ajay Khanna",
        "ajay-khanna",
        "MUST TRY",
        "Fresh salmon, crunchy greens and a dressing that does not drown the bowl.",
      ),
      {
        id: "p2",
        author: "Jam House",
        authorType: "user",
        recommendation: "MUST TRY",
        text: "Light lunch that still keeps you full. Great value.",
      },
      {
        id: "p3",
        author: "Nina R.",
        authorType: "user",
        recommendation: "Should Try",
        text: "Good, though I wish there was more avocado.",
      },
    ],
  },
  {
    id: "hakka-noodles",
    name: "Hakka Noodles",
    restaurant: "Wok Street Corner",
    price: 180,
    calories: 520,
    distanceKm: 2.1,
    address: "5 Baker Lane, New York, USA",
    hours: "12:00 PM - 11:00 PM Mon-Sat",
    category: "Noodles",
    city: "72 Outer Circle, New York",
    image: IMG.noodles,
    reviews: [
      vlogReview(
        "n1",
        "Rohit Verma",
        "rohit-verma",
        "MUST TRY",
        "Proper wok heat, you can taste it. Ask for extra chilli oil.",
      ),
      {
        id: "n2",
        author: "Dev S.",
        authorType: "user",
        recommendation: "Should Try",
        text: "Tasty but a little salty for me.",
      },
    ],
  },
  {
    id: "smash-burger",
    name: "Classic Smash Burger",
    restaurant: "Corner Grill House",
    price: 260,
    calories: 640,
    distanceKm: 0.9,
    address: "88 Park Row, New York, USA",
    hours: "11:00 AM - 12:00 AM Mon-Sun",
    category: "Burgers",
    city: "72 Outer Circle, New York",
    image: IMG.burger,
    reviews: [
      vlogReview(
        "b1",
        "Anil Kumar",
        "anil-kumar",
        "MUST TRY",
        "Crispy edges, melted cheese, soft bun. Simple done right.",
      ),
      {
        id: "b2",
        author: "Jam House",
        authorType: "user",
        recommendation: "MUST TRY",
        text: "Best burger I have had near the office.",
      },
    ],
  },
  {
    id: "margherita-pizza",
    name: "Margherita Pizza",
    restaurant: "Forno Piccolo",
    price: 340,
    calories: 780,
    distanceKm: 3.2,
    address: "22 Grand Street, New York, USA",
    hours: "12:00 PM - 11:00 PM Tue-Sun",
    category: "Pizza",
    city: "72 Outer Circle, New York",
    image: IMG.pizza,
    reviews: [
      vlogReview(
        "z1",
        "Meera Iyer",
        "meera-iyer",
        "Should Try",
        "Great base, but the crust was uneven on my visit.",
      ),
    ],
  },
  {
    id: "gelato-scoop",
    name: "Pistachio Gelato",
    restaurant: "Freddo Gelateria",
    price: 150,
    calories: 230,
    distanceKm: 1.1,
    address: "3 Mercer Street, New York, USA",
    hours: "11:00 AM - 11:00 PM Mon-Sun",
    category: "Ice cream",
    city: "72 Outer Circle, New York",
    image: IMG.iceCream,
    reviews: [
      {
        id: "g1",
        author: "Sara L.",
        authorType: "user",
        recommendation: "MUST TRY",
        text: "Dense, nutty and not overly sweet.",
      },
    ],
  },
  {
    id: "chicken-biryani",
    name: "Chicken Biryani",
    restaurant: "Zaffran Kitchen",
    price: 290,
    calories: 690,
    distanceKm: 2.6,
    address: "45 Church Street, New York, USA",
    hours: "12:00 PM - 10:30 PM Mon-Sun",
    category: "Rice",
    city: "72 Outer Circle, New York",
    image: IMG.biryani,
    reviews: [
      vlogReview(
        "y1",
        "Rohit Verma",
        "rohit-verma",
        "MUST TRY",
        "Long grain rice, tender chicken, and the raita is fresh.",
      ),
    ],
  },
  {
    id: "street-tacos",
    name: "Street Tacos",
    restaurant: "Casa Verde",
    price: 210,
    calories: 480,
    distanceKm: 1.8,
    address: "9 Ludlow Street, New York, USA",
    hours: "1:00 PM - 12:00 AM Wed-Sun",
    category: "Tacos",
    city: "72 Outer Circle, New York",
    image: IMG.tacos,
    reviews: [
      {
        id: "t1",
        author: "Dev S.",
        authorType: "user",
        recommendation: "Should Try",
        text: "Good salsa, tortillas could be warmer.",
      },
    ],
  },
];

export const VLOGGERS: Vlogger[] = [
  {
    id: "ajay-khanna",
    name: "Ajay Khanna",
    handle: "@devour_king",
    bio: "Premium food explorer",
    avatar: AVATARS.ajay,
    cover: IMG.cover,
    reviewsCount: 24,
    followers: "1M",
    visited: ["salmon-poke-bowl", "smash-burger"],
  },
  {
    id: "anil-kumar",
    name: "Anil Kumar",
    handle: "@anil_eats",
    bio: "Street food hunter, one plate at a time",
    avatar: AVATARS.anil,
    cover: IMG.cover,
    reviewsCount: 58,
    followers: "420K",
    visited: ["momos", "smash-burger"],
  },
  {
    id: "meera-iyer",
    name: "Meera Iyer",
    handle: "@meera_bites",
    bio: "Vegetarian finds and bakery deep dives",
    avatar: AVATARS.meera,
    cover: IMG.cover,
    reviewsCount: 33,
    followers: "180K",
    visited: ["margherita-pizza", "momos"],
  },
  {
    id: "rohit-verma",
    name: "Rohit Verma",
    handle: "@rohit_onthemenu",
    bio: "Late night noodles and biryani reviews",
    avatar: AVATARS.rohit,
    cover: IMG.cover,
    reviewsCount: 41,
    followers: "260K",
    visited: ["hakka-noodles", "chicken-biryani"],
  },
  {
    id: "sara-lopez",
    name: "Sara Lopez",
    handle: "@sweet_by_sara",
    bio: "Desserts, gelato and coffee crawls",
    avatar: AVATARS.sara,
    cover: IMG.cover,
    reviewsCount: 19,
    followers: "95K",
    visited: ["gelato-scoop", "street-tacos"],
  },
];

export const CATEGORIES = [
  { name: "Burgers", image: IMG.burger },
  { name: "Pizza", image: IMG.pizza },
  { name: "Ice cream", image: IMG.iceCream },
  { name: "Noodles", image: IMG.noodles },
];

export const LOCATIONS = [
  "72 Outer Circle, New York",
  "14 Bleecker Street, New York",
  "Sector 29, Gurugram",
  "Bandra West, Mumbai",
  "Indiranagar, Bengaluru",
];

export const getDish = (id: string) => DISHES.find((d) => d.id === id);
export const getVlogger = (id: string) => VLOGGERS.find((v) => v.id === id);


export function dishesAtLocation(location: string, dishes: Dish[] = DISHES) {
  const city = location.split(',').at(-1)?.trim().toLowerCase();
  return dishes.filter(d => d.city.toLowerCase().includes(city ?? location.toLowerCase()));
}
export function matchesDish(d: Dish, query: string) {
  const text = [d.name, d.restaurant, d.category, ...d.reviews.map(r => r.author)].join(' ').toLowerCase();
  return text.includes(query.trim().toLowerCase());
}
