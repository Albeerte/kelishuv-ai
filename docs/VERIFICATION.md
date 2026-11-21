# KELISHUV AI tekshiruv natijalari

2026-11-20 kuni Windows, Node.js 24.19, Chrome va `127.0.0.1:2345` muhitida tekshirildi.

## Muhandislik tekshiruvi

| Tekshiruv | Natija |
| --- | --- |
| TypeScript | `npm run typecheck` o‘tdi |
| ESLint | TypeScript recommended qoidalari, nol xato |
| Saqlangan regressiyalar | `npm test`, 12 test o‘tdi |
| Production build | Next.js 15.5.29 build o‘tdi |
| Dependency audit | `npm audit`, nol ma’lum zaiflik |
| Mustaqil statik ko‘rik | Yangi backend modullari va PDF jarayoni bo‘yicha yakuniy ko‘riklar o‘tdi |

## API oqimlari

Asosiy to‘plamda 97 tekshiruv o‘tdi. Ro‘yxatdan o‘tish, login, emailga bog‘langan taklif, mustaqil bayon, shaxsiy dalil, administrator va begona hisob ruxsati, to‘rtta taklif, mediator tanlovi, uch ishtirokchi imzosi, nusxa almashtirish, PDF/DOCX va ijro hisoboti qamraldi.

Qo‘shimcha to‘plamda 41 tekshiruv o‘tdi. Nizo yakunlangandan keyingi AI roziligini qaytarish, parallel ko‘rik qaydlari, eski ijro tarixi, DOCX va PDF matni, mahalliy skan OCR hamda eslatma idempotentligi tekshirildi.

Ijro bo‘yicha 25 tekshiruv o‘tdi. Eski nusxaga tegishli kechikkan hisobot, arxivdagi so‘rov identifikatori, o‘zgargan dalil biriktirmasi, nusxasiz so‘rov, to‘g‘ri takroriy so‘rov va pulga oid bo‘lmagan majburiyatning dastlabki bajarilish vaqti tekshirildi.

## Brauzerdagi amallar

- Mediator interfeys orqali PDF/DOCX kelishuv yaratdi.
- Har bir ishtirokchi PDFning barcha sahifalarini ochdi va ixtiyoriy tasdiqladi.
- Birinchi taraf sichqoncha bilan imzoladi, undo va clear ishlatildi.
- Ikkinchi taraf 390px ekranda CDP touch hodisalari bilan imzoladi. Sahifa imzolash vaqtida siljimadi.
- Mediator bosim ma’lumoti berilgan pen Pointer Events bilan imzoladi.
- Uch imzo va ularning tartibi yakuniy faylda tekshirildi.
- 1440, 1280, 1024, 768, 390 va 360px ekranlarda tashqi gorizontal toshish kuzatilmadi.
- 360px PDF preview 200% kattalashtirildi, uning ichida gorizontal pan ishladi.
- Mediator narx va shahar filtrlari, e’lon qilingan qabul jadvali, sessiya bron qilish va ICS yuklash ishladi.
- Maxfiy xabar tegishli mediatorga ko‘rindi. Qarshi taraf uchun kirish sinovi o‘tdi.
- To‘lov hisoboti foydalanuvchi formasidan yuborildi va qabul qiluvchi taraf orqali tasdiqlandi.
- Ma’lumot so‘rovi Sozlamalardan yuborildi va administrator javobi saqlandi.
- O‘zbek lotin, kirill va rus tili almashtirildi. Bank hisobi forma orqali yaratildi va shu hisobga kirildi.

Jismoniy barmoq va stilus qurilmasi bilan apparat sinovi hali bajarilishi kerak. Avtomatlashtirilgan sensor va pen hodisalari dasturiy oqimni qamraydi.

## Hujjat renderi va AI

Yakuniy ikki sahifali PDF PNGga render qilinib ko‘zdan kechirildi. Uch imzo, rekvizit, vaqt, nusxa raqami va xesh joylashuvi tekshirildi. Imzo ustma-ust tushishi va sahifa chegarasidan chiqishi rad etildi. DOCX xom matni, fayl xeshi va imzo tasvirlari tekshirildi.

`qwen3-vl:8b-instruct` bilan haqiqiy mahalliy tahlil va dalil ekstraksiyasi bajarildi. Ochiq tahlilda shaxsiy markerlar kuzatilmadi. Maxfiy tahlil boshqa tarafga ochilmadi. Sintetik rasm va skan PDFdan 1,200,000 so‘mlik summa ajratildi. Natija `verified=false` holatida saqlandi. Bu sinov keng o‘zbek huquqiy benchmarki hisoblanmaydi.

## Chegaralangan hujjat ishlovi

PDF matni oqimdan 18,000 belgigacha olinadi. Jarayonning JavaScript heap chegarasi 192 MiB va vaqt chegarasi 20 soniya. Native rastrning eng uzun tomoni 1400 piksel. DOCX uchun haqiqiy ZIP oqimi va 30 MiB kengaygan hajm tekshiriladi. PNG/JPEG o‘lchami native dekodlashdan avval tekshiriladi.

Bir sahifali, ikki MiB matni kuchli siqilgan PDF, juda katta sahifa o‘lchami, ZIP ichidagi soxta katalog sarlavhasi, noto‘g‘ri deklarativ ZIP hajmi va katta PNG sarlavhasi regressiya to‘plamiga kiritilgan.

## Accessibility

Agreement preview, mediatorlar, muloqot, ijro, ro‘yxatdan o‘tish va taqdimot sahifalari axe-core WCAG 2 A/AA qoidalari bilan tekshirildi. Yakuniy olti sahifada ushbu qoidalar bo‘yicha nol xato qaytdi. Matn kontrasti to‘g‘rilandi va siljitiladigan PDF maydoni klaviatura fokusiga ochildi. Ushbu natija avtomatlashtirilgan tekshiruv doirasiga tegishli.

## Sinov ma’lumotlarini tozalash

Sinovlar yaratgan hisob, nizo, hujjat, to‘lov va bildirishnoma yozuvlari ularning aniq identifikatorlari asosida chiqarildi. Tozalashdan oldin shifrlangan zaxira olindi. Foydalanuvchiga tegishli beshta nizo, to‘rtta mavjud hisob va oldingi sessiya saqlandi. Yakuniy audit zanjiri hamda mahalliy manzil qayta tekshirildi.

## Tashqi xizmatlar

ERI, OneID, real to‘lov yig‘ish va payout sozlanmagan. Jitsi tashqi uchrashuv havolasini beradi. SMTP, PostgreSQL, Redis, S3, Qdrant va Docker yo‘llari tegishli xizmat muhiti bilan alohida tekshiriladi. Qonuniy rasmiylashtirish va shaxs rekvizitlarini mediator tekshiradi. Mahalliy qo‘lda imzo vizual yozuv va audit bilan saqlanadi.

## Interfeys yangilanishi, 2026-11-21

Yangi yashil va iliq oq dizayn amaldagi APIlar orqali tekshirildi. 97 API tekshiruvi, 12 saqlangan regressiya, 13 brauzer oqimi va 10 tiklash tekshiruvi o‘tdi. Keyingi amal, mobil menyu hamda administrator va mediator bo‘limlarining 360–1440px ko‘rinishlari qo‘shimcha tekshirildi.

24 sahifa va forma holatida axe-core WCAG 2 A/AA, 2.1 AA va 2.2 AA teglari bo‘yicha nol xato qaytdi. Klaviatura orqali asosiy mazmunga o‘tish, FAQ va ichida siljitiladigan jadvalning fokus olishi tekshirildi. Brauzer tekshiruvlarida `pageerror` qaytmadi. Bu natijalar avtomatlashtirilgan tekshiruv doirasiga tegishli.

Uzilgan ro‘yxatdan o‘tish javobidan keyin kirish, qayta yuborishda bitta ariza saqlanishi, bir hisob qoralamasining boshqa hisobdan ajratilishi, muvaffaqiyatsiz taklifni tiklash va yuklanmagan hujjat nomlarini saqlash sinovdan o‘tdi. Rad etilgan so‘rovdan keyin o‘nta faylni almashtirish qoralama hajmi va tiklashini buzmasligi tekshirildi.

Production build, TypeScript, ESLint va dependency audit o‘tdi. Next.js build mavjud ESLint konfiguratsiyasida Next.js plagini aniqlanmagani haqida ogohlantirish berdi. Alohida ESLint tekshiruvi nol xato bilan yakunlandi. Yakuniy mustaqil kod ko‘rigi o‘tdi.

Sinovga tegishli 21 hisob, 14 ish va 48 shifrlangan fayl chiqarildi. Mavjud besh ish, to‘rt hisob, bitta sessiya saqlandi. Tozalashdan oldin shifrlangan zaxira olindi. Dizayn, asset prompti va foydalanuvchi jarayonlari [redesign rejasida](REDESIGN_PLAN.md) qayd etilgan.

## Getsherik asosidagi dizayn va ekstraksiya

Getsherik’ning ommaviy HTML manbasi IntelliScrape hosted xizmati orqali olinib, lokal Chromium’da Site Deep Clone modullari bilan o‘lchandi. To‘rtta ekran o‘lchami va 17 ta resurs saqlandi. Dastlabki to‘g‘ridan-to‘g‘ri ulanishdagi ikkita HTTPS xatosi `partial` hisobotida qayd etildi. Lokal Kelishuv capture’i to‘rtta profil, 15 resurs va nol xato bilan tugadi.

Yangi tipografika va shakl ko‘rinishida 13 ta brauzer flow’i, 24 ta WCAG holati, sakkizta maqsadli flow, 12 ta logotip tekshiruvi va 320 px ekrandagi uch til sinovi o‘tdi. Ro‘yxatdan o‘tishdan hujjat yuklash va murojaat yuborishgacha bo‘lgan jarayon tekshirildi. Shu tekshiruvlarda jami 54 ta avtomatik WCAG auditida nol xato qaytdi.

`npm run test:design` to‘qqizta ekstraktor regressiyasini qamraydi. HTTP/fetch/iframe xatolari, kech yuklangan resurslar, bir URL’dagi turli javoblar, yo‘naltirilgan CSS ichidagi nisbiy havolalar, xato hujjat, ikki qiya chiziqli URL yo‘li, parallel natija papkasi, parallel dastlabki o‘rnatish va Git metama’lumoti xatosida jarayon yakunlanishi tekshirildi.

Production build, ESLint, TypeScript, mavjud 12 ta regressiya testi va dependency audit o‘tdi. Sinov yaratgan uch hisob, bitta ish va bitta fayl identifikatorlari bo‘yicha chiqarildi. Besh ish, to‘rt hisob va bitta sessiya, audit zanjiri hamda 14 ta sahifa manzili qayta tekshirildi. Dizayn o‘lchovlari va takrorlash buyruqlari [DESIGN.md](DESIGN.md) ichida saqlangan.

## Mediator surati va narx hamda vaqt taqqoslashi

Landing va ro‘yxatdan o‘tishda `mediation-meeting.png` surati yuklanishi tekshirildi. Mediatsiya va fuqarolik sudi kartalarida mavjud hisoblash funksiyalaridan olingan 800 000 hamda 2 000 000 so‘mlik qiymatlar, 30 kun va 10 kun + 1 oy bosqichlari tekshirildi. Misol summasi 50 000 000 so‘m, mediator qiymati namuna tarifi va sud qiymati davlat boji sifatida berilgan.

1440, 1024, 768, 390, 360 va 320 px ekranlarda uch til bo‘yicha 18 ta ko‘rinish tekshirildi. Narx va muddat raqamlari kamida 40 px bo‘lishi, karta ichida sig‘ishi va uchta rasmiy manba havolasi mavjudligi tekshirildi. Olti WCAG auditida nol xato qaytdi. Ro‘yxatdan o‘tishdagi yangi surat ham yuklandi. Brauzerda JavaScript xatosi qaytmadi.

Production build, ESLint, TypeScript, 12 ta regressiya testi va mustaqil kod ko‘rigi o‘tdi. Audit zanjiri, 14 ta sahifa hamda mavjud besh ish, to‘rt hisob va bitta sessiya yakuniy tekshiruvdan o‘tdi.

## Telefon, huquqiy yordamchi va pullik xizmatlar kengaytmasi

2026-11-21 kuni production build, TypeScript, ESLint, 45 ta regressiya testi va to‘qqizta dizayn ekstraktori testi o‘tdi. Production bog‘liqliklarining `npm audit --omit=dev` tekshiruvida nol zaiflik qaytdi. Olti yo‘nalish bo‘yicha mustaqil kod ko‘rigi o‘tdi. Next.js build ESLint konfiguratsiyasidagi Next.js plagini haqida ogohlantirish berdi, alohida ESLint tekshiruvi nol xato bilan tugadi.

Global HTTPS muhitida ikki alohida hisob bilan sakkizta guruhlangan brauzer jarayoni tekshirildi. Telefon bilan ro‘yxatdan o‘tish, ixtiyoriy email, pasport yuklash, shaxsiy maydonlar, qarshi taraf taklifi, alohida bayon va roziliklar, to‘rtta navbatdagi taklif hamda mediatorlar navbatiga o‘tish ishladi. Umumiy suhbatdagi yangi xabar boshqa hisobda yangilandi. To‘lovdan oldingi hujjat cheklovi, saqlangan qoralama, buyurtma ruxsatlari va o‘zgartirilgan maydonlarni qayta yuborish tekshirildi.

Kech qaytgan AI to‘ldirish javobi boshqa nizoning maydonlariga yozilmasligi va AI ajratgan shaxsiy maydonlar qayta yuklashda saqlanishi tekshirildi. Boshqa ishtirokchi yaratgan Zoom havolasi va mediator hisobi ochiq xonada paydo bo‘lishi frontenddagi boshqariladigan javoblar bilan tekshirildi. To‘lov, SMS, Face ID va Zoom adapterlarining uzilish, parallel so‘rov va qayta urinish holatlari avtomatik testlar bilan qamrab olindi.

Yordamchi sayt bo‘yicha yo‘l-yo‘riq, katalogdagi modda va Lex.uz havolalari, xato javobdan keyin qayta urinish, rus tilidagi savol va Escape tugmasi bilan yopish orqali tekshirildi. 360, 768 va 1440 px ekranlardagi yangi sahifalar hamda landing uchun 18 ta axe-core WCAG auditida nol xato qaytdi. Brauzerda JavaScript xatosi qaytmadi. Kabinet va administrator oqimlari uchun sakkizta qo‘shimcha tekshiruv va to‘qqizta WCAG auditi, narx hamda muddat taqqoslashi uchun uch tilda 18 ta ko‘rinish va oltita WCAG auditi ham o‘tdi.

Yakuniy tekshiruvdan so‘ng global namoyish muhitidagi sinov hisoblari, nizolar, buyurtmalar va uchta sinov fayli identifikatorlari bo‘yicha chiqarildi. Asosiy lokal saqlashdagi beshta hisob, beshta nizo va bitta sessiya boshlang‘ich nusxa bilan solishtirildi. Asl yozuvlarning mazmuni bo‘yicha moslik tasdiqlandi.

SMS, haqiqiy biometrik tekshiruv, Payme va Zoom servis sinovlari biznes hisoblari hamda kalitlar sozlanishini kutmoqda. Face ID uchun provayderga mos bridge, bank payout uchun biznes hisob-kitob sozlamasi kerak. Ommaviy namoyish yordamchisi manbalar katalogi rejimida ishlaydi. Ulanish shartnomalari va boshlang‘ich tariflar [kengaytma rejasida](KELISHUV_EXPANSION_PLAN.md), mahsulot talablari [professional promptda](KELISHUV_MASTER_PROMPT.md) berilgan.
