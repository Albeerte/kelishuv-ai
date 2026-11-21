# KELIŞUV AI rivojlantiriş rejasi

## Buyurtma

> Build KELIŞUV AI as a premium, reliable, intelligent, and user-friendly LegalTeç platform for Uzbekistan.
>
> AI tayyorlaydi. Tomonlar kelişadi. Mediator tasdiqlaydi. Platforma ijroni kuzatadi.

Asosiy topşiriq foydalanuvçi biriktirgan “MASTER SYSTEM PROMPT — KELIŞUV AI” hujjatidir. Mahalliy manzil `http://localhost:2345`.

## Mavjud asos

Next.js 15, React 18, TypeScript, Tailwind, NextAuth va şifrlangan ma’lumotlar ombori işlayapti. Fuqaro va mediator röyxati, emailga boğlangan taklif, ikki taraf roziligi, şahar böyiça navbat, mediator dosyesi, sessiyalar, guvohnomani tekşiriş va komissiya daftari mavjud. Lex.uz’dan olingan 33 moddali katalog va ixtiyoriy FastAPI/Qdrant yöli bor.

Asosiy ilova APIlari şu kodda kengaytiriladi. FastAPI ixtiyoriy AI/RAG xizmati sifatida saqlanadi. Bu tanlov mavjud autentifikatsiya, şifrlaş, ruxsat va tranzaksiya mexanizmlarini qayta işlatadi.

## Tadqiqot va tanlovlar

Oçiq kod va modellar alohida tadqiqot hujjatlarida qayd etiladi. Node 24.19 muhitida signature_pad, PDF.js, pdf-lib/fontkit, docx va mammoth integratsiyalari baholandi. PDF.js’ning mos va tuzatilgan versiyasi tanlanadi. PDF yaratiş va imzo joylaşuvi haqiqiy render orqali tekşiriladi.

Uşbu kompyuterda Ollama va Qwen3-VL 8B örnatilgan. Sintetik özbek lotin va kirill JSON sinovlari ötdi. Mahalliy model boşlanğiç real AI provayderi sifatida ulanadi. Uning özbek huquqiy xulosalari sifati alohida baholaşni talab qiladi. Bulut provayderlari sozlanadigan adapter orqali ulanadi.

## Fazalar va qabul mezonlari

| Bosqiç | Iş | Qabul mezoni |
| --- | --- | --- |
| 1 | Oçiq kod, model va huquqiy tadqiqot | Manbalar, litsenziyalar, tanlovlar va integratsiya holati yozilgan |
| 2 | KELIŞUV brendi, tillar va navigatsiya | Özbek lotin, kirill va rus tili, kerakli bölimlar va mobil menyu işlaydi |
| 3 | Ikki taraf bayonlari va dalil tahlili | Oçiq va maxfiy ma’lumot backendda ajratiladi, ekstraksiya va AI roziligi qayd etiladi |
| 4 | AI tahlil va törtta taklif | Yetarli ma’lumotda aniq törtta taklif, mustaqil javoblar va manbalar körinadi |
| 5 | PDF/DOCX va versiyalar | Mediator hujjat yaratadi, köradi, tahrir nusxalarini va farqlarini köradi |
| 6 | Qölda uç tomonlama imzo | Birinçi taraf, ikkinçi taraf, mediator tartibida barmoq, stilus yoki siçqonça bilan imzolaş işlaydi |
| 7 | Imzo joylaşuvi va yaxlitlik | Imzolar PDF içida, nusxa va xeşga boğlangan, matn özgarganda qayta rozilik olinadi |
| 8 | Ijro va muloqot | Majburiyat, tölov hisoboti, qabul qiluvçi tasdiği, qoldiq, muddat va eslatmalar işlaydi |
| 9 | Adapterlar va boşqaruv | Integratsiya holatlari, audit, şablonlar va administrator körinişlari mavjud |
| 10 | End-to-end tekşiruv | API, ruxsat, PDF render va 1440/1280/1024/768/390/360 ekranlar tekşiriladi |

## Maxfiylik va AI ma’lumot oqimi

Umumiy takliflar va ikki tarafga oçiladigan xulosalar oçiq bayonlar hamda oçiq dalillardan tayyorlanadi. Maxfiy ma’lumot alohida, yuborgan taraf va vakolatli mediatorga möljallangan tahlilda işlatiladi. Uşbu ajratiş serverdagi sörov yiğiş, javobni filtrlaş, hujjat eksporti va bildirişnomalarga tatbiq etiladi.

Mahalliy va taşqi AI işloviga alohida rozilik saqlanadi. Provayder, model va tahlil usuli körinadi. Taşqi xizmat ma’lumot olişi uçun tegişli taraflarning roziligi tekşiriladi.

## Imzolaş va hujjat holati

Qölda çizilgan imzo vizual imzo yozuvi sifatida belgilanadi. Hujjat versiyasi, asosiy mazmun xeşi, imzolovçi hisob, vaqt, rozilik va PDF xeşi qayd etiladi. ERI hamda OneID adapterlari haqiqiy ulaniş holatini körsatadi.

Matn yoki joylaşuv özgarganda yangi hujjat versiyasi yaratiladi. Uning imzolaş jarayoni birinçi tarafdan boşlanadi. Tugallangan nusxa qulflanadi. Imzoli hujjat serverda yaratiladi va vakolat bilan yuklab olinadi.

## Tekşiruv

Xususiy bayonlar, fayllar va AI hosilalari uçun boşqa taraf va begona hisobdan kiriş sinovlari ötkaziladi. Takroriy yoki parallel imzolaş, versiya almaşişi, qolip geometriyasi va imzo tartibi tekşiriladi. PDF sahifalari PNGga render qilinib, imzo kesilişi va matn ustma-ustligi közdan keçiriladi. Haqiqiy barmoq/stilus qurilmasi sinovlari bilan avtomatlaştirilgan Pointer Events sinovlari alohida qayd etiladi.

## MVP yakuni

2026-11-20 kuni mahalliy MVPning ikki tarafli oqimi, real lokal AI, hujjatlar, uç iştirokçi imzosi va ijro hisobi işlatib tekşirildi. Texnik natijalar [VERIFICATION.md](VERIFICATION.md) hujjatida qayd etilgan. PDF/DOCX imzolari haqiqiy fayllarga joylaştirilgan.

PDF ekstraksiyasi 192 MiB JavaScript heap çegarasi va 20 soniyali deadline bilan alohida Node jarayonida bajariladi. Native rastr hajmi alohida çegaralangan. DOCX va rasm kirişlari dekodlaş oldidan tekşiriladi.

Keyingi fazalar uçun özbekça ovoz, katta ekspert baholaş töplami, murakkab OCR, korporativ integratsiyalar, OneID, ERI va tölov provayderlari rejalaştirilgan. Amaldagi mahalliy ma’lumot ombori va API kengaytirilgan. SMTP, vektor servislar va Docker yöllari alohida taşqi muhit bilan tekşiriladi.
