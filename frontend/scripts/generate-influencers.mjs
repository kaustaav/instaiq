// Generates synthetic (fictional) influencer profiles for local development.
//   node scripts/generate-influencers.mjs [count=480]
// Deterministic: the same seed always produces the same file, so diffs stay reviewable.
// Contact details are deliberately fake: emails use example.com, phones use an invalid "00000" prefix.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const SEED_TS = path.join(here, '../src/data/seed.ts')
const OUT = path.join(here, '../src/data/generated-influencers.json')
const COUNT = +(process.argv[2] ?? 480)

// ---------- deterministic randomness ----------
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20251001)
const pick = arr => arr[Math.floor(rand() * arr.length)]
const chance = p => rand() < p
const between = (lo, hi) => lo + rand() * (hi - lo)
const intBetween = (lo, hi) => Math.floor(between(lo, hi + 1))
const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
const sample = (arr, n) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a.slice(0, n)
}
function weighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = rand() * total
  for (const [v, w] of entries) if ((r -= w) < 0) return v
  return entries[entries.length - 1][0]
}

// ---------- reference data from seed.ts ----------
const seedSrc = fs.readFileSync(SEED_TS, 'utf8')
const GEO = seedSrc.match(/export const GEO = "([^"]*)"/)[1]
const cityState = new Map(GEO.split('|').flatMap(x => { const [s, c] = x.split(':'); return c.split(',').map(ci => [ci, s]) }))
const takenHandles = new Set([...seedSrc.matchAll(/"handle":"@([^"]+)"/g)].map(m => m[1]))
const firstId = Math.max(...[...seedSrc.matchAll(/"id":(\d+)/g)].map(m => +m[1])) + 1

// The agency is Chandigarh-based and hyper-local, so weight the tricity and the north heavily.
const CITY_WEIGHTS = [
  ['Chandigarh', 60], ['Mohali', 22], ['Panchkula', 18], ['Ludhiana', 16], ['Amritsar', 14], ['Jalandhar', 10],
  ['Patiala', 9], ['Bathinda', 4], ['Delhi', 34], ['New Delhi', 8], ['Gurugram', 16], ['Noida', 12], ['Faridabad', 5],
  ['Ambala', 4], ['Karnal', 4], ['Shimla', 5], ['Dharamshala', 3], ['Manali', 3], ['Dehradun', 6], ['Rishikesh', 3],
  ['Jaipur', 16], ['Udaipur', 6], ['Jodhpur', 5], ['Lucknow', 10], ['Varanasi', 4], ['Agra', 3], ['Kanpur', 3],
  ['Mumbai', 26], ['Pune', 16], ['Thane', 4], ['Nagpur', 4], ['Nashik', 3], ['Bengaluru', 22], ['Mysuru', 4],
  ['Mangaluru', 3], ['Hyderabad', 16], ['Chennai', 14], ['Coimbatore', 5], ['Kochi', 8], ['Thiruvananthapuram', 4],
  ['Kolkata', 14], ['Siliguri', 2], ['Ahmedabad', 12], ['Surat', 6], ['Vadodara', 5], ['Indore', 8], ['Bhopal', 5],
  ['Panaji', 5], ['Guwahati', 5], ['Shillong', 2], ['Bhubaneswar', 4], ['Patna', 4], ['Ranchi', 3], ['Srinagar', 3],
  ['Jammu', 3], ['Gangtok', 2], ['Visakhapatnam', 3], ['Raipur', 2],
]
for (const [c] of CITY_WEIGHTS) if (!cityState.has(c)) throw new Error(`City not in GEO: ${c}`)

// Cities near each other, for influencers who cover more than one.
const NEARBY = {
  Chandigarh: ['Mohali', 'Panchkula'], Mohali: ['Chandigarh'], Panchkula: ['Chandigarh'], Delhi: ['Gurugram', 'Noida'],
  Gurugram: ['Delhi'], Noida: ['Delhi'], Mumbai: ['Thane', 'Pune'], Pune: ['Mumbai'], Ludhiana: ['Jalandhar'],
  Amritsar: ['Jalandhar'], Jaipur: ['Udaipur'], Bengaluru: ['Mysuru'], Hyderabad: ['Secunderabad'], Kochi: ['Thrissur'],
}

// ---------- names by region ----------
const NAMES = {
  punjabi: {
    f: ['Harleen', 'Simran', 'Jasmine', 'Navneet', 'Gurleen', 'Mehak', 'Rupinder', 'Kiranjot', 'Amanpreet', 'Sukhmani', 'Ravneet', 'Tanvir', 'Prabhleen', 'Japneet'],
    m: ['Harjot', 'Gurpreet', 'Arshdeep', 'Jaskaran', 'Manveer', 'Karan', 'Inderjit', 'Sahil', 'Yuvraj', 'Rajveer', 'Angad'],
    s: ['Sandhu', 'Gill', 'Dhillon', 'Brar', 'Grewal', 'Bajwa', 'Sidhu', 'Virk', 'Cheema', 'Chahal', 'Aulakh', 'Randhawa', 'Bedi', 'Malhotra', 'Khanna'],
  },
  hindi: {
    f: ['Ananya', 'Ishita', 'Kritika', 'Nidhi', 'Aditi', 'Pallavi', 'Shreya', 'Tanya', 'Vanshika', 'Riya', 'Sakshi', 'Muskan', 'Aarushi', 'Diksha', 'Garima'],
    m: ['Aarav', 'Rohan', 'Kabir', 'Vivek', 'Ayush', 'Nikhil', 'Siddharth', 'Varun', 'Aditya', 'Harsh', 'Shubham', 'Pranav'],
    s: ['Sharma', 'Verma', 'Gupta', 'Agarwal', 'Srivastava', 'Mishra', 'Tiwari', 'Saxena', 'Chauhan', 'Rathore', 'Yadav', 'Bansal', 'Mittal', 'Tyagi', 'Chaudhary'],
  },
  marathi: {
    f: ['Sayali', 'Rutuja', 'Gauri', 'Mrunal', 'Ketaki', 'Aboli', 'Sanika', 'Pooja', 'Manasi', 'Shravani'],
    m: ['Aniket', 'Omkar', 'Tejas', 'Soham', 'Chinmay', 'Pratik', 'Yash', 'Mandar'],
    s: ['Kulkarni', 'Deshpande', 'Patil', 'Joshi', 'Pawar', 'Jadhav', 'Gokhale', 'Shinde', 'Bhosale', 'Sawant'],
  },
  gujarati: {
    f: ['Hetal', 'Khushi', 'Dhruvi', 'Nirali', 'Krupa', 'Palak', 'Jinal', 'Riddhi'],
    m: ['Harsh', 'Parth', 'Dhruv', 'Jay', 'Meet', 'Chirag', 'Kunal'],
    s: ['Patel', 'Shah', 'Mehta', 'Desai', 'Parekh', 'Trivedi', 'Joshi', 'Modi'],
  },
  bengali: {
    f: ['Ankita', 'Debolina', 'Sreemoyee', 'Tanushree', 'Moumita', 'Ritika', 'Poulomi', 'Anwesha'],
    m: ['Arnab', 'Sayan', 'Rohit', 'Anirban', 'Soumya', 'Debarghya'],
    s: ['Banerjee', 'Chatterjee', 'Mukherjee', 'Das', 'Sen', 'Ghosh', 'Bose', 'Roy', 'Dutta'],
  },
  tamil: {
    f: ['Divya', 'Keerthana', 'Nandhini', 'Priyanka', 'Sowmya', 'Harini', 'Janani', 'Aishwarya'],
    m: ['Karthik', 'Arjun', 'Vignesh', 'Pradeep', 'Surya', 'Hari'],
    s: ['Iyer', 'Raman', 'Subramanian', 'Krishnan', 'Venkatesh', 'Rajan', 'Sundaram'],
  },
  telugu: {
    f: ['Sravani', 'Lakshmi', 'Harika', 'Sahithi', 'Bhavya', 'Mounika', 'Tejaswi'],
    m: ['Sai', 'Charan', 'Rahul', 'Vamsi', 'Teja', 'Kiran'],
    s: ['Reddy', 'Rao', 'Naidu', 'Varma', 'Chowdary', 'Goud'],
  },
  kannada: {
    f: ['Spoorthi', 'Anusha', 'Chaitra', 'Rashmi', 'Deepika', 'Sahana'],
    m: ['Pavan', 'Manoj', 'Rakshit', 'Nitin', 'Prajwal'],
    s: ['Hegde', 'Shetty', 'Gowda', 'Rao', 'Bhat', 'Kamath'],
  },
  malayali: {
    f: ['Anjali', 'Meera', 'Sreelakshmi', 'Aparna', 'Nimisha', 'Gayathri'],
    m: ['Arun', 'Nikhil', 'Vishnu', 'Akhil', 'Rahul'],
    s: ['Nair', 'Menon', 'Pillai', 'Kurian', 'Thomas', 'Varghese', 'Panicker'],
  },
  northeast: {
    f: ['Ritu', 'Nisha', 'Pema', 'Linda', 'Mary', 'Anjali'],
    m: ['Rahul', 'Tenzing', 'David', 'Bikash'],
    s: ['Baruah', 'Bora', 'Sharma', 'Kharkongor', 'Lepcha', 'Gogoi', 'Singha'],
  },
  kashmiri: {
    f: ['Iqra', 'Mehvish', 'Sana', 'Zoya', 'Nida'],
    m: ['Faizan', 'Aamir', 'Rehan', 'Umar'],
    s: ['Bhat', 'Wani', 'Mir', 'Lone', 'Kaul', 'Raina'],
  },
}

const STATE_REGION = {
  Punjab: 'punjabi', Chandigarh: 'punjabi', Haryana: 'hindi', Delhi: 'hindi', 'Himachal Pradesh': 'hindi',
  'Uttar Pradesh': 'hindi', Uttarakhand: 'hindi', Rajasthan: 'hindi', 'Madhya Pradesh': 'hindi', Bihar: 'hindi',
  Jharkhand: 'hindi', Chhattisgarh: 'hindi', Maharashtra: 'marathi', Goa: 'marathi', Gujarat: 'gujarati',
  'West Bengal': 'bengali', Odisha: 'bengali', 'Tamil Nadu': 'tamil', Puducherry: 'tamil', Telangana: 'telugu',
  'Andhra Pradesh': 'telugu', Karnataka: 'kannada', Kerala: 'malayali', Assam: 'northeast', Meghalaya: 'northeast',
  Sikkim: 'northeast', Manipur: 'northeast', 'Jammu and Kashmir': 'kashmiri',
}

// Regional language(s) spoken alongside Hindi/English.
const STATE_LANGS = {
  Punjab: ['Punjabi'], Chandigarh: ['Punjabi'], Haryana: ['Haryanvi'], Rajasthan: ['Rajasthani'], Gujarat: ['Gujarati'],
  Maharashtra: ['Marathi'], Goa: ['Konkani'], 'West Bengal': ['Bengali'], Odisha: ['Odia'], 'Tamil Nadu': ['Tamil'],
  Puducherry: ['Tamil'], Telangana: ['Telugu', 'Urdu'], 'Andhra Pradesh': ['Telugu'], Karnataka: ['Kannada', 'Tulu'],
  Kerala: ['Malayalam'], Assam: ['Assamese'], Sikkim: ['Nepali'], Manipur: ['Manipuri'], Bihar: ['Bhojpuri', 'Maithili'],
  'Uttar Pradesh': ['Bhojpuri'], 'Jammu and Kashmir': ['Kashmiri', 'Dogri'],
}
const HINDI_BELT = new Set(['Punjab', 'Chandigarh', 'Haryana', 'Delhi', 'Himachal Pradesh', 'Uttar Pradesh', 'Uttarakhand', 'Rajasthan', 'Madhya Pradesh', 'Bihar', 'Jharkhand', 'Chhattisgarh', 'Gujarat', 'Maharashtra'])

// ---------- niche content ----------
const NICHES = {
  Jewellery: {
    weight: 14,
    handleWords: ['jewels', 'jewellery', 'adorn', 'gehna', 'kundan', 'polki', 'sparkle'],
    open: ['Jewellery stylist', 'Handcrafted jewellery lover', 'Bridal jewellery curator', 'Silver & oxidised jewellery addict', 'Heritage jewellery storyteller', 'f:Goldsmith\'s daughter turned creator'],
    mid: ['showcasing local artisans and family-run karigars', 'styling kundan, polki and temple sets for every budget', 'helping brides plan their full jewellery trousseau', 'mixing contemporary minimal pieces with traditional sets', 'reviewing demi-fine brands honestly', 'documenting old jewellery bazaars'],
    tags: ['#bridaljewellery', '#kundan', '#polkijewellery', '#jewellerylover', '#silverjewellery', '#oxidisedjewellery', '#templejewellery', '#jhumkas', '#weddingjewellery', '#handcraftedjewellery', '#finejewellery', '#meenakari'],
  },
  Fashion: {
    weight: 16,
    handleWords: ['style', 'styles', 'wardrobe', 'closet', 'fits', 'drapes', 'threads'],
    open: ['Fashion creator', 'Ethnic wear stylist', 'Street style enthusiast', 'Thrift & sustainable fashion advocate', 'Saree drapist', 'Budget fashion finder'],
    mid: ['styling everyday looks under ₹2,000', 'championing handloom and local weavers', 'turning one outfit into five looks', 'bringing street style to small-town India', 'decoding festive and wedding dressing', 'reviewing homegrown labels'],
    tags: ['#ootd', '#ethnicwear', '#streetstyle', '#sareelove', '#indianfashion', '#thrifthaul', '#sustainablefashion', '#festivelook', '#kurtaset', '#stylingreels', '#handloom', '#fashionreels'],
  },
  Beauty: {
    weight: 14,
    handleWords: ['glow', 'beauty', 'makeup', 'skin', 'glam', 'blush'],
    open: ['Skincare nerd', 'Makeup artist', 'Beauty creator', 'Drugstore beauty reviewer', 'Bridal makeup artist', 'Haircare enthusiast'],
    mid: ['testing products on Indian skin tones', 'sharing honest before/afters', 'breaking down ingredient lists in plain language', 'doing everyday makeup in under 10 minutes', 'reviewing affordable dupes', 'teaching beginner-friendly routines'],
    tags: ['#skincareroutine', '#makeuptutorial', '#indianmakeup', '#desiskin', '#beautyreview', '#makeupreels', '#bridalmakeup', '#glowingskin', '#haircare', '#drugstoremakeup', '#nomakeuplook', '#skincaretips'],
  },
  Food: {
    weight: 18,
    handleWords: ['eats', 'foodie', 'khana', 'kitchen', 'bites', 'tadka', 'swaad', 'cooks'],
    open: ['Food blogger', 'Home cook', 'Street food hunter', 'Café hopper', 'Home baker', 'Regional recipe collector'],
    mid: ['finding the best hidden eateries in {city}', 'sharing maa ke haath ka khana recipes', 'reviewing new cafés every weekend', 'documenting street food one lane at a time', 'baking eggless desserts at home', 'cooking quick weeknight meals'],
    tags: ['#foodie', '#streetfood', '#indianfood', '#homecooking', '#foodreels', '#cafehopping', '#desikhana', '#foodblogger', '#homebaker', '#recipereels', '#foodstagram', '#vegrecipes'],
  },
  Fitness: {
    weight: 10,
    handleWords: ['fit', 'fitness', 'moves', 'strong', 'yoga', 'sweat'],
    open: ['Certified personal trainer', 'Yoga teacher', 'Fitness coach', 'Runner', 'Strength training enthusiast', 'Pilates instructor'],
    mid: ['making home workouts simple', 'sharing real transformation stories', 'mixing yoga with strength training', 'coaching busy professionals', 'prepping high-protein vegetarian meals', 'training for my next half-marathon'],
    tags: ['#fitnessmotivation', '#homeworkout', '#yogaeveryday', '#strengthtraining', '#fitindia', '#weightlossjourney', '#runnersofindia', '#gymreels', '#healthyeating', '#pilates', '#fitnesscoach', '#mealprep'],
  },
  Travel: {
    weight: 10,
    handleWords: ['travels', 'wanders', 'roams', 'trails', 'yatra', 'journeys'],
    open: ['Travel creator', 'Weekend explorer', 'Solo traveller', 'Offbeat travel storyteller', 'Budget backpacker', 'Heritage walk host'],
    mid: ['finding weekend getaways near {city}', 'exploring the hills one trek at a time', 'documenting forts, ghats and old havelis', 'travelling India on a budget', 'sharing homestay and café finds', 'showing {state} beyond the usual spots'],
    tags: ['#incredibleindia', '#travelgram', '#weekendgetaway', '#solotravel', '#himalayas', '#travelreels', '#backpacking', '#offbeat', '#heritagewalk', '#roadtrip', '#mountains', '#indiatravel'],
  },
  Lifestyle: {
    weight: 12,
    handleWords: ['life', 'diaries', 'days', 'vibes', 'daily', 'stories'],
    open: ['Lifestyle creator', 'Slow living enthusiast', 'Home decor lover', 'Day-in-my-life vlogger', 'Plant parent', 'Minimalist'],
    mid: ['sharing everyday life in {city}', 'styling small homes on a budget', 'building calm morning routines', 'finding joy in little things', 'reviewing home and kitchen finds', 'documenting festivals with family'],
    tags: ['#dayinmylife', '#lifestyleblogger', '#homedecor', '#slowliving', '#plantparent', '#minimalism', '#morningroutine', '#aesthetic', '#lifestylereels', '#homeinspo', '#vlog', '#selfcare'],
  },
  Tech: {
    weight: 5,
    handleWords: ['tech', 'gadgets', 'unboxed', 'bytes', 'geek'],
    open: ['Tech reviewer', 'Gadget geek', 'Smartphone reviewer', 'Productivity nerd', 'Budget tech explainer'],
    mid: ['reviewing phones under ₹20,000', 'explaining tech in Hinglish', 'unboxing the latest gadgets', 'sharing productivity apps and desk setups', 'comparing budget earbuds and wearables'],
    tags: ['#techreview', '#gadgets', '#unboxing', '#smartphone', '#techreels', '#desksetup', '#productivity', '#budgettech', '#androidtips', '#techtips'],
  },
  Parenting: {
    weight: 5,
    handleWords: ['f:mom', 'f:mama', 'parenting', 'littleones', 'm:dad'],
    open: ['f:Mom of two', 'f:New mom', 'Parenting creator', 'f:Toddler mom', 'm:Hands-on dad', 'm:Dad of two'],
    mid: ['sharing honest parenting moments', 'making easy toddler meals', 'reviewing baby products', 'planning kid-friendly activities', 'f:navigating work and motherhood', 'm:navigating work and fatherhood'],
    tags: ['#momlife', '#parentingtips', '#toddlermom', '#indianmom', '#babyproducts', '#momblogger', '#kidsactivities', '#parenting', '#motherhood', '#momreels'],
  },
}
// Niche combos that feel natural together.
const PAIRS = {
  Jewellery: ['Fashion', 'Lifestyle'], Fashion: ['Beauty', 'Lifestyle', 'Jewellery'], Beauty: ['Fashion', 'Lifestyle'],
  Food: ['Lifestyle', 'Travel'], Fitness: ['Lifestyle', 'Food'], Travel: ['Lifestyle', 'Food'], Lifestyle: ['Fashion', 'Food', 'Travel'],
  Tech: ['Lifestyle'], Parenting: ['Lifestyle', 'Food'],
}
const CLOSERS = ['DM for collabs.', 'Collabs: DM or email.', 'Honest reviews only.', 'New reel every Tuesday.', 'Based in {city}.', 'Always local, always honest.', 'Brand enquiries welcome.', '{city} ❤️', 'hi:Hindi/English content.', 'Let\'s create something together.']
const SINCE = ['since 2019', 'since 2020', 'since 2021', 'since 2022', 'since 2023', '']

const BRAND_WORDS = {
  Jewellery: ['Kesar Jewels', 'Noor Adornments', 'Suvarna Crafts', 'Chandni Silver', 'Rangeen Jhumka Co.'],
  Fashion: ['Threadwise', 'Kora Label', 'Mulmul Studio', 'Desi Drape Co.', 'Neel Handloom'],
  Beauty: ['Haldi Glow', 'Kumkum Botanicals', 'Aarsh Skin', 'Blush Bazaar', 'Nimbu Naturals'],
  Food: ['Mitti Kitchen', 'Tadka Tales', 'Chai Point Café', 'Desi Crumbs Bakery', 'Masala Box'],
  Fitness: ['FitDesi Studio', 'Proteinwala', 'Stride Sportswear', 'Asana Mats', 'CoreKart'],
  Travel: ['Pahadi Stays', 'RoamIndia Tours', 'Ghumakkad Hostels', 'Trailhead Treks', 'Safarnama Travel'],
  Lifestyle: ['Ghar Decor', 'Aangan Living', 'Plantwala', 'Kulhad & Co.', 'Sukoon Home'],
  Tech: ['Byteware', 'Tarang Audio', 'Nimbus Mobiles', 'Deskmate', 'Chargeit'],
  Parenting: ['Little Lotus', 'Nanhe Kadam', 'Bachpan Toys', 'Mamta Care', 'Tiny Tiffin'],
}
const CAMPAIGN_WORDS = ['Festive Edit', 'Summer Drop', 'Wedding Season', 'Diwali Push', 'Launch Week', 'Monsoon Collection', 'New Year Reset', 'Holi Special', 'Store Opening', 'Winter Edit', 'Raksha Bandhan', 'Karva Chauth Edit']
const DELIVERABLES = ['1 Reel', '2 Reels', '1 Reel + 3 Stories', '1 Post + 2 Stories', '2 Reels + 4 Stories', '3 Stories', '1 Post', '1 Reel + 1 Post']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// ---------- helpers ----------
// Phrases prefixed "f:" / "m:" are gender-specific; "hi:" needs a Hindi speaker.
const usable = (list, female, langs = []) =>
  list
    .filter(t => !(t.startsWith('f:') && !female) && !(t.startsWith('m:') && female) && !(t.startsWith('hi:') && !langs.includes('Hindi')))
    .map(t => t.replace(/^(f|m|hi):/, ''))
const slug = s => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const fill = (t, ctx) => t.replace('{city}', ctx.city).replace('{state}', ctx.state)
const rupees = n => '₹' + n.toLocaleString('en-IN')
const roundPrice = n => (n >= 5000 ? Math.round(n / 500) * 500 : Math.round(n / 100) * 100)

function makeHandle(first, last, word) {
  const f = slug(first), l = slug(last), w = slug(word)
  const options = [`${f}${w}`, `${f}.${w}`, `${f}_${w}`, `the${f}${w}`, `${w}with${f}`, `${f}${l}`, `${f}.${l}`, `${f}_${l}_`, `${f}${w}${intBetween(1, 99)}`]
  for (const h of sample(options, options.length)) if (!takenHandles.has(h) && h.length <= 24) { takenHandles.add(h); return h }
  const h = `${f}${w}${intBetween(100, 999)}`
  takenHandles.add(h)
  return h
}

function makeProfile(id) {
  const primaryCity = weighted(CITY_WEIGHTS)
  const state = cityState.get(primaryCity)
  const region = STATE_REGION[state] ?? 'hindi'
  const female = chance(0.68)
  const names = NAMES[region]
  const first = pick(female ? names.f : names.m)
  const last = pick(names.s)

  // location: mostly one city, sometimes a nearby second one, occasionally state-only
  let cities = [primaryCity]
  let states = []
  if (chance(0.05)) { cities = []; states = [state] }
  else if (NEARBY[primaryCity] && chance(0.3)) cities.push(pick(NEARBY[primaryCity]))

  // niches: one primary, often a natural secondary
  let primary = weighted(Object.entries(NICHES).map(([k, v]) => [k, v.weight]))
  if (primary === 'Parenting' && !female && chance(0.5)) primary = 'Lifestyle'
  const cats = [primary]
  if (chance(0.55)) cats.push(pick(PAIRS[primary]))

  // languages: Hindi in the north/west, English very common, plus the regional language
  const langs = []
  if (HINDI_BELT.has(state) || chance(0.2)) langs.push('Hindi')
  if (chance(0.6) || !HINDI_BELT.has(state)) langs.push('English')
  const regional = STATE_LANGS[state]
  if (regional && chance(0.75)) langs.push(regional[0])
  if (regional?.[1] && chance(0.15)) langs.push(regional[1])
  if (!langs.length) langs.push('English')

  // metrics: nano/micro only (1K–20K), log-uniform; engagement falls as followers grow
  const followers = Math.round(Math.pow(10, between(Math.log10(1200), Math.log10(19800))) / 10) * 10
  const expectedEng = 10.5 - 3.8 * Math.log10(followers / 1000)
  const eng = Math.round(Math.min(14, Math.max(1.4, expectedEng + gauss() * 1.4)) * 10) / 10
  const interactions = (followers * eng) / 100
  const comments = Math.max(3, Math.round(interactions * between(0.06, 0.12)))
  const likes = Math.max(10, Math.round(interactions - comments))

  // pricing scales with reach; some creators haven't shared rates yet
  const reel = roundPrice(Math.max(1200, followers * between(0.3, 0.6)))
  const hasRates = chance(0.9)
  const pricing = hasRates
    ? { story: rupees(roundPrice(reel * between(0.3, 0.45))), reel: rupees(reel), post: rupees(roundPrice(reel * between(0.6, 0.8))) }
    : { story: '—', reel: '—', post: '—' }

  // bio
  const ctx = { city: cities[0] ?? state, state }
  const n = NICHES[primary]
  const since = pick(SINCE)
  const mid = fill(pick(usable(n.mid, female)), ctx)
  const bio = [
    `${pick(usable(n.open, female))} from ${ctx.city}${since ? ' ' + since : ''}.`,
    `${mid[0].toUpperCase()}${mid.slice(1)}.`,
    cats[1] ? `Also into ${cats[1].toLowerCase()}.` : '',
    fill(pick(usable(CLOSERS, female, langs)), ctx),
  ].filter(Boolean).join(' ')

  // hashtags: mostly primary niche, some secondary, often a local tag
  const tags = [...sample(n.tags, intBetween(3, 4))]
  if (cats[1]) tags.push(...sample(NICHES[cats[1]].tags, 1))
  if (chance(0.6)) tags.push(`#${slug(ctx.city)}${pick(['diaries', 'blogger', 'foodie', 'fashion', 'influencer', 'life'])}`)

  // past campaigns
  // past campaigns: distinct names, newest first; only a recent one can still be ongoing
  const camps = chance(0.35)
    ? sample(CAMPAIGN_WORDS, intBetween(1, 3))
        .map(name => ({ name, brand: pick(BRAND_WORDS[pick(cats)]), month: intBetween(0, 11), year: pick([2023, 2024, 2024, 2025, 2025]), del: pick(DELIVERABLES) }))
        .sort((a, b) => b.year - a.year || b.month - a.month)
        .map((c, k) => ({
          name: c.name,
          brand: c.brand,
          date: `${MONTHS[c.month]} ${c.year}`,
          del: c.del,
          status: k === 0 && c.year === 2025 && c.month >= 6 && chance(0.4) ? 'Ongoing' : 'Completed',
        }))
    : []

  const handle = makeHandle(first, last, pick(usable(n.handleWords, female)))
  const email = chance(0.85) ? `${slug(first)}.${slug(last)}${intBetween(1, 99)}@example.com` : '—'
  // "00000" is not a valid Indian mobile prefix, so these can never reach a real person
  const phone = chance(0.6) ? `+91 00000 ${String(intBetween(10000, 99999))}` : '—'

  return {
    id,
    name: `${first} ${last}`,
    handle: '@' + handle,
    cities,
    states,
    cats,
    langs: [...new Set(langs)],
    followers,
    eng,
    likes,
    comments,
    bio,
    email,
    phone,
    pricing,
    tags: [...new Set(tags)],
    camps,
    av: (first[0] + last[0]).toUpperCase(),
    // freshness spread: most fresh-ish, a long tail of stale data
    metricsAgeDays: Math.round(Math.pow(rand(), 3.5) * 360),
    ratesAgeDays: Math.round(Math.pow(rand(), 1.4) * 420),
  }
}

const profiles = Array.from({ length: COUNT }, (_, k) => makeProfile(firstId + k))
fs.writeFileSync(OUT, JSON.stringify(profiles, null, 0).replace(/},{"id"/g, '},\n{"id"') + '\n')
console.log(`Wrote ${profiles.length} profiles (ids ${firstId}–${firstId + COUNT - 1}) to ${path.relative(process.cwd(), OUT)}`)
