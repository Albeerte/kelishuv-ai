# Getsherik asosidagi Kelishuv dizayni

2026-yil 21-noyabrda Getsherik’ning ommaviy sahifasi va kabinet frontend manbasi o‘rganildi. Kelishuv uchun iliq fon, aniq tipografika, yirik asosiy harakat va qadamli murojaat shakli tanlandi.

## Olingan manbalar

Asosiy manba [Getsherik](https://getsherik.uz/). Kompyuterdagi to‘g‘ridan-to‘g‘ri HTTPS ulanishi sertifikat zanjiri xatosini berdi. `--public-proxy` parametri bilan IntelliScrape’ning ommaviy HTML olish xizmati ishlatildi. Olingan manba lokal Chromium’da bajarildi va Site Deep Clone modullari orqali o‘lchandi.

390, 768, 1024 va 1440 px ekranlar uchun DOM, computed CSS, scroll holatlari va screenshotlar saqlandi. Desktop hover holatlari ham yig‘ildi. 17 ta resurs, jumladan 11 ta ichki WOFF2 shrift fayli ajratildi. `partial` holati dastlabki HTTPS xatosini qayd etadi. Keyingi lokal rendering to‘rtta ekran o‘lchamida tugadi.

Dalillar `.data/design-reference/getsherik-delivery/` papkasida saqlanadi.

- `raw.html` olingan ommaviy sahifa manbasini saqlaydi.
- `source/unpacked-template.html` ichki sahifa shablonini saqlaydi.
- `data/at-rules.json` shriftlar, media qoidalari va keyframe animatsiyalarini saqlaydi.
- `data/dom-*.json`, `scroll-*.json` va `hover.json` brauzer o‘lchovlarini saqlaydi.
- `screenshots/viewport-*.png` va `full-*.png` ekran tasvirlarini saqlaydi.
- `assets.json` resurslarning manba va lokal fayl bog‘lanishini beradi.
- `DESIGN.md`, `design.json`, `tokens.css` va `preview.html` qayta ishlatish uchun natijalarni beradi.

Kabinet uchun ommaviy HTML, `portal.css`, `onboarding.css`, `common.js`, `onboarding.js`, `experiment.js` va `cabinet.js` ham yuklandi. Ular `.data/design-reference/getsherik/` ichida joylashgan. Kabinetning tuzilishi shu ommaviy frontend manbasidan o‘rganildi. Shaxsiy hisob ekranlarini autentifikatsiyadan keyin ko‘rish bo‘yicha tekshiruv ochiq qolgan.

## O‘lchangan vizual tizim

| Qism | Getsherik’dagi qiymat |
| --- | --- |
| Asosiy fon | `#F4F1E8` |
| Yorug‘ yuza | `#FFFDF7` |
| Asosiy matn | `#16150F` |
| Ikkinchi darajali matn | `#5B574C` |
| Chegara | `#E4DFD1` |
| Harakat rangi | `#2E3FE8` |
| Sarlavha | Bricolage Grotesque, 400–800 |
| Matn | Instrument Sans, 400–700 |
| Texnik yozuvlar | JetBrains Mono |
| Desktop konteyneri | 1200 px |
| Tugma shakli | 999 px radius |
| Kartalar | 12–24 px atrofidagi radiuslar |
| Aniq soya | 6–10 px siljish, 0 px xiralashish |

Ranglarning semantik vazifalari manba CSS va ekranlarni ko‘rib aniqlangan. Avtomatik token ro‘yxatidagi takrorlanish soni o‘lchangan elementlar sonini bildiradi.

Ommaviy sahifa chapdagi sarlavha va harakat, o‘ngdagi mahsulot tasviri, jarayon, xizmatlar, narxlar va savol-javob bo‘limlaridan tuzilgan. Kabinet manbasida 820 px atrofidagi tor ish maydoni, progress, yirik savol, sodda tanlovlar va keyingi qadam boshqaruvi mavjud.

## Kelishuvga qo‘llangan qarorlar

Kelishuvning yashil `#174C3C` harakat rangi, foydalanuvchi yuborgan logotip va mediator uchrashuvi surati ishlatiladi. Getsherik’dan iliq fon, ikki shriftli tipografika, yumaloq tugmalar, konturli yuzalar va soddalashtirilgan boshlash jarayoni olindi.

- Landing’dagi yirik sarlavha, ro‘yxatdan o‘tish tugmasi va ikki ustunli birinchi ekran moslashtirildi.
- Foydalanuvchi kabinetidagi asosiy harakat 64 px balandlikdagi “Yangi muammo boshlash” tugmasidir. Ishlar ro‘yxati uning ostida turadi.
- Yangi murojaatning besh qadamli shakli markazlangan ish maydonida ochiladi. Savol, javob va davom etish tugmasi ko‘rish maydonining asosiy qismini egallaydi.
- Mobil tanlovlar ikki ustunda, shakl maydonlari aniq pastki chegara bilan berildi.
- Administrator ko‘rinishida yetti bo‘lim, asosiy ko‘rsatkichlar va nizolar jadvali mavjud.
- Ro‘yxatdan o‘tish, mediator kabineti va hujjat sahifalari ham umumiy tipografik tizimdan foydalanadi.

Yangi o‘lchovlar `src/app/reference.css` ichida joylashgan. U `src/app/layout.tsx` orqali asosiy uslublardan keyin yuklanadi. Murojaat shakli uchun `case-creation-shell` sinfi `src/components/application.tsx` ichida yo‘lga qarab qo‘shiladi.

Instrument Sans va Bricolage Grotesque’ning lotin hamda kengaytirilgan lotin WOFF2 fayllari `public/fonts/` ichidan lokal yuklanadi. Kirill matni mavjud Inter shriftiga o‘tadi. Har ikki yangi shrift papkasiga rasmiy OFL litsenziyasi qo‘shilgan. [Instrument Sans litsenziyasi](https://github.com/google/fonts/blob/main/ofl/instrumentsans/OFL.txt), [Bricolage Grotesque litsenziyasi](https://github.com/google/fonts/blob/main/ofl/bricolagegrotesque/OFL.txt)

## Qayta ishga tushiriladigan pipeline

Loyiha ildizida ishlating.

```powershell
npm run design:reference -- https://getsherik.uz/ --public-proxy
```

Oddiy to‘g‘ridan-to‘g‘ri olish uchun URL yetarli.

```powershell
npm run design:reference -- http://127.0.0.1:2345/welcome
```

Saqlangan HTML bilan o‘lchovni takrorlash mumkin.

```powershell
npm run design:reference -- https://getsherik.uz/ --html=.data/design-reference/getsherik-delivery/raw.html --output=.data/design-reference/getsherik-repeat
```

Har bir ishga tushirish yangi vaqt belgili papka yaratadi. `--output` yangi natija papkasini beradi. Papka atomik yaratiladi. Bitta manzilga parallel yozish urinishida faqat bitta ekstraksiya boshlanadi. Oldingi natijani takrorlash uchun yangi papka tanlanadi. Ekranlar `--breakpoints=390,768,1024,1440` orqali beriladi. Ruxsat etilgan kengliklar 320–2560 px, ko‘pi bilan sakkizta.

`--public-proxy` ochiq sahifa URL’ini IntelliScrape’ning hosted xizmatiga yuborishni yoqadi. Shaxsiy brauzer sessiyasini qo‘llash uchun `--storage-state=path/to/state.json` mavjud. Bunday sessiya bilan to‘g‘ridan-to‘g‘ri ulanish xatosi lokal xato hisobotiga tushadi. Saqlangan HTML va proxy parametrlarini birgalikda berish ommaviy resurslarni hosted xizmatdan olishni ham yoqadi.

Birinchi ishga tushirish Site Deep Clone’ning `1c78e83` nusxasini va Playwright `1.65.1` runtime’ini `.data/design-tools/` ichiga o‘rnatadi. Har bir o‘rnatish alohida vaqtinchalik papkada tugallanib, tayyor manzilga atomik ko‘chiriladi. Bu parallel birinchi ishga tushirishlarni qo‘llaydi. O‘rnatilgan Chrome, keyin Playwright Chromium tekshiriladi. Zarur bo‘lsa Chromium yuklanadi. Node.js 24.19 va Git bilan tekshirildi.

Pipeline HTTP, fetch/XHR, iframe, sahifa skripti va shrift xatolarini `design.json` dagi `gaps` ro‘yxatiga yozadi. Resurs faylining nomi URL va mazmun xeshidan olinadi. Bir URL turli mazmun qaytarganda har bir javobning o‘z fayli yaratiladi. Lokal mirror bir origin ichidagi yo‘naltirishlarni brauzerga uzatadi. Shu orqali CSS va HTML ichidagi nisbiy havolalar yangi manzilga nisbatan ishlaydi. Boshqa origin’ga yo‘naltirish xato sifatida qayd etiladi.

Qo‘lga tushgan fayllar soni 200 ta, alohida resurs hajmi 10 MB bilan chegaralangan. Chegaraga yetish ham hisobotda qayd etiladi. Tarmoq va sahifa muammolari mavjud natijani `partial`, muvaffaqiyatsiz capture esa `capture-error.json` orqali `failed` deb belgilaydi.

## Yuklangan ochiq kodli vositalar

Barcha manbalar `.data/design-tools/` ichida. Runtime uchun ishlatilgan vositalar Site Deep Clone va IntelliScrape hosted endpoint’idir.

| Vosita | Olingan versiya | Ushbu ishdagi holat |
| --- | --- | --- |
| [Site Deep Clone](https://github.com/viniciuscffreitas/site-deep-clone) | `1c78e83` | DOM, computed CSS, scroll va hover modullari ishlatildi |
| [IntelliScrape](https://github.com/GuixJoy/IntelliScrape) | `c049cb8` | Manba yuklandi, hosted `/scrape` orqali ochiq HTML olindi |
| [CodeCompleteMedia Site Cloner](https://github.com/CodeCompleteMedia/site-cloner) | `58618e6` | Manba yuklandi va tuzilishi o‘rganildi |
| [Firecrawl design clone skill](https://github.com/firecrawl/firecrawl-workflows/tree/main/skills/firecrawl-website-design-clone) | `d2a9862` | Skill yuklandi, API kaliti sozlash bosqichi ochiq |
| [URL Extractor](https://github.com/vkmnamit/url-extractor) | `3a6f14a` | Manba yuklandi |
| [WebClone](https://github.com/AbdirahmanNomad/webclone) | `55e33e1` va main ZIP | Windows’dagi boshqaruv belgili `Icon` fayli tufayli ZIP orqali yaroqli manbalar olindi |
| [SeparateWeb](https://github.com/AUN-PN/SeparateWeb) | 404 | Berilgan repository manzili topilmadi |

WebClone ZIP manbasi `.data/design-tools/webclone/webclone-main/` ichida. ZIP SHA-256 qiymati `A17CA8D572E05EA8687F2688A2885929C99A925775A50E064310BD3CD273A371`.

## Tekshiruv dalillari

Getsherik qayta capture natijasida to‘rtta ekran profili, 17 resurs va ikki dastlabki HTTPS xatosi qayd etildi. Lokal Kelishuv capture’i `.data/design-reference/kelishuv-delivery/` ichida `succeeded` holatida, to‘rtta profil va 15 resurs bilan yakunlandi.

Brauzer tekshiruvlari landing, fuqaro kabineti, administrator, mediator, ro‘yxatdan o‘tish va murojaat shaklini qamradi. 8 ta maqsadli flow, ulardagi 9 ta WCAG auditi hamda qo‘shimcha 24 ta WCAG auditi va klaviatura tekshiruvi o‘tdi. Ekranlar `.data/redesign-*.png` va `.data/focus-*.png` ichida saqlangan.

Ro‘yxatdan o‘tish, qoralamani tiklash, hujjat yuklash, taklif yaratish va murojaatni yuborishni qamragan 13 ta qo‘shimcha brauzer tekshiruvi hamda ulardagi 13 ta WCAG auditi o‘tdi. Sinov yaratgan uch hisob, bitta ish va uning hujjati aniq identifikatorlar bo‘yicha chiqarildi. Yakuniy holatda besh ish, to‘rt hisob va bitta sessiya mavjud. Audit zanjiri va 14 ta sahifa manzili qayta tekshirildi.

`npm run test:design` to‘qqizta holatni tekshiradi. HTTP va fetch/iframe xatolari, hover’dan keyingi ketma-ket rasmlar, bir URL’dagi turli mazmunlar, mirror yo‘naltirishlari, xato hujjatga navigatsiya, ikki qiya chiziq bilan boshlangan URL yo‘li, bitta papkaga parallel yozish, parallel birinchi o‘rnatish va Git metama’lumoti xatosida jarayonning yakunlanishi sinovdan o‘tadi. Har bir faylning haqiqiy hajmi manifest bilan solishtiriladi. Yo‘naltirilgan CSS ichidagi nisbiy rasm havolasi ham tekshiriladi. Birinchi o‘rnatish sinovi lokal Git manbasi va npm fixture’idan foydalanadi. To‘qqizta regressiya sinovi o‘tdi.

Logotipning 12 ta qo‘shimcha tekshiruvi va ulardagi sakkizta WCAG auditi o‘tdi. Landing va murojaatning dastlabki ikki qadami 320 px ekranda o‘zbek lotin, o‘zbek kirill va rus tillarida tekshirildi.

Production build, ESLint, TypeScript, 12 ta mavjud regressiya testi va dependency audit tekshiruvlari o‘tdi. Next.js build ESLint konfiguratsiyasidagi Next.js plagini haqida ogohlantirish berdi. Alohida ESLint tekshiruvi nol xato bilan yakunlandi.

## Yangi rasm va taqqoslash

Bosh sahifa hamda ro‘yxatdan o‘tishdagi rasm `public/images/mediation-meeting.png` fayliga almashtirildi. Surat 1448 × 1086 px o‘lchamda built-in `imagegen` orqali yaratildi. Unda professional mediator va ikki tarafning uchrashuvi tasvirlangan.

Bosh ekran ostiga mediatsiya va fuqarolik sudi uchun yonma-yon kartalar qo‘shildi. Summalar 40–64 px, muddat raqamlari 40–56 px shrift bilan ko‘rsatiladi. Taqqoslash uchun 50 000 000 so‘mlik, davlat boji imtiyozisiz mulkiy da’vo tanlandi. Mediatorning 800 000 so‘mlik namuna tarifi va 2 000 000 so‘mlik davlat boji mavjud `mediationFee` hamda `courtCosts` funksiyalaridan olinadi.

Sud boji hisobida da’vo summasining 4%i va kamida 1 BHM qoidasi ishlatiladi. Advokat, ekspertiza hamda pochta xarajatlari alohida ko‘rsatiladi. [Davlat boji to‘g‘risidagi qonun ilovasi](https://lex.uz/docs/-4680944)

Mediatsiya uchun asosiy 30 kunlik muddat, taraflar roziligi bilan qo‘shimcha 30 kungacha uzaytirish imkoniyati ko‘rsatilgan. Mediator bilan yakuniy haq oldindan kelishiladi. [Mediatsiya to‘g‘risidagi qonun, 23 va 28-moddalar](https://lex.uz/docs/-3805227)

Fuqarolik sudida tayyorlash uchun 10 kun va tayyorlash tugagach ko‘rish uchun bir oylik umumiy muddat alohida raqamlarda berilgan. Murakkab ishlar bo‘yicha uzaytirish, arizani qabul qilish, apellyatsiya va ijro alohida tushuntirilgan. [FPK, 202 va 207-moddalar](https://lex.uz/docs/-3517337?ONDATE=12.09.2026)

18 ta ekran va til kombinatsiyasi, olti WCAG auditi, ikkala sahifadagi rasm yuklanishi hamda 40 px dan kichik bo‘lmagan asosiy raqamlar tekshirildi. 320–1440 px oralig‘ida gorizontal chiqish kuzatilmadi. Production build, ESLint, TypeScript, 12 ta mavjud regressiya va mustaqil kod ko‘rigi o‘tdi.

Surat uchun ishlatilgan yakuniy prompt quyida saqlangan.

```text
Use case: photorealistic-natural. Create a polished, natural editorial photograph for the hero of Kelishuv, an Uzbek dispute mediation platform. Landscape image about 4:3. Three Central Asian adults in a bright, warm, contemporary mediation office in Uzbekistan. An impartial professional female mediator in her forties sits centrally at a rounded light oak meeting table, listening with an open, calm expression and gently guiding a discussion. Two adult participants sit on either side, one man and one woman in understated everyday business clothing, looking toward the mediator and discussing a single plain sheet of paper. They have natural, relaxed postures, realistic human hands and individual facial features. Eye-level medium-wide framing with all three faces clearly visible, suitable for cropping to a website hero. Soft window daylight, warm ivory walls, a small leafy plant, restrained forest-green upholstery and neutral linen clothing. Authentic professional atmosphere, respectful and approachable, candid rather than posed, premium editorial photography, soft natural textures and realistic skin. Minimal uncluttered composition, no overlaid text, no logos, no watermark, no judge robes, no gavel, no courthouse, no handshake posed toward the camera.
```

