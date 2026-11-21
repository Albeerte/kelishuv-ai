# Lex.uz tanlangan moddalar katalogi

## Joriy ishlash tartibi

`python scripts/index_laws.py` rasmiy HTML sahifalarini oladi va tanlangan moddalarni `src/data/legal-articles.json`ga yozadi. Standart tekshirish sanasi 2026-11-20. Keyingi yangilashda `--as-of YYYY-MM-DD` beriladi. Har bir moddada rasmiy sarlavha, haqiqiy HTML identifikatorli havola, normativ matn, tahrir sanasi, olingan vaqt va SHA-256 xesh saqlanadi.

Production server yangi katalogni olishi uchun `npm run build` bajariladi va Next.js jarayoni qayta ishga tushiriladi. FastAPI katalogi xizmat ishga tushganida o‘qiladi, katalog yangilangach u ham qayta ishga tushiriladi. Qidiruvda katalog xeshiga mos keladigan vektorlar ishlatiladi.

Parser `#divCont` ichidagi normativ elementlarni o‘qiydi. Navigatsiya, LexUZ sharhlari va o‘zgartirish manbalari chiqariladi. `29¹` kabi qo‘shimcha moddalarning identifikatori saqlanadi. Kutilgan modda yoki tahrir metama’lumoti topilmasa import to‘xtaydi. To‘liq natija vaqtinchalik fayl tayyorlangach atomar almashtiriladi. HTML tuzilishi o‘zgarsa parser tekshiriladi. [Mediatsiya qonuni](https://lex.uz/docs/-3805227)

## Mahalliy qidiruv va AI

Next.js katalogdagi normativ matnni kalit so‘z va nizo turi bo‘yicha qidiradi. Dastlabki yo‘naltirish qoidalari `src/lib/legal-routing.ts`da joylashgan. Hujjatlar fayl sifatida saqlanadi, ularning huquqiy bahosi mediator tomonidan beriladi.

`python scripts/index_laws.py --cached --embed` uchun `OPENAI_API_KEY` va `QDRANT_URL` kerak. Matn 512 tokenli, 50 token ustma-ust tushadigan bo‘laklarga ajratiladi. Yangi Qdrant kolleksiyasi to‘liq yozilgach `uzbek_laws_active` aliasi atomar almashtiriladi. `QDRANT_COLLECTION` bilan boshqa alias nomi berilishi mumkin, indekslash va FastAPI sozlamasi bir xil bo‘lishi kerak. Oldingi kolleksiyalar qo‘lda boshqarish uchun saqlanadi. Bu embedding oqimi tashqi xizmatlar sozlangach tekshiriladi.

FastAPI `LAW_CATALOG` orqali shu katalogni oladi. Mahalliy ishga tushirishda standart yo‘l repodagi katalogdir.

## Yangilanishni kuzatish

Rasmiy RSS yangilangan hujjatlarni aniqlash uchun qo‘shimcha signal beradi. RSS barcha hujjatlarni qamrab olishi tasdiqlanmagan. Rejadagi kundalik yuklash bir xil tahrir metama’lumoti va normativ mazmun xeshini solishtiradi. Ushbu loyihada yangilash buyrug‘i qo‘lda ishga tushiriladi. [Rasmiy RSS](https://lex.uz/uz/rss)

Ochiq hujjatlashtirilgan umumiy Lex.uz API tadqiqotda topilmadi. Rasmiy PDF va Word eksporti alohida hujjat darajasida mavjud. Keng ko‘lamli tijoriy ma’lumot oqimi uchun “Adolat” operatoridan API, eksport va foydalanish shartlari olinadi. [Tizim haqida](https://lex.uz/lexuz) · [Operator](https://lex.uz/uz/about) · [Axborot shartlari](https://lex.uz/uz/axborot)

Normativ hujjat matni, tahririy sharhlar va ma’lumotlar bazasining tuzilishi uchun huquqiy rejim alohida baholanadi. Ushbu katalog tanlangan normativ moddalarga manba ko‘rsatadi. [Mualliflik huquqi qonuni, 7–8-moddalar](https://lex.uz/docs/-1022944)
