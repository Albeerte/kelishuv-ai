# KELIŞUV AI oçiq kod tadqiqoti

Tekşiriş sanasi 2026-11-20. Versiyalar npm registridagi `dist-tags.latest` va loyiha repozitoriylari orqali tekşirildi. Integratsiya holati bu hujjat yozilgan paytdagi tanlovni bildiradi. Işlayotgan integratsiya holati build va jarayon sinovlari bilan yakuniy tekşiriladi.

## Mavjud loyiha va tanlov

Loyihada Next.js 15.5.29, React 18.3.1, TypeScript, Tailwind, Radix, Zustand, NextAuth 5 beta, Prisma 6.19, AES-256-GCM lokal saqlaş, Zod, SMTP outbox, S3 klienti, uçraşuvlar va rol tekşiruvlari mavjud. Ixtiyoriy FastAPI/Qdrant xizmati va Lex.uz tanlangan moddalar katalogi yaratilgan. Mahalliy Node versiyasi 24.19.0. Mavjud runtime uçun `npm audit --omit=dev` natijasi nol ma’lum zaiflik böldi. Bu ölçov keyingi paket örnatişdan söng yangilanadi. [Loyiha paketi](C:/Users/student/Documents/ChatGPT/lex/package.json)

Işlayotgan MVP `signature_pad` 5.1.5, `@cantoo/pdf-lib` 2.11.1, `@cantoo/fontkit` 2.0.12, `docx` 9.16.0, `pdfjs-dist` 6.5.438, `mammoth` 1.13.0 va `@napi-rs/canvas` 1.1.1 paketlarini işlatadi. Mahalliy Qwen3-VL tasvir va skan ekstraksiyasi bilan tekşirildi. Tesseract va Docling keyingi OCR baholaşiga kiritilgan.

## Komponentlar jadvali

| Komponent | Repository | Litsenziya | Maqsad | Integratsiya holati |
| --- | --- | --- | --- | --- |
| Qölda imzo, sensor, qalam, siçqonça | [signature_pad](https://github.com/szimek/signature_pad) | MIT | Silliq canvas, PNG eksporti, nuqta guruhlari, bosim ma’lumoti | MVP uçun tanlandi |
| PDF yaratiş uçun boşlanğiç nomzod | [pdf-lib](https://github.com/Hopding/pdf-lib) | MIT | PDF sahifalari va koordinatalar | Cantoo fork baholaşiga asos böldi |
| PDF yaratiş va imzo joylaştiriş | [Cantoo pdf-lib](https://github.com/cantoo-scribe/pdf-lib) | MIT | PDF sahifalari, rasm va matnni aniq koordinatalarga yoziş | Integratsiya va uç imzoli PDF render sinovi ötdi |
| Unicode şriftlar | [Cantoo fontkit](https://github.com/cantoo-scribe/fontkit) | MIT | Özbek va kirill matni uçun mahalliy TTF şriftni PDFga joylaştiriş | Integratsiya va kirill regressiya sinovi ötdi |
| DOCX generator | [docx](https://github.com/dolanmiu/docx) | MIT | Şartnoma bölimlari, jadval va imzo tasvirli Word hujjati | MVP uçun tanlandi |
| PDF köriş va matn oliş | [PDF.js](https://github.com/mozilla/pdf.js) | Apaçe-2.0 | Canvas preview, sahifa ölçami va matn ajratiş | Bevosita klient API tanlandi |
| React PDF qobiği | [react-pdf](https://github.com/wojtekmaj/react-pdf) | MIT | PDF.js uçun React komponentlari | React 19 talab qiladigan eng yangi naşr keyingi migratsiyada baholanadi |
| DOCX matn ajratiş | [mammoth.js](https://github.com/mwilliamson/mammoth.js) | BSD-2-Clause | DOCXdan xom matn oliş | MVP uçun tanlandi |
| ZIP oqimini tekşiriş | [yauzl](https://github.com/thejoshwolfe/yauzl) | MIT | Markaziy katalog, deklarativ va haqiqiy oçilgan hajm çegarasi | 3.4.0 integratsiya va soxta ZIP metama’lumot sinovi ötdi |
| Rasm sarlavhasini öqiş | [image-size](https://codeberg.org/image-size/image-size) | MIT | PNG/JPEG ölçamini native dekodlaşdan oldin tekşiriş | 2.1.0 integratsiya va katta PNG regressiyasi ötdi |
| Rasm va skan OCR | [tesseract.js](https://github.com/naptha/tesseract.js) | Apaçe-2.0 | Brauzer yoki Node worker orqali OCR | Lokal worker va til fayllari bilan nomzod |
| Özbek OCR til fayllari | [Tesseract data](https://github.com/tesseract-ocr/tessdata) | Apaçe-2.0 | `uzb`, `uzb_cyrl`, `rus` tanlaş | Til modeli böyiça sinov talab etiladi |
| Murakkab PDF maketi va OCR | [Docling](https://github.com/docling-project/docling) | MIT kod, alohida model litsenziyalari | Jadval, sahifa tuzilişi va keng formatli ekstraksiya | Ilğor hujjat tahlili bosqiçi |
| Legal RAG va vektor qidiruv | [Qdrant](https://github.com/qdrant/qdrant) | Apaçe-2.0 | Vektor qidiruv va versiyalangan kolleksiya aliasi | Mavjud ixtiyoriy adapter qayta işlatiladi |
| PostgreSQL vektor kengaytmasi | [pgvector](https://github.com/pgvector/pgvector) | PostgreSQL | Bir DB içida vektor qidiruv | Katta PostgreSQL migratsiyasi uçun muqobil |
| AI orkestratsiya | [LangGraph.js](https://github.com/langchain-ai/langgraphjs) | MIT | Holatli köp bosqiçli AI grafi | Yangi dependency zarurati isbotlanganda qöşiladi |
| Autentifikatsiya va sessiyalar | [Auth.js / NextAuth](https://github.com/nextauthjs/next-auth) | ISC | Hisob, sessiya, JWT | Mavjud integratsiya saqlanadi |
| Alohida ruxsat engine | [OpenFGA](https://github.com/openfga/openfga) | Apaçe-2.0 | Köp taşkilotli munosabatga asoslangan vakolat | Korporativ bosqiç uçun nomzod |
| ORM va tranzaksiyalar | [Prisma](https://github.com/prisma/prisma) | Apaçe-2.0 | PostgreSQL va state tranzaksiyasi | Mavjud integratsiya saqlanadi |
| Şifrlangan fayl saqlaş | [Node.js crypto](https://nodejs.org/api/crypto.html) | Node.js litsenziyasi | AES-GCM, SHA-256 va tasodifiy identifikatorlar | Mavjud lokal saqlaş qayta işlatiladi |
| S3 API klienti | [AWS SDK v3](https://github.com/aws/aws-sdk-js-v3) | Apaçe-2.0 | Ixtiyoriy obyekt saqlaş | Mavjud S3 adapteri |
| Davom ettiriladigan upload | [tus-js-client](https://github.com/tus/tus-js-client) | MIT | Katta fayllarni bölib va qayta yuboriş | Katta upload talabi paydo bölganda baholanadi |
| Video uçraşuv | [Jitsi Meet](https://github.com/jitsi/jitsi-meet) | Apaçe-2.0 | Hosted yoki self-host WebRTC uçraşuvi | Mavjud taşqi uçraşuv havolasi, xizmat tekşiruvi alohida |
| Öz serveridagi real-time media | [LiveKit](https://github.com/livekit/livekit) | Apaçe-2.0 | SFU, tokenli media xonalari, React klient | Alohida media infratuzilmasi bosqiçi |
| Real-time yozişma | [Socket.IO](https://github.com/socketio/socket.io) | MIT | Xona va rolga boğlangan xabarlar | SSE yoki polling MVP ehtiyojini qoplasa qöşimça paket talab qilinmaydi |
| Hujjatni hamkorlikda tahrirlaş | [Yjs](https://github.com/yjs/yjs) | MIT | CRDT orqali parallel tahrir | Hozirgi versiya va xeş modeli, hamkorlik keyingi bosqiç |
| Kalender UI | [FullCalendar](https://github.com/fullcalendar/fullcalendar) | MIT core | Körinadigan uçraşuv kalendari | Mavjud booking engine saqlanadi, kalendar UI ixtiyoriy |
| Email xabarlari | [Nodemailer](https://github.com/nodemailer/nodemailer) | MIT-0 | SMTP jönatiş | Mavjud outbox va adapter |
| Redis-protokol klienti | [ioredis](https://github.com/redis/ioredis) | MIT | Umumiy rate limit | Mavjud ixtiyoriy adapter |
| Permissiv keş serveri | [Valkey](https://github.com/valkey-io/valkey) | BSD-3-Clause | Redis-protokolga mos mahalliy keş | Infratuzilma varianti |
| Tölov qabul qiliş | [Payme Business docs](https://developer.help.paycom.uz/) | Xizmat şartlari va merçant şartnomasi | Merçant API orqali haqiqiy tölovlar | Kalitlar va merçant ulanişi bilan adapter |
| Özbek nutqini matnga oliş | [Whisper](https://github.com/openai/whisper) | MIT kod va weights | Lokal köp tilli STT, tokenizerda `uz` mavjud | Özbek audio bençmarkidan söng bosqiç 2 |
| Lokal STT va TTS runtime | [şerpa-onnx](https://github.com/k2-fsa/sherpa-onnx) | Apaçe-2.0 runtime | ONNX modellar, offline audio xizmatlari | Har bir modelning til sifati va litsenziyasi alohida baholanadi |
| Lokal TTS engine | [OHF Piper](https://github.com/OHF-Voice/piper1-gpl) | GPL-3.0 engine, voice alohida | Mahalliy ovoz sintezi | Litsenziya majburiyatlari va özbek voice testi bilan keyingi nomzod |
| Töliq imzolaş platformasi | [Documenso](https://github.com/documenso/documenso) | AGPL-3.0 | Hujjat aylanişi va imzolaş | Iş jarayonini örganiş uçun nomzod, integratsiya hajmi katta |
| Töliq imzolaş platformasi | [OpenSign](https://github.com/OpenSignLabs/OpenSign) | AGPL-3.0 | PDF maydonlar va köp imzolovçili jarayon | Iş jarayonini örganiş uçun nomzod, alohida stack |

## Naşrlar, moslik va integratsiya xarajati

| Paket | Kuzatilgan latest | Naşr va faollik dalili | Stack mosligi | Integratsiya hajmi |
| --- | --- | --- | --- | --- |
| signature_pad | 5.1.5 | 2026-11-20, 5.1.4 naşri 2026-07-31 | Frameworkdan mustaqil TypeScript, React ref orqali klientda | Kiçik, canvas hayot sikli va eksport |
| pdf-lib | 1.17.1 | 2021-11-06 | Node va brauzerda işlaydi, Next server moduliga mos | Örta, sahifalaş va joylaşuv dasturga tegişli |
| @cantoo/pdf-lib | 2.11.1 | 2026-09-15 | Original PDFDocument API va upstream fontkitga moslik hujjatlaştirilgan | Örta, fork regressiya testi kerak |
| @cantoo/fontkit | 2.0.12 | 2026-11-20 kuni paket va litsenziya tekşirildi | Cantoo PDF va Unicode TTF bilan amalda tekşirildi | Kiçik |
| docx | 9.16.0 | 2026-11-19 | Node >=16, mahalliy Node 24 mos | Örta, şartnoma maketi |
| pdfjs-dist | 6.5.438 | 2026-11-01 | Node >=22.13 yoki >=24, brauzer ESM worker, Reactga boğliq emas | Örta, bir xil worker versiyasi va koordinata ögiriş |
| react-pdf | 11.1.0 | 2026-11-14 | React va react-dom ^19 peer dependency | Hozirgi React 18 uçun migratsiya talab qiladi |
| mammoth | 1.13.0 | 2026-09-26 | Node >=12, serverda raw-text ekstraksiya | Kiçik |
| tesseract.js | 7.0.0 | 2025-12-15 | Brauzer yoki Node worker, WASM va til fayllari | Örta, model yuklaş va hisob resursi |
| socket.io | 4.8.4 | 2026-09-25 | Alohida websocket hayot sikli kerak | Örta |
| @fullcalendar/core | 7.1.5 | 2026-11-12 | Core UI bilan işlaş, tanlangan React wrapper peers qayta tekşiriladi | Örta |
| @langçain/langgraph | 1.7.5 | 2026-11-17 | Orkestratsiya klienti va qöşimça core paketlar | Örta yoki katta |
| Nodemailer | 10.6.1 | 2026-11-20, loyihada mavjud | Next Node runtime bilan | Mavjud |
| ioredis | 6.0.0 | 2026-07-31, loyihada mavjud | Node server bilan | Mavjud |
| AWS S3 SDK | 3.1173.0 | 2026-11-19, loyihada mavjud | Node server bilan | Mavjud |

Jadvaldagi package versiya, sana, engine va litsenziya qiymatlari rasmiy npm metama’lumotlaridan olindi. Örnatiş yakunida lockfile, audit va build asosida aniq işlatilgan versiya qayd etiladi. [npm registry](https://registry.npmjs.org/)

`pdf-lib` va fontkit uçun uzoq naşr oraliği kuzatildi. Bu ikkisi PDF rasm/matn joylaştirişga mos barqaror API beradi. Faol maintenance holati haqida yangi naşr dalili yetarli emas. Integratsiya uçun Unicode şrift, köp sahifa, uzun band, PNG alpha va PDF matn ekstraksiyasi regressiyalari kerak. [pdf-lib releases](https://github.com/Hopding/pdf-lib/releases) · [fontkit package](https://registry.npmjs.org/@pdf-lib%2ffontkit)

`@cantoo/pdf-lib` 2.11.1 naşri MIT litsenziyali faol fork sifatida qöşimça baholandi. Uning rasmiy READMEsi original API saqlanişini, Node va brauzer muhitlarini hamda upstream fontkit mosligini bayon qiladi. Tanlovda aynan imzolaş, Unicode va sahifa joylaşuvi sinovlari hal qiluvçi böladi. [Cantoo fork](https://github.com/cantoo-scribe/pdf-lib) · [Package metama’lumoti](https://registry.npmjs.org/@cantoo%2fpdf-lib)

Amaliy integratsiyada eski `@pdf-lib/fontkit` bilan şrift subset yaratiş xatosi takrorlandi. Mos `@cantoo/fontkit` 2.0.12 örnatilgaç, Unicode va uç imzoli PDF/DOCX sinovlari ötdi. Inter şriftlari mahalliy fayllardan olinadi. PDF.js worker fayli va Apaçe-2.0 bildirişnomasi `public/` içida saqlangan. [Cantoo fontkit](https://github.com/cantoo-scribe/fontkit)

DOCX tarkibi `yauzl` bilan ketma-ket oçilib, 30 MiB umumiy hajm va 2000 yozuv çegarasida tekşiriladi. `image-size` native PNG/JPEG dekodlaşdan oldin 36 megapiksel çegarasini qöllaydi. Skan PDF rastri eng uzun tomoni 1400 piksel bilan çegaralangan. Uçala himoya avtomatlaştirilgan zararli kiriş sinovidan ötdi. [Yauzl](https://github.com/thejoshwolfe/yauzl) · [Image-size](https://codeberg.org/image-size/image-size)

`signature_pad` nuqta guruhlari orqali undo va qayta çizişni, canvas eksportini va pressure ma’lumotini qöllaydi. Yuqori DPI ölçami, `touch-action`, çiziq çegaralari va resize paytidagi koordinatalar dastur integratsiyasida tekşiriladi. Qöllab-quvvatlanadigan qurilmada stylus bosimi saqlanadi. Inson imzosi bilan PDFga qöyilgan tasvir va ERI xizmatining kriptografik tasdiği uçun alohida jarayonlar yaratiladi. [README](https://github.com/szimek/signature_pad) · [Çangelog](https://github.com/szimek/signature_pad/blob/master/CHANGELOG.md)

## Xavfsizlik va hujjat tahlili

PDF.js rasmiy GHSA-hq66-cqwq-w95j xabari zararli PDF va scripting yoqilgan viewer kombinatsiyasidagi JavaScript bajarilişini bayon qiladi. Xabarda 6.2.108 patçed versiya körsatilgan. Tanlangan 6.5.438 undan keyingi naşr. Klient faqat zarur PDF render APIlarini işlatadi, viewer scripting funksiyasi öçiq saqlanadi, JavaScript amallari bajarilmaydi. Worker fayli aynan örnatilgan paketdan olinadi. PDFdan olingan matn LLM uçun işonçsiz hujjat mazmuni sifatida köriladi. [Rasmiy advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j)

Mammoth raw-text API bilan DOCX içidagi matn olinadi. Kutubxonaning HTML konvertatsiyasi sanitizatsiya majburiyatini dasturga qoldiradi. Şu sababli AI uçun xom matn işlatiladi va hujjat matni foydalanuvçi interfeysida oddiy matn sifatida çiziladi. ZIP hajmi va ajratilgan matn çegaralari backendda tekşiriladi. [Mammoth security](https://github.com/mwilliamson/mammoth.js#security)

Tesseract ekotizimida özbek lotin va kirill til fayllari mavjud. OCR natijasidagi ism, sana, summa va bandlar manba sahifasi bilan körsatiladi, foydalanuvçi ularni tasdiqlaşi mumkin. Qölyozma sifati va hujjat haqiqiyligi uçun alohida inson tekşiruvi kerak. Docling keyingi bosqiçda murakkab maket, jadvallar va qöşimça OCR engine tanlaş imkonini beradi. Model fayllarining litsenziyasi kod litsenziyasidan alohida tekşiriladi. [Tesseract til jadvali](https://github.com/tesseract-ocr/tessdoc/blob/main/Data-Files.md) · [Docling OCR](https://github.com/docling-project/docling/blob/main/docs/concepts/OCR.md)

## Saqlaş va infratuzilma litsenziyalari

Node AES-GCM lokal saqlaş va mavjud PostgreSQL state tranzaksiyasi MVPning izçil saqlaş qatlamidir. Versiyalar, imzolar, rozilik va audit yozuvlari server vakolati bilan şu tranzaksiya çegarasida saqlanadi. Yjs hamkorlikda tahrirni yengillaştirişi mumkin, yakuniy hujjat versiyasi va imzolovçi roziligi esa server holat maşinasida saqlanadi. [Node crypto](https://nodejs.org/api/crypto.html) · [Yjs](https://github.com/yjs/yjs)

MinIO repozitoriysi 2026-04-25 kuni arxivlangan va AGPL-3.0 litsenziyasiga ega. Mavjud Apaçe-2.0 litsenziyali S3 klienti obyekt saqlaş xizmatidan alohida komponentdir. Tijoriy deploymentda tanlangan server distributivi, xizmat şartlari va litsenziya majburiyatlari tekşiriladi. [MinIO license va arçive holati](https://github.com/minio/minio/blob/master/LICENSE) · [AWS SDK](https://github.com/aws/aws-sdk-js-v3)

Redis server litsenziyasi versiyaga boğliq. 7.2 va oldingi naşrlar BSD-3-Clause, 7.4 qatori RSALv2 yoki SSPLv1, 8+ qatori RSALv2, SSPLv1 yoki AGPLv3 variantlarini beradi. `ioredis` klientining MIT litsenziyasi alohida. Infratuzilma uçun Valkey BSD-3-Clause muqobili baholandi. [Redis rasmiy litsenziyalari](https://redis.io/legal/licenses/) · [Valkey](https://github.com/valkey-io/valkey)

## Video, aloqa, kalendar va tölov

Jitsi Meet va LiveKit self-host media uçun oçiq kodli variantlardir. Ular media server, TLS, TURN/STUN va operatsion monitoringni talab qiladi. Mavjud uçraşuv havolasi integratsiyasi bilan boşlaş mumkin. Har bir sessiya havolasi va xonaga kiriş vakolati alohida tekşiriladi. Media xizmatiga ulaniş sinovi uning haqiqiy integratsiya holatini belgilaydi. [Jitsi](https://github.com/jitsi/jitsi-meet) · [LiveKit](https://github.com/livekit/livekit)

Mavjud bron qiliş logikasi taraflar va mediatorlar töqnaşuvini serverda tekşiradi. FullCalendar core MIT bölib, premium sçeduler alohida litsenziya şartlariga ega. Muloqot uçun avval backend vakolatli xona va xabar yozuvlari yaratiladi. Socket.IO yoki SSE tanlovi real-time yuk va mahalliy runtime ehtiyojiga qarab qilinadi. [FullCalendar litsenziyalari](https://fullcalendar.io/license) · [Socket.IO](https://github.com/socketio/socket.io)

Nodemailer SMTP outbox va ilova bildirişnomalarida qayta işlatiladi. Telegram, SMS, kalendar va payment adapterlari haqiqiy hisob ma’lumotlari hamda xizmat şartlari bilan yoqiladi. Payme Business rasmiy hujjatida Merçant API, sandbox va merçant identifikatori uçun alohida jarayonlar mavjud. Har bir tölov hodisasi identifikator, idempotency va server tekşiruvi bilan qayd etiladi. [Nodemailer](https://github.com/nodemailer/nodemailer) · [Payme Business](https://developer.help.paycom.uz/)

## Özbek ovozi

Whisper rasmiy tokenizeri `uz` tilini sanaydi, loyiha kod va weights uçun MIT litsenziyasini körsatadi. Mahalliy inference STT uçun nomzod. Özbek fuqarolik nizolari audio töplamida xatolik darajasi, summa va sana aniqligi, lotin/kirill transkripsiyasi, şovqin va keçikiş ölçanişi kerak. [Whisper](https://github.com/openai/whisper) · [Til kodi](https://github.com/openai/whisper/blob/main/whisper/tokenizer.py)

Şerpa-onnx Apaçe-2.0 runtime offline STT va TTS modellarini işlata oladi. Har bir voice yoki STT modelining til qamrovi, vazni va litsenziyasi alohida qayd etiladi. Uşbu tadqiqot özbek TTS ovozining sifatiga bençmark natijasini bermaydi. [Şerpa-onnx](https://github.com/k2-fsa/sherpa-onnx) · [TTS model katalogi](https://k2-fsa.github.io/sherpa/onnx/tts/pretrained_models/vits.html)

Original rhasspy/piper 2025-10-06 kuni arxivlangan. OHF-Voice/piper1-gpl rivojlantirilayotgan GPL-3.0 yönalişi va alohida voice litsenziyalarini körsatadi. Uni tarqatiş yoki dasturga qöşişdan avval tanlangan distributiv va model majburiyatlari baholanadi. [Arxivlangan Piper](https://github.com/rhasspy/piper) · [OHF Piper](https://github.com/OHF-Voice/piper1-gpl)

## Hujjat aylanişi va tijoriy foydalaniş

MIT, ISC, BSD va Apaçe litsenziyali tanlangan paketlarda tegişli license, copyright va NOTICE fayllari tarqatiş tarkibida saqlanadi. Documenso, OpenSign va GPL Piper kabi reciprocal litsenziyali nomzodlar uçun konkret integratsiya usuli hamda source taqdim etiş majburiyatlari baholanadi. Tanlangan paket va subkataloglarning LICENSE fayllari aniq commit böyiça tekşiriladi. Uşbu MVP kiçik paketlar bilan mavjud domen logikasini kengaytiradi. [Documenso license](https://github.com/documenso/documenso/blob/main/LICENSE) · [OpenSign](https://github.com/OpenSignLabs/OpenSign) · [Piper COPYING](https://github.com/OHF-Voice/piper1-gpl/blob/main/COPYING)

## Qaror

Vazifa mahalliy ilovaga uç tarafli imzolaş, hujjat generatsiyasi, maxfiy bayonlar va ijro kuzatuvini birlaştirişdir.

1. Kiçik permissiv paketlar va mavjud Next/AES/RBAC qatlamini kengaytiriş. Integratsiya hajmi boşqariladigan, PDF va imzo xatti-harakati aniq testlanadi.
2. Documenso yoki OpenSign bilan alohida hujjat aylaniş xizmatini qöşiş. Keng tayyor funksiyalar, kattaroq stack va reciprocal litsenziya tahlili kerak.
3. Docling, LangGraph va media serverlar bilan bir neçta alohida xizmatlarni birdan joriy etiş. Ilğor imkoniyatlar, qöşimça model, infra va operatsion test talabi bor.

MVP uçun birinçi variant tanlandi. Qolgan variantlar hajm, özbek tili sifat ölçovi va real xizmat ehtiyoji böyiça keyingi bosqiçlarda baholanadi.
