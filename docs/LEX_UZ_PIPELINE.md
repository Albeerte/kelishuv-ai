# Lex.uz tanlangan moddalar katalogi

## Joriy işlaş tartibi

`python scripts/index_laws.py` rasmiy HTML sahifalarini oladi va tanlangan moddalarni `src/data/legal-articles.json`ga yozadi. Standart tekşiriş sanasi 2026-11-20. Keyingi yangilaşda `--as-of YYYY-MM-DD` beriladi. Har bir moddada rasmiy sarlavha, haqiqiy HTML identifikatorli havola, normativ matn, tahrir sanasi, olingan vaqt va SHA-256 xeş saqlanadi.

Production server yangi katalogni olişi uçun `npm run build` bajariladi va Next.js jarayoni qayta işga tuşiriladi. FastAPI katalogi xizmat işga tuşganida öqiladi, katalog yangilangaç u ham qayta işga tuşiriladi. Qidiruvda katalog xeşiga mos keladigan vektorlar işlatiladi.

Parser `#divCont` içidagi normativ elementlarni öqiydi. Navigatsiya, LexUZ şarhlari va özgartiriş manbalari çiqariladi. `29¹` kabi qöşimça moddalarning identifikatori saqlanadi. Kutilgan modda yoki tahrir metama’lumoti topilmasa import töxtaydi. Töliq natija vaqtinçalik fayl tayyorlangaç atomar almaştiriladi. HTML tuzilişi özgarsa parser tekşiriladi. [Mediatsiya qonuni](https://lex.uz/docs/-3805227)

## Mahalliy qidiruv va AI

Next.js katalogdagi normativ matnni kalit söz va nizo turi böyiça qidiradi. Dastlabki yönaltiriş qoidalari `src/lib/legal-routing.ts`da joylaşgan. Hujjatlar fayl sifatida saqlanadi, ularning huquqiy bahosi mediator tomonidan beriladi.

`python scripts/index_laws.py --cached --embed` uçun `OPENAI_API_KEY` va `QDRANT_URL` kerak. Matn 512 tokenli, 50 token ustma-ust tuşadigan bölaklarga ajratiladi. Yangi Qdrant kolleksiyasi töliq yozilgaç `uzbek_laws_active` aliasi atomar almaştiriladi. `QDRANT_COLLECTION` bilan boşqa alias nomi berilişi mumkin, indekslaş va FastAPI sozlamasi bir xil bölişi kerak. Oldingi kolleksiyalar qölda boşqariş uçun saqlanadi. Bu embedding oqimi taşqi xizmatlar sozlangaç tekşiriladi.

FastAPI `LAW_CATALOG` orqali şu katalogni oladi. Mahalliy işga tuşirişda standart yöl repodagi katalogdir.

## Yangilanişni kuzatiş

Rasmiy RSS yangilangan hujjatlarni aniqlaş uçun qöşimça signal beradi. RSS barça hujjatlarni qamrab olişi tasdiqlanmagan. Rejadagi kundalik yuklaş bir xil tahrir metama’lumoti va normativ mazmun xeşini soliştiradi. Uşbu loyihada yangilaş buyruği qölda işga tuşiriladi. [Rasmiy RSS](https://lex.uz/uz/rss)

Oçiq hujjatlaştirilgan umumiy Lex.uz API tadqiqotda topilmadi. Rasmiy PDF va Word eksporti alohida hujjat darajasida mavjud. Keng kölamli tijoriy ma’lumot oqimi uçun “Adolat” operatoridan API, eksport va foydalaniş şartlari olinadi. [Tizim haqida](https://lex.uz/lexuz) · [Operator](https://lex.uz/uz/about) · [Axborot şartlari](https://lex.uz/uz/axborot)

Normativ hujjat matni, tahririy şarhlar va ma’lumotlar bazasining tuzilişi uçun huquqiy rejim alohida baholanadi. Uşbu katalog tanlangan normativ moddalarga manba körsatadi. [Mualliflik huquqi qonuni, 7–8-moddalar](https://lex.uz/docs/-1022944)
