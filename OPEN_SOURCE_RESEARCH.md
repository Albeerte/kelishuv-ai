# KELISHUV AI ochiq kod tadqiqoti

Tekshirish sanasi 2026-11-20. Versiyalar npm registridagi `dist-tags.latest` va loyiha repozitoriylari orqali tekshirildi. Integratsiya holati bu hujjat yozilgan paytdagi tanlovni bildiradi. Ishlayotgan integratsiya holati build va jarayon sinovlari bilan yakuniy tekshiriladi.

## Mavjud loyiha va tanlov

Loyihada Next.js 15.5.29, React 18.3.1, TypeScript, Tailwind, Radix, Zustand, NextAuth 5 beta, Prisma 6.19, AES-256-GCM lokal saqlash, Zod, SMTP outbox, S3 klienti, uchrashuvlar va rol tekshiruvlari mavjud. Ixtiyoriy FastAPI/Qdrant xizmati va Lex.uz tanlangan moddalar katalogi yaratilgan. Mahalliy Node versiyasi 24.19.0. Mavjud runtime uchun `npm audit --omit=dev` natijasi nol ma’lum zaiflik bo‘ldi. Bu o‘lchov keyingi paket o‘rnatishdan so‘ng yangilanadi. [Loyiha paketi](C:/Users/student/Documents/ChatGPT/lex/package.json)

Ishlayotgan MVP `signature_pad` 5.1.5, `@cantoo/pdf-lib` 2.11.1, `@cantoo/fontkit` 2.0.12, `docx` 9.16.0, `pdfjs-dist` 6.5.438, `mammoth` 1.13.0 va `@napi-rs/canvas` 1.1.1 paketlarini ishlatadi. Mahalliy Qwen3-VL tasvir va skan ekstraksiyasi bilan tekshirildi. Tesseract va Docling keyingi OCR baholashiga kiritilgan.

## Komponentlar jadvali

| Komponent | Repository | Litsenziya | Maqsad | Integratsiya holati |
| --- | --- | --- | --- | --- |
| Qo‘lda imzo, sensor, qalam, sichqoncha | [signature_pad](https://github.com/szimek/signature_pad) | MIT | Silliq canvas, PNG eksporti, nuqta guruhlari, bosim ma’lumoti | MVP uchun tanlandi |
| PDF yaratish uchun boshlang‘ich nomzod | [pdf-lib](https://github.com/Hopding/pdf-lib) | MIT | PDF sahifalari va koordinatalar | Cantoo fork baholashiga asos bo‘ldi |
| PDF yaratish va imzo joylashtirish | [Cantoo pdf-lib](https://github.com/cantoo-scribe/pdf-lib) | MIT | PDF sahifalari, rasm va matnni aniq koordinatalarga yozish | Integratsiya va uch imzoli PDF render sinovi o‘tdi |
| Unicode shriftlar | [Cantoo fontkit](https://github.com/cantoo-scribe/fontkit) | MIT | O‘zbek va kirill matni uchun mahalliy TTF shriftni PDFga joylashtirish | Integratsiya va kirill regressiya sinovi o‘tdi |
| DOCX generator | [docx](https://github.com/dolanmiu/docx) | MIT | Shartnoma bo‘limlari, jadval va imzo tasvirli Word hujjati | MVP uchun tanlandi |
| PDF ko‘rish va matn olish | [PDF.js](https://github.com/mozilla/pdf.js) | Apache-2.0 | Canvas preview, sahifa o‘lchami va matn ajratish | Bevosita klient API tanlandi |
| React PDF qobig‘i | [react-pdf](https://github.com/wojtekmaj/react-pdf) | MIT | PDF.js uchun React komponentlari | React 19 talab qiladigan eng yangi nashr keyingi migratsiyada baholanadi |
| DOCX matn ajratish | [mammoth.js](https://github.com/mwilliamson/mammoth.js) | BSD-2-Clause | DOCXdan xom matn olish | MVP uchun tanlandi |
| ZIP oqimini tekshirish | [yauzl](https://github.com/thejoshwolfe/yauzl) | MIT | Markaziy katalog, deklarativ va haqiqiy ochilgan hajm chegarasi | 3.4.0 integratsiya va soxta ZIP metama’lumot sinovi o‘tdi |
| Rasm sarlavhasini o‘qish | [image-size](https://codeberg.org/image-size/image-size) | MIT | PNG/JPEG o‘lchamini native dekodlashdan oldin tekshirish | 2.1.0 integratsiya va katta PNG regressiyasi o‘tdi |
| Rasm va skan OCR | [tesseract.js](https://github.com/naptha/tesseract.js) | Apache-2.0 | Brauzer yoki Node worker orqali OCR | Lokal worker va til fayllari bilan nomzod |
| O‘zbek OCR til fayllari | [Tesseract data](https://github.com/tesseract-ocr/tessdata) | Apache-2.0 | `uzb`, `uzb_cyrl`, `rus` tanlash | Til modeli bo‘yicha sinov talab etiladi |
| Murakkab PDF maketi va OCR | [Docling](https://github.com/docling-project/docling) | MIT kod, alohida model litsenziyalari | Jadval, sahifa tuzilishi va keng formatli ekstraksiya | Ilg‘or hujjat tahlili bosqichi |
| Legal RAG va vektor qidiruv | [Qdrant](https://github.com/qdrant/qdrant) | Apache-2.0 | Vektor qidiruv va versiyalangan kolleksiya aliasi | Mavjud ixtiyoriy adapter qayta ishlatiladi |
| PostgreSQL vektor kengaytmasi | [pgvector](https://github.com/pgvector/pgvector) | PostgreSQL | Bir DB ichida vektor qidiruv | Katta PostgreSQL migratsiyasi uchun muqobil |
| AI orkestratsiya | [LangGraph.js](https://github.com/langchain-ai/langgraphjs) | MIT | Holatli ko‘p bosqichli AI grafi | Yangi dependency zarurati isbotlanganda qo‘shiladi |
| Autentifikatsiya va sessiyalar | [Auth.js / NextAuth](https://github.com/nextauthjs/next-auth) | ISC | Hisob, sessiya, JWT | Mavjud integratsiya saqlanadi |
| Alohida ruxsat engine | [OpenFGA](https://github.com/openfga/openfga) | Apache-2.0 | Ko‘p tashkilotli munosabatga asoslangan vakolat | Korporativ bosqich uchun nomzod |
| ORM va tranzaksiyalar | [Prisma](https://github.com/prisma/prisma) | Apache-2.0 | PostgreSQL va state tranzaksiyasi | Mavjud integratsiya saqlanadi |
| Shifrlangan fayl saqlash | [Node.js crypto](https://nodejs.org/api/crypto.html) | Node.js litsenziyasi | AES-GCM, SHA-256 va tasodifiy identifikatorlar | Mavjud lokal saqlash qayta ishlatiladi |
| S3 API klienti | [AWS SDK v3](https://github.com/aws/aws-sdk-js-v3) | Apache-2.0 | Ixtiyoriy obyekt saqlash | Mavjud S3 adapteri |
| Davom ettiriladigan upload | [tus-js-client](https://github.com/tus/tus-js-client) | MIT | Katta fayllarni bo‘lib va qayta yuborish | Katta upload talabi paydo bo‘lganda baholanadi |
| Video uchrashuv | [Jitsi Meet](https://github.com/jitsi/jitsi-meet) | Apache-2.0 | Hosted yoki self-host WebRTC uchrashuvi | Mavjud tashqi uchrashuv havolasi, xizmat tekshiruvi alohida |
| O‘z serveridagi real-time media | [LiveKit](https://github.com/livekit/livekit) | Apache-2.0 | SFU, tokenli media xonalari, React klient | Alohida media infratuzilmasi bosqichi |
| Real-time yozishma | [Socket.IO](https://github.com/socketio/socket.io) | MIT | Xona va rolga bog‘langan xabarlar | SSE yoki polling MVP ehtiyojini qoplasa qo‘shimcha paket talab qilinmaydi |
| Hujjatni hamkorlikda tahrirlash | [Yjs](https://github.com/yjs/yjs) | MIT | CRDT orqali parallel tahrir | Hozirgi versiya va xesh modeli, hamkorlik keyingi bosqich |
| Kalender UI | [FullCalendar](https://github.com/fullcalendar/fullcalendar) | MIT core | Ko‘rinadigan uchrashuv kalendari | Mavjud booking engine saqlanadi, kalendar UI ixtiyoriy |
| Email xabarlari | [Nodemailer](https://github.com/nodemailer/nodemailer) | MIT-0 | SMTP jo‘natish | Mavjud outbox va adapter |
| Redis-protokol klienti | [ioredis](https://github.com/redis/ioredis) | MIT | Umumiy rate limit | Mavjud ixtiyoriy adapter |
| Permissiv kesh serveri | [Valkey](https://github.com/valkey-io/valkey) | BSD-3-Clause | Redis-protokolga mos mahalliy kesh | Infratuzilma varianti |
| To‘lov qabul qilish | [Payme Business docs](https://developer.help.paycom.uz/) | Xizmat shartlari va merchant shartnomasi | Merchant API orqali haqiqiy to‘lovlar | Kalitlar va merchant ulanishi bilan adapter |
| O‘zbek nutqini matnga olish | [Whisper](https://github.com/openai/whisper) | MIT kod va weights | Lokal ko‘p tilli STT, tokenizerda `uz` mavjud | O‘zbek audio benchmarkidan so‘ng bosqich 2 |
| Lokal STT va TTS runtime | [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) | Apache-2.0 runtime | ONNX modellar, offline audio xizmatlari | Har bir modelning til sifati va litsenziyasi alohida baholanadi |
| Lokal TTS engine | [OHF Piper](https://github.com/OHF-Voice/piper1-gpl) | GPL-3.0 engine, voice alohida | Mahalliy ovoz sintezi | Litsenziya majburiyatlari va o‘zbek voice testi bilan keyingi nomzod |
| To‘liq imzolash platformasi | [Documenso](https://github.com/documenso/documenso) | AGPL-3.0 | Hujjat aylanishi va imzolash | Ish jarayonini o‘rganish uchun nomzod, integratsiya hajmi katta |
| To‘liq imzolash platformasi | [OpenSign](https://github.com/OpenSignLabs/OpenSign) | AGPL-3.0 | PDF maydonlar va ko‘p imzolovchili jarayon | Ish jarayonini o‘rganish uchun nomzod, alohida stack |

## Nashrlar, moslik va integratsiya xarajati

| Paket | Kuzatilgan latest | Nashr va faollik dalili | Stack mosligi | Integratsiya hajmi |
| --- | --- | --- | --- | --- |
| signature_pad | 5.1.5 | 2026-11-20, 5.1.4 nashri 2026-07-31 | Frameworkdan mustaqil TypeScript, React ref orqali klientda | Kichik, canvas hayot sikli va eksport |
| pdf-lib | 1.17.1 | 2021-11-06 | Node va brauzerda ishlaydi, Next server moduliga mos | O‘rta, sahifalash va joylashuv dasturga tegishli |
| @cantoo/pdf-lib | 2.11.1 | 2026-09-15 | Original PDFDocument API va upstream fontkitga moslik hujjatlashtirilgan | O‘rta, fork regressiya testi kerak |
| @cantoo/fontkit | 2.0.12 | 2026-11-20 kuni paket va litsenziya tekshirildi | Cantoo PDF va Unicode TTF bilan amalda tekshirildi | Kichik |
| docx | 9.16.0 | 2026-11-19 | Node >=16, mahalliy Node 24 mos | O‘rta, shartnoma maketi |
| pdfjs-dist | 6.5.438 | 2026-11-01 | Node >=22.13 yoki >=24, brauzer ESM worker, Reactga bog‘liq emas | O‘rta, bir xil worker versiyasi va koordinata o‘girish |
| react-pdf | 11.1.0 | 2026-11-14 | React va react-dom ^19 peer dependency | Hozirgi React 18 uchun migratsiya talab qiladi |
| mammoth | 1.13.0 | 2026-09-26 | Node >=12, serverda raw-text ekstraksiya | Kichik |
| tesseract.js | 7.0.0 | 2025-12-15 | Brauzer yoki Node worker, WASM va til fayllari | O‘rta, model yuklash va hisob resursi |
| socket.io | 4.8.4 | 2026-09-25 | Alohida websocket hayot sikli kerak | O‘rta |
| @fullcalendar/core | 7.1.5 | 2026-11-12 | Core UI bilan ishlash, tanlangan React wrapper peers qayta tekshiriladi | O‘rta |
| @langchain/langgraph | 1.7.5 | 2026-11-17 | Orkestratsiya klienti va qo‘shimcha core paketlar | O‘rta yoki katta |
| Nodemailer | 10.6.1 | 2026-11-20, loyihada mavjud | Next Node runtime bilan | Mavjud |
| ioredis | 6.0.0 | 2026-07-31, loyihada mavjud | Node server bilan | Mavjud |
| AWS S3 SDK | 3.1173.0 | 2026-11-19, loyihada mavjud | Node server bilan | Mavjud |

Jadvaldagi package versiya, sana, engine va litsenziya qiymatlari rasmiy npm metama’lumotlaridan olindi. O‘rnatish yakunida lockfile, audit va build asosida aniq ishlatilgan versiya qayd etiladi. [npm registry](https://registry.npmjs.org/)

`pdf-lib` va fontkit uchun uzoq nashr oralig‘i kuzatildi. Bu ikkisi PDF rasm/matn joylashtirishga mos barqaror API beradi. Faol maintenance holati haqida yangi nashr dalili yetarli emas. Integratsiya uchun Unicode shrift, ko‘p sahifa, uzun band, PNG alpha va PDF matn ekstraksiyasi regressiyalari kerak. [pdf-lib releases](https://github.com/Hopding/pdf-lib/releases) · [fontkit package](https://registry.npmjs.org/@pdf-lib%2ffontkit)

`@cantoo/pdf-lib` 2.11.1 nashri MIT litsenziyali faol fork sifatida qo‘shimcha baholandi. Uning rasmiy READMEsi original API saqlanishini, Node va brauzer muhitlarini hamda upstream fontkit mosligini bayon qiladi. Tanlovda aynan imzolash, Unicode va sahifa joylashuvi sinovlari hal qiluvchi bo‘ladi. [Cantoo fork](https://github.com/cantoo-scribe/pdf-lib) · [Package metama’lumoti](https://registry.npmjs.org/@cantoo%2fpdf-lib)

Amaliy integratsiyada eski `@pdf-lib/fontkit` bilan shrift subset yaratish xatosi takrorlandi. Mos `@cantoo/fontkit` 2.0.12 o‘rnatilgach, Unicode va uch imzoli PDF/DOCX sinovlari o‘tdi. Inter shriftlari mahalliy fayllardan olinadi. PDF.js worker fayli va Apache-2.0 bildirishnomasi `public/` ichida saqlangan. [Cantoo fontkit](https://github.com/cantoo-scribe/fontkit)

DOCX tarkibi `yauzl` bilan ketma-ket ochilib, 30 MiB umumiy hajm va 2000 yozuv chegarasida tekshiriladi. `image-size` native PNG/JPEG dekodlashdan oldin 36 megapiksel chegarasini qo‘llaydi. Skan PDF rastri eng uzun tomoni 1400 piksel bilan chegaralangan. Uchala himoya avtomatlashtirilgan zararli kirish sinovidan o‘tdi. [Yauzl](https://github.com/thejoshwolfe/yauzl) · [Image-size](https://codeberg.org/image-size/image-size)

`signature_pad` nuqta guruhlari orqali undo va qayta chizishni, canvas eksportini va pressure ma’lumotini qo‘llaydi. Yuqori DPI o‘lchami, `touch-action`, chiziq chegaralari va resize paytidagi koordinatalar dastur integratsiyasida tekshiriladi. Qo‘llab-quvvatlanadigan qurilmada stylus bosimi saqlanadi. Inson imzosi bilan PDFga qo‘yilgan tasvir va ERI xizmatining kriptografik tasdig‘i uchun alohida jarayonlar yaratiladi. [README](https://github.com/szimek/signature_pad) · [Changelog](https://github.com/szimek/signature_pad/blob/master/CHANGELOG.md)

## Xavfsizlik va hujjat tahlili

PDF.js rasmiy GHSA-hq66-cqwq-w95j xabari zararli PDF va scripting yoqilgan viewer kombinatsiyasidagi JavaScript bajarilishini bayon qiladi. Xabarda 6.2.108 patched versiya ko‘rsatilgan. Tanlangan 6.5.438 undan keyingi nashr. Klient faqat zarur PDF render APIlarini ishlatadi, viewer scripting funksiyasi o‘chiq saqlanadi, JavaScript amallari bajarilmaydi. Worker fayli aynan o‘rnatilgan paketdan olinadi. PDFdan olingan matn LLM uchun ishonchsiz hujjat mazmuni sifatida ko‘riladi. [Rasmiy advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j)

Mammoth raw-text API bilan DOCX ichidagi matn olinadi. Kutubxonaning HTML konvertatsiyasi sanitizatsiya majburiyatini dasturga qoldiradi. Shu sababli AI uchun xom matn ishlatiladi va hujjat matni foydalanuvchi interfeysida oddiy matn sifatida chiziladi. ZIP hajmi va ajratilgan matn chegaralari backendda tekshiriladi. [Mammoth security](https://github.com/mwilliamson/mammoth.js#security)

Tesseract ekotizimida o‘zbek lotin va kirill til fayllari mavjud. OCR natijasidagi ism, sana, summa va bandlar manba sahifasi bilan ko‘rsatiladi, foydalanuvchi ularni tasdiqlashi mumkin. Qo‘lyozma sifati va hujjat haqiqiyligi uchun alohida inson tekshiruvi kerak. Docling keyingi bosqichda murakkab maket, jadvallar va qo‘shimcha OCR engine tanlash imkonini beradi. Model fayllarining litsenziyasi kod litsenziyasidan alohida tekshiriladi. [Tesseract til jadvali](https://github.com/tesseract-ocr/tessdoc/blob/main/Data-Files.md) · [Docling OCR](https://github.com/docling-project/docling/blob/main/docs/concepts/OCR.md)

## Saqlash va infratuzilma litsenziyalari

Node AES-GCM lokal saqlash va mavjud PostgreSQL state tranzaksiyasi MVPning izchil saqlash qatlamidir. Versiyalar, imzolar, rozilik va audit yozuvlari server vakolati bilan shu tranzaksiya chegarasida saqlanadi. Yjs hamkorlikda tahrirni yengillashtirishi mumkin, yakuniy hujjat versiyasi va imzolovchi roziligi esa server holat mashinasida saqlanadi. [Node crypto](https://nodejs.org/api/crypto.html) · [Yjs](https://github.com/yjs/yjs)

MinIO repozitoriysi 2026-04-25 kuni arxivlangan va AGPL-3.0 litsenziyasiga ega. Mavjud Apache-2.0 litsenziyali S3 klienti obyekt saqlash xizmatidan alohida komponentdir. Tijoriy deploymentda tanlangan server distributivi, xizmat shartlari va litsenziya majburiyatlari tekshiriladi. [MinIO license va archive holati](https://github.com/minio/minio/blob/master/LICENSE) · [AWS SDK](https://github.com/aws/aws-sdk-js-v3)

Redis server litsenziyasi versiyaga bog‘liq. 7.2 va oldingi nashrlar BSD-3-Clause, 7.4 qatori RSALv2 yoki SSPLv1, 8+ qatori RSALv2, SSPLv1 yoki AGPLv3 variantlarini beradi. `ioredis` klientining MIT litsenziyasi alohida. Infratuzilma uchun Valkey BSD-3-Clause muqobili baholandi. [Redis rasmiy litsenziyalari](https://redis.io/legal/licenses/) · [Valkey](https://github.com/valkey-io/valkey)

## Video, aloqa, kalendar va to‘lov

Jitsi Meet va LiveKit self-host media uchun ochiq kodli variantlardir. Ular media server, TLS, TURN/STUN va operatsion monitoringni talab qiladi. Mavjud uchrashuv havolasi integratsiyasi bilan boshlash mumkin. Har bir sessiya havolasi va xonaga kirish vakolati alohida tekshiriladi. Media xizmatiga ulanish sinovi uning haqiqiy integratsiya holatini belgilaydi. [Jitsi](https://github.com/jitsi/jitsi-meet) · [LiveKit](https://github.com/livekit/livekit)

Mavjud bron qilish logikasi taraflar va mediatorlar to‘qnashuvini serverda tekshiradi. FullCalendar core MIT bo‘lib, premium scheduler alohida litsenziya shartlariga ega. Muloqot uchun avval backend vakolatli xona va xabar yozuvlari yaratiladi. Socket.IO yoki SSE tanlovi real-time yuk va mahalliy runtime ehtiyojiga qarab qilinadi. [FullCalendar litsenziyalari](https://fullcalendar.io/license) · [Socket.IO](https://github.com/socketio/socket.io)

Nodemailer SMTP outbox va ilova bildirishnomalarida qayta ishlatiladi. Telegram, SMS, kalendar va payment adapterlari haqiqiy hisob ma’lumotlari hamda xizmat shartlari bilan yoqiladi. Payme Business rasmiy hujjatida Merchant API, sandbox va merchant identifikatori uchun alohida jarayonlar mavjud. Har bir to‘lov hodisasi identifikator, idempotency va server tekshiruvi bilan qayd etiladi. [Nodemailer](https://github.com/nodemailer/nodemailer) · [Payme Business](https://developer.help.paycom.uz/)

## O‘zbek ovozi

Whisper rasmiy tokenizeri `uz` tilini sanaydi, loyiha kod va weights uchun MIT litsenziyasini ko‘rsatadi. Mahalliy inference STT uchun nomzod. O‘zbek fuqarolik nizolari audio to‘plamida xatolik darajasi, summa va sana aniqligi, lotin/kirill transkripsiyasi, shovqin va kechikish o‘lchanishi kerak. [Whisper](https://github.com/openai/whisper) · [Til kodi](https://github.com/openai/whisper/blob/main/whisper/tokenizer.py)

Sherpa-onnx Apache-2.0 runtime offline STT va TTS modellarini ishlata oladi. Har bir voice yoki STT modelining til qamrovi, vazni va litsenziyasi alohida qayd etiladi. Ushbu tadqiqot o‘zbek TTS ovozining sifatiga benchmark natijasini bermaydi. [Sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) · [TTS model katalogi](https://k2-fsa.github.io/sherpa/onnx/tts/pretrained_models/vits.html)

Original rhasspy/piper 2025-10-06 kuni arxivlangan. OHF-Voice/piper1-gpl rivojlantirilayotgan GPL-3.0 yo‘nalishi va alohida voice litsenziyalarini ko‘rsatadi. Uni tarqatish yoki dasturga qo‘shishdan avval tanlangan distributiv va model majburiyatlari baholanadi. [Arxivlangan Piper](https://github.com/rhasspy/piper) · [OHF Piper](https://github.com/OHF-Voice/piper1-gpl)

## Hujjat aylanishi va tijoriy foydalanish

MIT, ISC, BSD va Apache litsenziyali tanlangan paketlarda tegishli license, copyright va NOTICE fayllari tarqatish tarkibida saqlanadi. Documenso, OpenSign va GPL Piper kabi reciprocal litsenziyali nomzodlar uchun konkret integratsiya usuli hamda source taqdim etish majburiyatlari baholanadi. Tanlangan paket va subkataloglarning LICENSE fayllari aniq commit bo‘yicha tekshiriladi. Ushbu MVP kichik paketlar bilan mavjud domen logikasini kengaytiradi. [Documenso license](https://github.com/documenso/documenso/blob/main/LICENSE) · [OpenSign](https://github.com/OpenSignLabs/OpenSign) · [Piper COPYING](https://github.com/OHF-Voice/piper1-gpl/blob/main/COPYING)

## Qaror

Vazifa mahalliy ilovaga uch tarafli imzolash, hujjat generatsiyasi, maxfiy bayonlar va ijro kuzatuvini birlashtirishdir.

1. Kichik permissiv paketlar va mavjud Next/AES/RBAC qatlamini kengaytirish. Integratsiya hajmi boshqariladigan, PDF va imzo xatti-harakati aniq testlanadi.
2. Documenso yoki OpenSign bilan alohida hujjat aylanish xizmatini qo‘shish. Keng tayyor funksiyalar, kattaroq stack va reciprocal litsenziya tahlili kerak.
3. Docling, LangGraph va media serverlar bilan bir nechta alohida xizmatlarni birdan joriy etish. Ilg‘or imkoniyatlar, qo‘shimcha model, infra va operatsion test talabi bor.

MVP uchun birinchi variant tanlandi. Qolgan variantlar hajm, o‘zbek tili sifat o‘lchovi va real xizmat ehtiyoji bo‘yicha keyingi bosqichlarda baholanadi.
