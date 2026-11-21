# Getsherik asosidagi Kelişuv dizayni

2026-yil 21-noyabrda Getsherik’ning ommaviy sahifasi va kabinet frontend manbasi örganildi. Kelişuv uçun iliq fon, aniq tipografika, yirik asosiy harakat va qadamli murojaat şakli tanlandi.

## Olingan manbalar

Asosiy manba [Getsherik](https://getsherik.uz/). Kompyuterdagi töğridan-töğri HTTPS ulanişi sertifikat zanjiri xatosini berdi. `--public-proxy` parametri bilan IntelliScrape’ning ommaviy HTML oliş xizmati işlatildi. Olingan manba lokal Çromium’da bajarildi va Site Deep Clone modullari orqali ölçandi.

390, 768, 1024 va 1440 px ekranlar uçun DOM, computed CSS, scroll holatlari va screenşotlar saqlandi. Desktop hover holatlari ham yiğildi. 17 ta resurs, jumladan 11 ta içki WOFF2 şrift fayli ajratildi. `partial` holati dastlabki HTTPS xatosini qayd etadi. Keyingi lokal rendering törtta ekran ölçamida tugadi.

Dalillar `.data/design-reference/getsherik-delivery/` papkasida saqlanadi.

- `raw.html` olingan ommaviy sahifa manbasini saqlaydi.
- `source/unpacked-template.html` içki sahifa şablonini saqlaydi.
- `data/at-rules.json` şriftlar, media qoidalari va keyframe animatsiyalarini saqlaydi.
- `data/dom-*.json`, `scroll-*.json` va `hover.json` brauzer ölçovlarini saqlaydi.
- `screenshots/viewport-*.png` va `full-*.png` ekran tasvirlarini saqlaydi.
- `assets.json` resurslarning manba va lokal fayl boğlanişini beradi.
- `DESIGN.md`, `design.json`, `tokens.css` va `preview.html` qayta işlatiş uçun natijalarni beradi.

Kabinet uçun ommaviy HTML, `portal.css`, `onboarding.css`, `common.js`, `onboarding.js`, `experiment.js` va `cabinet.js` ham yuklandi. Ular `.data/design-reference/getsherik/` içida joylaşgan. Kabinetning tuzilişi şu ommaviy frontend manbasidan örganildi. Şaxsiy hisob ekranlarini autentifikatsiyadan keyin köriş böyiça tekşiruv oçiq qolgan.

## Ölçangan vizual tizim

| Qism | Getsherik’dagi qiymat |
| --- | --- |
| Asosiy fon | `#F4F1E8` |
| Yoruğ yuza | `#FFFDF7` |
| Asosiy matn | `#16150F` |
| Ikkinçi darajali matn | `#5B574C` |
| Çegara | `#E4DFD1` |
| Harakat rangi | `#2E3FE8` |
| Sarlavha | Bricolage Grotesque, 400–800 |
| Matn | Instrument Sans, 400–700 |
| Texnik yozuvlar | JetBrains Mono |
| Desktop konteyneri | 1200 px |
| Tugma şakli | 999 px radius |
| Kartalar | 12–24 px atrofidagi radiuslar |
| Aniq soya | 6–10 px siljiş, 0 px xiralaşiş |

Ranglarning semantik vazifalari manba CSS va ekranlarni körib aniqlangan. Avtomatik token röyxatidagi takrorlaniş soni ölçangan elementlar sonini bildiradi.

Ommaviy sahifa çapdagi sarlavha va harakat, öngdagi mahsulot tasviri, jarayon, xizmatlar, narxlar va savol-javob bölimlaridan tuzilgan. Kabinet manbasida 820 px atrofidagi tor iş maydoni, progress, yirik savol, sodda tanlovlar va keyingi qadam boşqaruvi mavjud.

## Kelişuvga qöllangan qarorlar

Kelişuvning yaşil `#174C3C` harakat rangi, foydalanuvçi yuborgan logotip va mediator uçraşuvi surati işlatiladi. Getsherik’dan iliq fon, ikki şriftli tipografika, yumaloq tugmalar, konturli yuzalar va soddalaştirilgan boşlaş jarayoni olindi.

- Landinğdagi yirik sarlavha, röyxatdan ötiş tugmasi va ikki ustunli birinçi ekran moslaştirildi.
- Foydalanuvçi kabinetidagi asosiy harakat 64 px balandlikdagi “Yangi muammo boşlaş” tugmasidir. Işlar röyxati uning ostida turadi.
- Yangi murojaatning beş qadamli şakli markazlangan iş maydonida oçiladi. Savol, javob va davom etiş tugmasi köriş maydonining asosiy qismini egallaydi.
- Mobil tanlovlar ikki ustunda, şakl maydonlari aniq pastki çegara bilan berildi.
- Administrator körinişida yetti bölim, asosiy körsatkiçlar va nizolar jadvali mavjud.
- Röyxatdan ötiş, mediator kabineti va hujjat sahifalari ham umumiy tipografik tizimdan foydalanadi.

Yangi ölçovlar `src/app/reference.css` içida joylaşgan. U `src/app/layout.tsx` orqali asosiy uslublardan keyin yuklanadi. Murojaat şakli uçun `case-creation-shell` sinfi `src/components/application.tsx` içida yölga qarab qöşiladi.

Instrument Sans va Bricolage Grotesque’ning lotin hamda kengaytirilgan lotin WOFF2 fayllari `public/fonts/` içidan lokal yuklanadi. Kirill matni mavjud Inter şriftiga ötadi. Har ikki yangi şrift papkasiga rasmiy OFL litsenziyasi qöşilgan. [Instrument Sans litsenziyasi](https://github.com/google/fonts/blob/main/ofl/instrumentsans/OFL.txt), [Bricolage Grotesque litsenziyasi](https://github.com/google/fonts/blob/main/ofl/bricolagegrotesque/OFL.txt)

## Qayta işga tuşiriladigan pipeline

Loyiha ildizida işlating.

```powershell
npm run design:reference -- https://getsherik.uz/ --public-proxy
```

Oddiy töğridan-töğri oliş uçun URL yetarli.

```powershell
npm run design:reference -- http://127.0.0.1:2345/welcome
```

Saqlangan HTML bilan ölçovni takrorlaş mumkin.

```powershell
npm run design:reference -- https://getsherik.uz/ --html=.data/design-reference/getsherik-delivery/raw.html --output=.data/design-reference/getsherik-repeat
```

Har bir işga tuşiriş yangi vaqt belgili papka yaratadi. `--output` yangi natija papkasini beradi. Papka atomik yaratiladi. Bitta manzilga parallel yoziş urinişida faqat bitta ekstraksiya boşlanadi. Oldingi natijani takrorlaş uçun yangi papka tanlanadi. Ekranlar `--breakpoints=390,768,1024,1440` orqali beriladi. Ruxsat etilgan kengliklar 320–2560 px, köpi bilan sakkizta.

`--public-proxy` oçiq sahifa URL’ini IntelliScrape’ning hosted xizmatiga yuborişni yoqadi. Şaxsiy brauzer sessiyasini qöllaş uçun `--storage-state=path/to/state.json` mavjud. Bunday sessiya bilan töğridan-töğri ulaniş xatosi lokal xato hisobotiga tuşadi. Saqlangan HTML va proxy parametrlarini birgalikda beriş ommaviy resurslarni hosted xizmatdan olişni ham yoqadi.

Birinçi işga tuşiriş Site Deep Clone’ning `1c78e83` nusxasini va Playwright `1.65.1` runtime’ini `.data/design-tools/` içiga örnatadi. Har bir örnatiş alohida vaqtinçalik papkada tugallanib, tayyor manzilga atomik köçiriladi. Bu parallel birinçi işga tuşirişlarni qöllaydi. Örnatilgan Çrome, keyin Playwright Çromium tekşiriladi. Zarur bölsa Çromium yuklanadi. Node.js 24.19 va Git bilan tekşirildi.

Pipeline HTTP, fetç/XHR, iframe, sahifa skripti va şrift xatolarini `design.json` dagi `gaps` röyxatiga yozadi. Resurs faylining nomi URL va mazmun xeşidan olinadi. Bir URL turli mazmun qaytarganda har bir javobning öz fayli yaratiladi. Lokal mirror bir origin içidagi yönaltirişlarni brauzerga uzatadi. Şu orqali CSS va HTML içidagi nisbiy havolalar yangi manzilga nisbatan işlaydi. Boşqa origin’ga yönaltiriş xato sifatida qayd etiladi.

Qölga tuşgan fayllar soni 200 ta, alohida resurs hajmi 10 MB bilan çegaralangan. Çegaraga yetiş ham hisobotda qayd etiladi. Tarmoq va sahifa muammolari mavjud natijani `partial`, muvaffaqiyatsiz capture esa `capture-error.json` orqali `failed` deb belgilaydi.

## Yuklangan oçiq kodli vositalar

Barça manbalar `.data/design-tools/` içida. Runtime uçun işlatilgan vositalar Site Deep Clone va IntelliScrape hosted endpoint’idir.

| Vosita | Olingan versiya | Uşbu işdagi holat |
| --- | --- | --- |
| [Site Deep Clone](https://github.com/viniciuscffreitas/site-deep-clone) | `1c78e83` | DOM, computed CSS, scroll va hover modullari işlatildi |
| [IntelliScrape](https://github.com/GuixJoy/IntelliScrape) | `c049cb8` | Manba yuklandi, hosted `/scrape` orqali oçiq HTML olindi |
| [CodeCompleteMedia Site Cloner](https://github.com/CodeCompleteMedia/site-cloner) | `58618e6` | Manba yuklandi va tuzilişi örganildi |
| [Firecrawl design clone skill](https://github.com/firecrawl/firecrawl-workflows/tree/main/skills/firecrawl-website-design-clone) | `d2a9862` | Skill yuklandi, API kaliti sozlaş bosqiçi oçiq |
| [URL Extractor](https://github.com/vkmnamit/url-extractor) | `3a6f14a` | Manba yuklandi |
| [WebClone](https://github.com/AbdirahmanNomad/webclone) | `55e33e1` va main ZIP | Windows’dagi boşqaruv belgili `Icon` fayli tufayli ZIP orqali yaroqli manbalar olindi |
| [SeparateWeb](https://github.com/AUN-PN/SeparateWeb) | 404 | Berilgan repository manzili topilmadi |

WebClone ZIP manbasi `.data/design-tools/webclone/webclone-main/` içida. ZIP SHA-256 qiymati `A17CA8D572E05EA8687F2688A2885929C99A925775A50E064310BD3CD273A371`.

## Tekşiruv dalillari

Getsherik qayta capture natijasida törtta ekran profili, 17 resurs va ikki dastlabki HTTPS xatosi qayd etildi. Lokal Kelişuv capture’i `.data/design-reference/kelishuv-delivery/` içida `succeeded` holatida, törtta profil va 15 resurs bilan yakunlandi.

Brauzer tekşiruvlari landing, fuqaro kabineti, administrator, mediator, röyxatdan ötiş va murojaat şaklini qamradi. 8 ta maqsadli flow, ulardagi 9 ta WCAG auditi hamda qöşimça 24 ta WCAG auditi va klaviatura tekşiruvi ötdi. Ekranlar `.data/redesign-*.png` va `.data/focus-*.png` içida saqlangan.

Röyxatdan ötiş, qoralamani tiklaş, hujjat yuklaş, taklif yaratiş va murojaatni yuborişni qamragan 13 ta qöşimça brauzer tekşiruvi hamda ulardagi 13 ta WCAG auditi ötdi. Sinov yaratgan uç hisob, bitta iş va uning hujjati aniq identifikatorlar böyiça çiqarildi. Yakuniy holatda beş iş, tört hisob va bitta sessiya mavjud. Audit zanjiri va 14 ta sahifa manzili qayta tekşirildi.

`npm run test:design` töqqizta holatni tekşiradi. HTTP va fetç/iframe xatolari, hover’dan keyingi ketma-ket rasmlar, bir URL’dagi turli mazmunlar, mirror yönaltirişlari, xato hujjatga navigatsiya, ikki qiya çiziq bilan boşlangan URL yöli, bitta papkaga parallel yoziş, parallel birinçi örnatiş va Git metama’lumoti xatosida jarayonning yakunlanişi sinovdan ötadi. Har bir faylning haqiqiy hajmi manifest bilan soliştiriladi. Yönaltirilgan CSS içidagi nisbiy rasm havolasi ham tekşiriladi. Birinçi örnatiş sinovi lokal Git manbasi va npm fixture’idan foydalanadi. Töqqizta regressiya sinovi ötdi.

Logotipning 12 ta qöşimça tekşiruvi va ulardagi sakkizta WCAG auditi ötdi. Landing va murojaatning dastlabki ikki qadami 320 px ekranda özbek lotin, özbek kirill va rus tillarida tekşirildi.

Production build, ESLint, TypeScript, 12 ta mavjud regressiya testi va dependency audit tekşiruvlari ötdi. Next.js build ESLint konfiguratsiyasidagi Next.js plagini haqida ogohlantiriş berdi. Alohida ESLint tekşiruvi nol xato bilan yakunlandi.

## Yangi rasm va taqqoslaş

Boş sahifa hamda röyxatdan ötişdagi rasm `public/images/mediation-meeting.png` fayliga almaştirildi. Surat 1448 × 1086 px ölçamda built-in `imagegen` orqali yaratildi. Unda professional mediator va ikki tarafning uçraşuvi tasvirlangan.

Boş ekran ostiga mediatsiya va fuqarolik sudi uçun yonma-yon kartalar qöşildi. Summalar 40–64 px, muddat raqamlari 40–56 px şrift bilan körsatiladi. Taqqoslaş uçun 50 000 000 sömlik, davlat boji imtiyozisiz mulkiy da’vo tanlandi. Mediatorning 800 000 sömlik namuna tarifi va 2 000 000 sömlik davlat boji mavjud `mediationFee` hamda `courtCosts` funksiyalaridan olinadi.

Sud boji hisobida da’vo summasining 4%i va kamida 1 BHM qoidasi işlatiladi. Advokat, ekspertiza hamda poçta xarajatlari alohida körsatiladi. [Davlat boji töğrisidagi qonun ilovasi](https://lex.uz/docs/-4680944)

Mediatsiya uçun asosiy 30 kunlik muddat, taraflar roziligi bilan qöşimça 30 kungaça uzaytiriş imkoniyati körsatilgan. Mediator bilan yakuniy haq oldindan kelişiladi. [Mediatsiya töğrisidagi qonun, 23 va 28-moddalar](https://lex.uz/docs/-3805227)

Fuqarolik sudida tayyorlaş uçun 10 kun va tayyorlaş tugagaç köriş uçun bir oylik umumiy muddat alohida raqamlarda berilgan. Murakkab işlar böyiça uzaytiriş, arizani qabul qiliş, apellyatsiya va ijro alohida tuşuntirilgan. [FPK, 202 va 207-moddalar](https://lex.uz/docs/-3517337?ONDATE=12.09.2026)

18 ta ekran va til kombinatsiyasi, olti WCAG auditi, ikkala sahifadagi rasm yuklanişi hamda 40 px dan kiçik bölmagan asosiy raqamlar tekşirildi. 320–1440 px oraliğida gorizontal çiqiş kuzatilmadi. Production build, ESLint, TypeScript, 12 ta mavjud regressiya va mustaqil kod körigi ötdi.

Surat uçun işlatilgan yakuniy prompt quyida saqlangan.

```text
Use case: photorealistic-natural. Create a polished, natural editorial photograph for the hero of Kelishuv, an Uzbek dispute mediation platform. Landscape image about 4:3. Three Central Asian adults in a bright, warm, contemporary mediation office in Uzbekistan. An impartial professional female mediator in her forties sits centrally at a rounded light oak meeting table, listening with an open, calm expression and gently guiding a discussion. Two adult participants sit on either side, one man and one woman in understated everyday business clothing, looking toward the mediator and discussing a single plain sheet of paper. They have natural, relaxed postures, realistic human hands and individual facial features. Eye-level medium-wide framing with all three faces clearly visible, suitable for cropping to a website hero. Soft window daylight, warm ivory walls, a small leafy plant, restrained forest-green upholstery and neutral linen clothing. Authentic professional atmosphere, respectful and approachable, candid rather than posed, premium editorial photography, soft natural textures and realistic skin. Minimal uncluttered composition, no overlaid text, no logos, no watermark, no judge robes, no gavel, no courthouse, no handshake posed toward the camera.
```

