# KELISHUV AI rivojlantirish rejasi

## Buyurtma

> Build KELISHUV AI as a premium, reliable, intelligent, and user-friendly LegalTech platform for Uzbekistan.
>
> AI tayyorlaydi. Tomonlar kelishadi. Mediator tasdiqlaydi. Platforma ijroni kuzatadi.

Asosiy topshiriq foydalanuvchi biriktirgan “MASTER SYSTEM PROMPT — KELISHUV AI” hujjatidir. Mahalliy manzil `http://localhost:2345`.

## Mavjud asos

Next.js 15, React 18, TypeScript, Tailwind, NextAuth va shifrlangan ma’lumotlar ombori ishlayapti. Fuqaro va mediator ro‘yxati, emailga bog‘langan taklif, ikki taraf roziligi, shahar bo‘yicha navbat, mediator dosyesi, sessiyalar, guvohnomani tekshirish va komissiya daftari mavjud. Lex.uz’dan olingan 33 moddali katalog va ixtiyoriy FastAPI/Qdrant yo‘li bor.

Asosiy ilova APIlari shu kodda kengaytiriladi. FastAPI ixtiyoriy AI/RAG xizmati sifatida saqlanadi. Bu tanlov mavjud autentifikatsiya, shifrlash, ruxsat va tranzaksiya mexanizmlarini qayta ishlatadi.

## Tadqiqot va tanlovlar

Ochiq kod va modellar alohida tadqiqot hujjatlarida qayd etiladi. Node 24.19 muhitida signature_pad, PDF.js, pdf-lib/fontkit, docx va mammoth integratsiyalari baholandi. PDF.js’ning mos va tuzatilgan versiyasi tanlanadi. PDF yaratish va imzo joylashuvi haqiqiy render orqali tekshiriladi.

Ushbu kompyuterda Ollama va Qwen3-VL 8B o‘rnatilgan. Sintetik o‘zbek lotin va kirill JSON sinovlari o‘tdi. Mahalliy model boshlang‘ich real AI provayderi sifatida ulanadi. Uning o‘zbek huquqiy xulosalari sifati alohida baholashni talab qiladi. Bulut provayderlari sozlanadigan adapter orqali ulanadi.

## Fazalar va qabul mezonlari

| Bosqich | Ish | Qabul mezoni |
| --- | --- | --- |
| 1 | Ochiq kod, model va huquqiy tadqiqot | Manbalar, litsenziyalar, tanlovlar va integratsiya holati yozilgan |
| 2 | KELISHUV brendi, tillar va navigatsiya | O‘zbek lotin, kirill va rus tili, kerakli bo‘limlar va mobil menyu ishlaydi |
| 3 | Ikki taraf bayonlari va dalil tahlili | Ochiq va maxfiy ma’lumot backendda ajratiladi, ekstraksiya va AI roziligi qayd etiladi |
| 4 | AI tahlil va to‘rtta taklif | Yetarli ma’lumotda aniq to‘rtta taklif, mustaqil javoblar va manbalar ko‘rinadi |
| 5 | PDF/DOCX va versiyalar | Mediator hujjat yaratadi, ko‘radi, tahrir nusxalarini va farqlarini ko‘radi |
| 6 | Qo‘lda uch tomonlama imzo | Birinchi taraf, ikkinchi taraf, mediator tartibida barmoq, stilus yoki sichqoncha bilan imzolash ishlaydi |
| 7 | Imzo joylashuvi va yaxlitlik | Imzolar PDF ichida, nusxa va xeshga bog‘langan, matn o‘zgarganda qayta rozilik olinadi |
| 8 | Ijro va muloqot | Majburiyat, to‘lov hisoboti, qabul qiluvchi tasdig‘i, qoldiq, muddat va eslatmalar ishlaydi |
| 9 | Adapterlar va boshqaruv | Integratsiya holatlari, audit, shablonlar va administrator ko‘rinishlari mavjud |
| 10 | End-to-end tekshiruv | API, ruxsat, PDF render va 1440/1280/1024/768/390/360 ekranlar tekshiriladi |

## Maxfiylik va AI ma’lumot oqimi

Umumiy takliflar va ikki tarafga ochiladigan xulosalar ochiq bayonlar hamda ochiq dalillardan tayyorlanadi. Maxfiy ma’lumot alohida, yuborgan taraf va vakolatli mediatorga mo‘ljallangan tahlilda ishlatiladi. Ushbu ajratish serverdagi so‘rov yig‘ish, javobni filtrlash, hujjat eksporti va bildirishnomalarga tatbiq etiladi.

Mahalliy va tashqi AI ishloviga alohida rozilik saqlanadi. Provayder, model va tahlil usuli ko‘rinadi. Tashqi xizmat ma’lumot olishi uchun tegishli taraflarning roziligi tekshiriladi.

## Imzolash va hujjat holati

Qo‘lda chizilgan imzo vizual imzo yozuvi sifatida belgilanadi. Hujjat versiyasi, asosiy mazmun xeshi, imzolovchi hisob, vaqt, rozilik va PDF xeshi qayd etiladi. ERI hamda OneID adapterlari haqiqiy ulanish holatini ko‘rsatadi.

Matn yoki joylashuv o‘zgarganda yangi hujjat versiyasi yaratiladi. Uning imzolash jarayoni birinchi tarafdan boshlanadi. Tugallangan nusxa qulflanadi. Imzoli hujjat serverda yaratiladi va vakolat bilan yuklab olinadi.

## Tekshiruv

Xususiy bayonlar, fayllar va AI hosilalari uchun boshqa taraf va begona hisobdan kirish sinovlari o‘tkaziladi. Takroriy yoki parallel imzolash, versiya almashishi, qolip geometriyasi va imzo tartibi tekshiriladi. PDF sahifalari PNGga render qilinib, imzo kesilishi va matn ustma-ustligi ko‘zdan kechiriladi. Haqiqiy barmoq/stilus qurilmasi sinovlari bilan avtomatlashtirilgan Pointer Events sinovlari alohida qayd etiladi.

## MVP yakuni

2026-11-20 kuni mahalliy MVPning ikki tarafli oqimi, real lokal AI, hujjatlar, uch ishtirokchi imzosi va ijro hisobi ishlatib tekshirildi. Texnik natijalar [VERIFICATION.md](VERIFICATION.md) hujjatida qayd etilgan. PDF/DOCX imzolari haqiqiy fayllarga joylashtirilgan.

PDF ekstraksiyasi 192 MiB JavaScript heap chegarasi va 20 soniyali deadline bilan alohida Node jarayonida bajariladi. Native rastr hajmi alohida chegaralangan. DOCX va rasm kirishlari dekodlash oldidan tekshiriladi.

Keyingi fazalar uchun o‘zbekcha ovoz, katta ekspert baholash to‘plami, murakkab OCR, korporativ integratsiyalar, OneID, ERI va to‘lov provayderlari rejalashtirilgan. Amaldagi mahalliy ma’lumot ombori va API kengaytirilgan. SMTP, vektor servislar va Docker yo‘llari alohida tashqi muhit bilan tekshiriladi.
